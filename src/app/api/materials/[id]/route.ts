import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID không hợp lệ' }, { status: 400 });
    }

    const { name, type, length, width, thickness, unit, unit_price, material_code } = await request.json();
    if (!name || !unit_price) {
      return NextResponse.json({ error: 'Vui lòng nhập tên và đơn giá' }, { status: 400 });
    }

    const query = `
      UPDATE materials 
      SET name = $1, type = $2, length = $3, width = $4, thickness = $5, unit = $6, unit_price = $7, material_code = $8, updated_at = NOW()
      WHERE id = $9 
      RETURNING *
    `;
    const result = await pool.query(query, [name, type, length, width, thickness, unit, unit_price, material_code || null, id]);
    
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Không tìm thấy vật tư' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating material:', error);
    return NextResponse.json({ error: 'Lỗi server nội bộ' }, { status: 500 });
  }
}
