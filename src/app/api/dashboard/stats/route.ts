import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const customersRes = await pool.query('SELECT COUNT(*) FROM customers');
    const materialsRes = await pool.query('SELECT COUNT(*) FROM materials');
    const warehouseRes = await pool.query('SELECT COUNT(*) FROM warehouse_transactions');
    const quotationsRes = await pool.query('SELECT COUNT(*) FROM quotations');

    return NextResponse.json({
      customers: parseInt(customersRes.rows[0].count, 10),
      materials: parseInt(materialsRes.rows[0].count, 10),
      warehouse: parseInt(warehouseRes.rows[0].count, 10),
      quotations: parseInt(quotationsRes.rows[0].count, 10),
    });
  } catch (error) {
    console.error('Stats fetch error:', error);
    return NextResponse.json({ error: 'Lỗi server nội bộ' }, { status: 500 });
  }
}
