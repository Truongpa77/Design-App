import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const result = await pool.query('SELECT * FROM customers ORDER BY created_at DESC');
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json({ error: 'Lỗi server nội bộ' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, phone, email, address } = await request.json();
    if (!name) {
      return NextResponse.json({ error: 'Vui lòng nhập tên khách hàng' }, { status: 400 });
    }

    const query = 'INSERT INTO customers (name, phone, email, address) VALUES ($1, $2, $3, $4) RETURNING *';
    const result = await pool.query(query, [name, phone, email, address]);
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating customer:', error);
    return NextResponse.json({ error: 'Lỗi server nội bộ' }, { status: 500 });
  }
}
