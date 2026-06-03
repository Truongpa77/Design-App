import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET - Chi tiết chứng từ tài chính và danh sách dòng chi tiết
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await context.params;
    const id = parseInt(idStr);

    const docRes = await pool.query(
      `SELECT d.*, c.name as customer_name
       FROM financial_documents d
       LEFT JOIN customers c ON d.customer_id = c.id
       WHERE d.id = $1`,
      [id]
    );

    if (docRes.rows.length === 0) {
      return NextResponse.json({ error: 'Không tìm thấy chứng từ' }, { status: 404 });
    }

    const doc = docRes.rows[0];

    const detailRes = await pool.query(
      `SELECT fd.*, 
              m.material_code, 
              m.name as material_name, 
              m.unit as material_unit
       FROM financial_details fd
       LEFT JOIN materials m ON fd.material_id = m.id
       WHERE fd.document_id = $1
       ORDER BY fd.id ASC`,
      [id]
    );

    doc.items = detailRes.rows;
    return NextResponse.json(doc);
  } catch (error: any) {
    console.error('Error fetching financial document detail:', error);
    return NextResponse.json({ error: 'Lỗi server: ' + error.message }, { status: 500 });
  }
}

// PUT - Cập nhật chứng từ tài chính
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const client = await pool.connect();
  try {
    const { id: idStr } = await context.params;
    const id = parseInt(idStr);

    const data = await request.json();
    const { 
      document_no, 
      document_date, 
      customer_id, 
      partner_name, 
      partner_address, 
      description, 
      items,
      transaction_code
    } = data;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Vui lòng thêm ít nhất 1 dòng chi tiết' }, { status: 400 });
    }

    await client.query('BEGIN');

    // Tính toán lại tổng tiền
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

    // Xóa các dòng chi tiết cũ
    await client.query('DELETE FROM financial_details WHERE document_id = $1', [id]);

    // Cập nhật chứng từ chính
    const docRes = await client.query(
      `UPDATE financial_documents SET
        document_no = $1, 
        document_date = $2, 
        customer_id = $3, 
        partner_name = $4, 
        partner_address = $5, 
        description = $6,
        total_amount = $7, 
        total_tax = $8, 
        grand_total = $9,
        transaction_code = $10
       WHERE id = $11 RETURNING *`,
      [
        document_no, 
        document_date, 
        customer_id ? parseInt(customer_id) : null, 
        partner_name || '', 
        partner_address || '', 
        description || '',
        total_amount, 
        total_tax, 
        grand_total, 
        transaction_code || null,
        id
      ]
    );

    if (docRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Không tìm thấy chứng từ' }, { status: 404 });
    }

    // Chèn lại các dòng chi tiết mới
    for (const item of processedItems) {
      await client.query(
        `INSERT INTO financial_details 
          (document_id, material_id, description, debit_account, credit_account, amount, tax_percent, tax_amount, total_amount, transaction_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          id,
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
    const doc = docRes.rows[0];
    doc.item_count = processedItems.length;

    return NextResponse.json(doc);
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error updating financial document:', error);
    return NextResponse.json({ error: 'Lỗi server: ' + error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

// DELETE - Xóa chứng từ tài chính
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await context.params;
    const id = parseInt(idStr);

    const result = await pool.query(
      `DELETE FROM financial_documents WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Không tìm thấy chứng từ' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting financial document:', error);
    return NextResponse.json({ error: 'Lỗi server: ' + error.message }, { status: 500 });
  }
}
