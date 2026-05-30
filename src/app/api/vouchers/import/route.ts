import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET - Lay danh sach phieu nhap kho
export async function GET() {
  try {
    const result = await pool.query(`
      SELECT d.*, 
        (SELECT COUNT(*) FROM warehouse_details WHERE document_id = d.id) as item_count
      FROM warehouse_documents d
      WHERE d.type = 'import'
      ORDER BY d.document_date DESC, d.created_at DESC
    `);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Loi server' }, { status: 500 });
  }
}

// POST - Tao phieu nhap kho moi
export async function POST(request: Request) {
  const client = await pool.connect();
  try {
    const { document_no, document_date, customer_id, partner_name, partner_address, description, items } = await request.json();

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Vui long them it nhat 1 dong hang' }, { status: 400 });
    }

    await client.query('BEGIN');

    // Neu khong co so phieu, tu dong tao
    let finalDocNo = document_no;
    if (!finalDocNo) {
      const numRes = await client.query(
        `SELECT COUNT(*) + 1 as next_num FROM warehouse_documents WHERE type = 'import'`
      );
      finalDocNo = `PN${String(numRes.rows[0].next_num).padStart(4, '0')}`;
    }

    // Tinh tong tien
    let subtotal_amount = 0;
    let tax_amount = 0;

    const processedItems = items.map((item: any) => {
      const line_amount = Number(item.quantity) * Number(item.unit_price);
      const tax = line_amount * (Number(item.tax_percent || 0) / 100);
      const total_price = line_amount + tax;
      subtotal_amount += line_amount;
      tax_amount += tax;
      return { ...item, line_amount, total_price };
    });

    const total_amount = subtotal_amount + tax_amount;

    // Tao phieu chinh
    const docRes = await client.query(
      `INSERT INTO warehouse_documents 
        (document_no, type, document_date, customer_id, partner_name, partner_address, description, subtotal_amount, tax_amount, total_amount)
       VALUES ($1, 'import', $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [finalDocNo, document_date || new Date(), customer_id || null, partner_name || '', partner_address || '', description || '', subtotal_amount, tax_amount, total_amount]
    );
    const doc = docRes.rows[0];

    // Tao chi tiet va cap nhat ton kho
    for (const item of processedItems) {
      await client.query(
        `INSERT INTO warehouse_details 
          (document_id, material_id, warehouse_code, quantity, unit_price, tax_percent, line_amount, total_price)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [doc.id, item.material_id, item.warehouse_code || '', item.quantity, item.unit_price, item.tax_percent || 0, item.line_amount, item.total_price]
      );

      // Cap nhat ton kho (nhap -> cong vao)
      await client.query(
        'UPDATE materials SET stock_quantity = stock_quantity + $1 WHERE id = $2',
        [item.quantity, item.material_id]
      );
    }

    await client.query('COMMIT');

    doc.item_count = processedItems.length;
    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return NextResponse.json({ error: 'Loi server' }, { status: 500 });
  } finally {
    client.release();
  }
}
