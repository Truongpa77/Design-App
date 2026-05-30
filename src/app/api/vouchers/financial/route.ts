import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

async function ensureTransactionCodeColumn() {
  try {
    // 1. Kiểm tra / Thêm cột ở bảng financial_documents (Header)
    const docColCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='financial_documents' AND column_name='transaction_code'
    `);
    if (docColCheck.rows.length === 0) {
      console.log('⏳ Column "transaction_code" does not exist in financial_documents. Adding it...');
      await pool.query(`
        ALTER TABLE financial_documents 
        ADD COLUMN IF NOT EXISTS transaction_code VARCHAR(50) REFERENCES transactions(transaction_code) ON DELETE SET NULL;
      `);
      console.log('✅ Column "transaction_code" added to financial_documents successfully!');
    }

    // 2. Kiểm tra / Thêm cột ở bảng financial_details (Detail Items)
    const detColCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='financial_details' AND column_name='transaction_code'
    `);
    if (detColCheck.rows.length === 0) {
      console.log('⏳ Column "transaction_code" does not exist in financial_details. Adding it...');
      await pool.query(`
        ALTER TABLE financial_details 
        ADD COLUMN IF NOT EXISTS transaction_code VARCHAR(50) REFERENCES transactions(transaction_code) ON DELETE SET NULL;
      `);
      console.log('✅ Column "transaction_code" added to financial_details successfully!');
    }
  } catch (err) {
    console.error('❌ Error during database columns check:', err);
  }
}

// GET - Lấy danh sách chứng từ tài chính theo loại (receipt, payment, debit_advice, credit_advice)
export async function GET(request: NextRequest) {
  try {
    await ensureTransactionCodeColumn();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    let query = `
      SELECT d.*, 
             c.name as customer_name,
             (SELECT COUNT(*)::int FROM financial_details WHERE document_id = d.id) as item_count
      FROM financial_documents d
      LEFT JOIN customers c ON d.customer_id = c.id
    `;
    const params: any[] = [];

    if (type) {
      query += ` WHERE d.type = $1`;
      params.push(type);
    }

    query += ` ORDER BY d.document_date DESC, d.created_at DESC`;

    const result = await pool.query(query, params);
    return NextResponse.json(result.rows, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error: any) {
    console.error('Error fetching financial documents:', error);
    return NextResponse.json({ error: 'Lỗi server: ' + error.message }, { status: 500 });
  }
}

// POST - Tạo mới một chứng từ tài chính
export async function POST(request: Request) {
  const client = await pool.connect();
  try {
    const data = await request.json();
    const { 
      document_no, 
      type, 
      document_date, 
      customer_id, 
      partner_name, 
      partner_address, 
      description, 
      items,
      transaction_code
    } = data;

    if (!type) {
      return NextResponse.json({ error: 'Thiếu loại chứng từ' }, { status: 400 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Vui lòng thêm ít nhất 1 dòng chi tiết' }, { status: 400 });
    }

    await client.query('BEGIN');

    // Tự động sinh số phiếu nếu trống
    let finalDocNo = document_no;
    if (!finalDocNo) {
      const numRes = await client.query(
        `SELECT COUNT(*) + 1 as next_num FROM financial_documents WHERE type = $1`,
        [type]
      );
      const nextNum = parseInt(numRes.rows[0].next_num);
      
      let prefix = 'PC';
      if (type === 'receipt') prefix = 'PT';
      else if (type === 'debit_advice') prefix = 'BN';
      else if (type === 'credit_advice') prefix = 'BC';

      finalDocNo = `${prefix}${String(nextNum).padStart(4, '0')}`;
    }

    // Tính toán tổng tiền
    let total_amount = 0;
    let total_tax = 0;

    const processedItems = items.map((item: any) => {
      const amt = Number(item.amount || 0);
      const taxRate = Number(item.tax_percent || 0);
      const taxAmt = amt * (taxRate / 100);
      const total = amt + taxAmt;

      total_amount += amt;
      total_tax += taxAmt;

      return {
        ...item,
        amount: amt,
        tax_percent: taxRate,
        tax_amount: taxAmt,
        total_amount: total
      };
    });

    const grand_total = total_amount + total_tax;

    // Chèn chứng từ chính
    const docRes = await client.query(
      `INSERT INTO financial_documents 
        (document_no, type, document_date, customer_id, partner_name, partner_address, description, total_amount, total_tax, grand_total, transaction_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        finalDocNo, 
        type, 
        document_date || new Date().toISOString().split('T')[0], 
        customer_id ? parseInt(customer_id) : null, 
        partner_name || '', 
        partner_address || '', 
        description || '', 
        total_amount, 
        total_tax, 
        grand_total,
        transaction_code || null
      ]
    );
    const doc = docRes.rows[0];

    // Chèn chi tiết chứng từ
    for (const item of processedItems) {
      await client.query(
        `INSERT INTO financial_details 
          (document_id, material_id, description, debit_account, credit_account, amount, tax_percent, tax_amount, total_amount, transaction_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          doc.id,
          item.material_id ? parseInt(item.material_id) : null,
          item.description || '',
          item.debit_account || null,
          item.credit_account || null,
          item.amount,
          item.tax_percent,
          item.tax_amount,
          item.total_amount,
          item.transaction_code || null
        ]
      );
    }

    await client.query('COMMIT');
    doc.item_count = processedItems.length;

    return NextResponse.json(doc, { status: 201 });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error saving financial document:', error);
    return NextResponse.json({ error: 'Lỗi server: ' + error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
