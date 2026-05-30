import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await request.json();
    const { title, icon, path } = data;

    if (!title || !path) {
      return NextResponse.json({ error: 'Vui lòng điền đầy đủ thông tin' }, { status: 400 });
    }

    const trimmedPath = path.trim();
    if (!trimmedPath.startsWith('/')) {
      return NextResponse.json({ error: 'Đường dẫn phải bắt đầu bằng ký tự /' }, { status: 400 });
    }

    // Check if path is used by another feature
    const checkRes = await pool.query(
      'SELECT 1 FROM features WHERE path = $1 AND id <> $2',
      [trimmedPath, parseInt(id, 10)]
    );
    if (checkRes.rowCount && checkRes.rowCount > 0) {
      return NextResponse.json({ error: 'Đường dẫn (path) này đã được sử dụng bởi tính năng khác' }, { status: 400 });
    }

    const query = `
      UPDATE features
      SET title = $1, icon = $2, path = $3
      WHERE id = $4
      RETURNING id, title, icon, path, created_at
    `;
    const values = [title.trim(), icon || '📋', trimmedPath, parseInt(id, 10)];
    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Không tìm thấy tính năng' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating master feature:', error);
    return NextResponse.json({ error: 'Lỗi server khi cập nhật tính năng' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await pool.query(
      'DELETE FROM features WHERE id = $1 RETURNING id',
      [parseInt(id, 10)]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Không tìm thấy tính năng để xóa' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Đã xóa tính năng khỏi danh mục thành công' });
  } catch (error) {
    console.error('Error deleting master feature:', error);
    return NextResponse.json({ error: 'Lỗi server khi xóa tính năng' }, { status: 500 });
  }
}
