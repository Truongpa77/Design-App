import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) + 1 as next_num FROM quotations`
    );
    const nextNum = parseInt(result.rows[0].next_num);
    const document_no = `PN${String(nextNum).padStart(4, '0')}`;
    return NextResponse.json({ document_no });
  } catch (error) {
    console.error('Lỗi khi lấy số báo giá tiếp theo:', error);
    return NextResponse.json({ error: 'Lỗi server nội bộ' }, { status: 500 });
  }
}
