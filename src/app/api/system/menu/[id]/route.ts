import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await request.json();
    const { title, icon, path, is_active } = data;

    if (!title) {
      return NextResponse.json({ error: 'Vui lòng nhập tên hiển thị' }, { status: 400 });
    }

    const query = `
      UPDATE layout_details
      SET title = $1, icon = $2, path = $3, is_active = $4
      WHERE id = $5
      RETURNING id, parent_id, sort_order, title, icon, path, is_active
    `;
    const values = [
      title.trim(),
      icon || '📁',
      path ? path.trim() : null,
      is_active !== undefined ? is_active : true,
      parseInt(id, 10)
    ];

    const result = await pool.query(query, values);
    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Không tìm thấy node menu' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    console.error('Error updating menu node:', error);
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Đường dẫn (path) này đã tồn tại' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Lỗi server khi cập nhật node menu' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const query = 'DELETE FROM layout_details WHERE id = $1 RETURNING id';
    const result = await pool.query(query, [parseInt(id, 10)]);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Không tìm thấy node menu' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Xóa node menu thành công', id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting menu node:', error);
    return NextResponse.json({ error: 'Lỗi server khi xóa node menu' }, { status: 500 });
  }
}
