import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const query = `
      SELECT p.*, parent.name as parent_name 
      FROM projects p
      LEFT JOIN projects parent ON p.parent_id = parent.id
      ORDER BY p.created_at DESC
    `;
    const result = await pool.query(query);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json({ error: 'Lỗi server nội bộ' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { code, name, type, parent_id, notes } = data;

    if (!code || !name || !type) {
      return NextResponse.json({ error: 'Vui lòng nhập mã, tên và phân loại' }, { status: 400 });
    }

    // Check unique code
    const checkCode = await pool.query('SELECT id FROM projects WHERE code = $1', [code]);
    if (checkCode.rowCount && checkCode.rowCount > 0) {
      return NextResponse.json({ error: 'Mã công trình/hạng mục đã tồn tại' }, { status: 400 });
    }

    const query = `
      INSERT INTO projects (code, name, type, parent_id, notes) 
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `;
    const result = await pool.query(query, [
      code,
      name,
      type,
      type === 'Hạng mục' && parent_id ? parseInt(parent_id) : null,
      notes || null
    ]);

    // Return the inserted row joined with parent name if applicable
    const insertedId = result.rows[0].id;
    const selectQuery = `
      SELECT p.*, parent.name as parent_name 
      FROM projects p
      LEFT JOIN projects parent ON p.parent_id = parent.id
      WHERE p.id = $1
    `;
    const finalResult = await pool.query(selectQuery, [insertedId]);

    return NextResponse.json(finalResult.rows[0]);
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json({ error: 'Lỗi server nội bộ' }, { status: 500 });
  }
}
