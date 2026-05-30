import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fromDate = searchParams.get('from_date');
  const toDate = searchParams.get('to_date');
  const quotationId = searchParams.get('quotation_id');

  if (!fromDate || !toDate) {
    return NextResponse.json({ error: 'Thiếu tham số từ ngày, đến ngày' }, { status: 400 });
  }

  try {
    const query = `
      SELECT * FROM get_material_requirements($1, $2, $3)
      ORDER BY project_name, project_item_name, product_name, material_name
    `;
    const params = [
      `${fromDate} 00:00:00`,
      `${toDate} 23:59:59`,
      quotationId && quotationId !== '' ? Number(quotationId) : null
    ];
    const result = await pool.query(query, params);
    return NextResponse.json(result.rows);
  } catch (error: any) {
    console.error('API Material requirements error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
