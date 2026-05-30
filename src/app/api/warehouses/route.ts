import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const result = await pool.query('SELECT * FROM warehouses ORDER BY warehouse_code ASC');
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Loi server noi bo' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { warehouse_code, warehouse_name, description } = await request.json();
    if (!warehouse_code || !warehouse_name) {
      return NextResponse.json({ error: 'Vui long nhap Ma kho va Ten kho' }, { status: 400 });
    }
    const result = await pool.query(
      'INSERT INTO warehouses (warehouse_code, warehouse_name, description) VALUES ($1, $2, $3) RETURNING *',
      [warehouse_code.trim().toUpperCase(), warehouse_name.trim(), description || null]
    );
    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    console.error(error);
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Ma kho da ton tai' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Loi server noi bo' }, { status: 500 });
  }
}
