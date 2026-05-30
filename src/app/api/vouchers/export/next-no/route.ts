import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// Tra ve so phieu ke tiep (PX)
export async function GET() {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) + 1 as next_num FROM warehouse_documents WHERE type = 'export'`
    );
    const nextNum = parseInt(result.rows[0].next_num);
    const document_no = `PX${String(nextNum).padStart(4, '0')}`;
    return NextResponse.json({ document_no });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Loi server' }, { status: 500 });
  }
}
