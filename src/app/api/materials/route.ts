import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const result = await pool.query('SELECT * FROM materials ORDER BY created_at DESC');
    return NextResponse.json(result.rows);
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi server nội bộ' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { name, type, length, width, thickness, unit, unit_price, material_code } = data;
    
    if (!name || !type || unit_price === undefined) {
      return NextResponse.json({ error: 'Vui lòng nhập tên, loại và đơn giá' }, { status: 400 });
    }

    const query = `
      INSERT INTO materials (name, type, length, width, thickness, unit, unit_price, material_code) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
    `;
    const result = await pool.query(query, [
      name, type, 
      length || null, width || null, thickness || null, 
      unit, unit_price,
      material_code || null
    ]);
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi server nội bộ' }, { status: 500 });
  }
}
