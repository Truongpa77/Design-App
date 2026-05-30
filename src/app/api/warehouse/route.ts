import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const query = `
      SELECT w.*, m.name as material_name, m.unit 
      FROM warehouse_transactions w
      JOIN materials m ON w.material_id = m.id
      ORDER BY w.date DESC
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
    const { material_id, transaction_type, quantity, notes } = await request.json();

    if (!material_id || !transaction_type || !quantity) {
      return NextResponse.json({ error: 'Thiếu thông tin bắt buộc' }, { status: 400 });
    }

    await client.query('BEGIN');

    // 1. Ghi nhận giao dịch
    const insertQuery = `
      INSERT INTO warehouse_transactions (material_id, transaction_type, quantity, notes)
      VALUES ($1, $2, $3, $4) RETURNING *
    `;
    const result = await client.query(insertQuery, [material_id, transaction_type, quantity, notes]);
    const transaction = result.rows[0];

    // 2. Cập nhật số lượng tồn kho
    const updateStockQuery = `
      UPDATE materials 
      SET stock_quantity = stock_quantity ${transaction_type === 'import' ? '+' : '-'} $1
      WHERE id = $2
    `;
    await client.query(updateStockQuery, [quantity, material_id]);

    await client.query('COMMIT');

    // Fetch thêm tên material để trả về
    const finalRes = await pool.query('SELECT name as material_name, unit FROM materials WHERE id = $1', [material_id]);
    
    return NextResponse.json({
      ...transaction,
      material_name: finalRes.rows[0].material_name,
      unit: finalRes.rows[0].unit
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return NextResponse.json({ error: 'Lỗi server nội bộ' }, { status: 500 });
  } finally {
    client.release();
  }
}
