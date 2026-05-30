import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID không hợp lệ' }, { status: 400 });
    }

    const { name, phone, email, address } = await request.json();
    if (!name) {
      return NextResponse.json({ error: 'Vui lòng nhập tên khách hàng' }, { status: 400 });
    }

    const query = `
      UPDATE customers 
      SET name = $1, phone = $2, email = $3, address = $4, updated_at = NOW()
      WHERE id = $5 
      RETURNING *
    `;
    const result = await pool.query(query, [name, phone, email, address, id]);
    
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Không tìm thấy khách hàng' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating customer:', error);
    return NextResponse.json({ error: 'Lỗi server nội bộ' }, { status: 500 });
  }
}
