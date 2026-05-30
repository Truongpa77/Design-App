import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const query = `
      SELECT d.*, 
        (SELECT COUNT(*) FROM warehouse_details WHERE document_id = d.id) as item_count
      FROM warehouse_documents d
      ORDER BY d.document_date DESC, d.created_at DESC
    `;
    const result = await pool.query(query);
    return NextResponse.json(result.rows);
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi server nội bộ' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const client = await pool.connect();
  try {
    const { type, document_date, partner_name, partner_address, description, items } = await request.json();

    if (!type || !items || items.length === 0) {
      return NextResponse.json({ error: 'Thiếu thông tin phiếu' }, { status: 400 });
    }

    await client.query('BEGIN');

    // Tạo mã phiếu tự động
    const prefix = type === 'import' ? 'PN' : 'PX';
    const numRes = await client.query(`SELECT COUNT(*) + 1 as next_num FROM warehouse_documents WHERE type = $1`, [type]);
    const document_no = `${prefix}-${String(numRes.rows[0].next_num).padStart(3, '0')}`;

    // Tính tổng tiền
    const total_amount = items.reduce((acc: number, item: any) => acc + (item.quantity * item.unit_price * (1 + (item.tax_percent || 0)/100)), 0);

    // Tạo phiếu
    const docRes = await client.query(
      `INSERT INTO warehouse_documents (document_no, type, document_date, partner_name, partner_address, description, total_amount) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [document_no, type, document_date || new Date(), partner_name, partner_address, description, total_amount]
    );
    const document = docRes.rows[0];

    // Tạo chi tiết & cập nhật tồn kho
    for (const item of items) {
      const lineTotal = item.quantity * item.unit_price * (1 + (item.tax_percent || 0)/100);
      
      await client.query(
        `INSERT INTO warehouse_details (document_id, material_id, warehouse_code, quantity, unit_price, tax_percent, total_price) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [document.id, item.material_id, item.warehouse_code, item.quantity, item.unit_price, item.tax_percent || 0, lineTotal]
      );

      // Cập nhật tồn kho
      const stockChange = type === 'import' ? item.quantity : -item.quantity;
      await client.query(
        'UPDATE materials SET stock_quantity = stock_quantity + $1 WHERE id = $2',
        [stockChange, item.material_id]
      );
    }

    await client.query('COMMIT');
    
    // Fetch count for UI
    document.item_count = items.length;
    return NextResponse.json(document);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return NextResponse.json({ error: 'Lỗi server nội bộ' }, { status: 500 });
  } finally {
    client.release();
  }
}
