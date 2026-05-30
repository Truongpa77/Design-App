import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const docQuery = `SELECT * FROM warehouse_documents WHERE id = $1`;
    const docRes = await pool.query(docQuery, [params.id]);
    
    if (docRes.rows.length === 0) {
      return NextResponse.json({ error: 'Không tìm thấy phiếu' }, { status: 404 });
    }

    const document = docRes.rows[0];

    const detailQuery = `
      SELECT d.*, m.name as material_name, m.unit as material_unit
      FROM warehouse_details d
      JOIN materials m ON d.material_id = m.id
      WHERE d.document_id = $1
    `;
    const detailRes = await pool.query(detailQuery, [params.id]);
    
    document.items = detailRes.rows;

    return NextResponse.json(document);
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi server nội bộ' }, { status: 500 });
  }
}
