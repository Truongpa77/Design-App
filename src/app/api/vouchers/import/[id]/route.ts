import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET - Chi tiet phieu nhap kho
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await context.params;
    const id = parseInt(idStr);
    const docRes = await pool.query(
      `SELECT d.* FROM warehouse_documents d WHERE d.id = $1 AND d.type = 'import'`,
      [id]
    );
    if (docRes.rows.length === 0) {
      return NextResponse.json({ error: 'Khong tim thay phieu' }, { status: 404 });
    }

    const doc = docRes.rows[0];
    const detailRes = await pool.query(
      `SELECT wd.*, m.name as material_name, m.unit as material_unit, m.material_code
       FROM warehouse_details wd
       JOIN materials m ON wd.material_id = m.id
       WHERE wd.document_id = $1
       ORDER BY wd.id ASC`,
      [id]
    );
    doc.items = detailRes.rows;
    return NextResponse.json(doc);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Loi server' }, { status: 500 });
  }
}

// PUT - Cap nhat phieu nhap kho
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const client = await pool.connect();
  try {
    const { id: idStr } = await context.params;
    const id = parseInt(idStr);
    const { document_no, document_date, customer_id, partner_name, partner_address, description, items } = await request.json();

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Vui long them it nhat 1 dong hang' }, { status: 400 });
    }

    await client.query('BEGIN');

    // Hoan tra ton kho tu items cu
    const oldItems = await client.query(
      'SELECT material_id, quantity FROM warehouse_details WHERE document_id = $1',
      [id]
    );
    for (const old of oldItems.rows) {
      await client.query(
        'UPDATE materials SET stock_quantity = stock_quantity - $1 WHERE id = $2',
        [old.quantity, old.material_id]
      );
    }

    // Xoa chi tiet cu
    await client.query('DELETE FROM warehouse_details WHERE document_id = $1', [id]);

    // Tinh lai tong tien
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

    // Cap nhat phieu chinh
    const docRes = await client.query(
      `UPDATE warehouse_documents SET
        document_no = $1, document_date = $2, customer_id = $3, partner_name = $4, partner_address = $5, description = $6,
        subtotal_amount = $7, tax_amount = $8, total_amount = $9
       WHERE id = $10 RETURNING *`,
      [document_no, document_date, customer_id || null, partner_name || '', partner_address || '', description || '',
       subtotal_amount, tax_amount, total_amount, id]
    );

    // Tao chi tiet moi va cap nhat ton kho
    for (const item of processedItems) {
      await client.query(
        `INSERT INTO warehouse_details 
          (document_id, material_id, warehouse_code, quantity, unit_price, tax_percent, line_amount, total_price)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, item.material_id, item.warehouse_code || '', item.quantity, item.unit_price,
         item.tax_percent || 0, item.line_amount, item.total_price]
      );
      await client.query(
        'UPDATE materials SET stock_quantity = stock_quantity + $1 WHERE id = $2',
        [item.quantity, item.material_id]
      );
    }

    await client.query('COMMIT');
    const doc = docRes.rows[0];
    doc.item_count = processedItems.length;
    return NextResponse.json(doc);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return NextResponse.json({ error: 'Loi server' }, { status: 500 });
  } finally {
    client.release();
  }
}
