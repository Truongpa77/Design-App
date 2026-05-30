import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await pool.query(
      'SELECT id, name, icon, is_system FROM layouts ORDER BY is_system DESC, id ASC'
    );
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching layouts:', error);
    return NextResponse.json({ error: 'Lỗi server khi lấy danh sách layouts' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { id, name, icon } = data;

    if (!id || !name) {
      return NextResponse.json({ error: 'Vui lòng cung cấp mã và tên layout' }, { status: 400 });
    }

    // Check if layout already exists
    const checkRes = await pool.query('SELECT 1 FROM layouts WHERE id = $1', [id]);
    if (checkRes.rowCount && checkRes.rowCount > 0) {
      return NextResponse.json({ error: 'Mã layout này đã tồn tại' }, { status: 400 });
    }

    const query = `
      INSERT INTO layouts (id, name, icon, is_system)
      VALUES ($1, $2, $3, false)
      RETURNING id, name, icon, is_system
    `;
    const values = [id.trim(), name.trim(), icon || '📋'];
    const result = await pool.query(query, values);
    
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating layout:', error);
    return NextResponse.json({ error: 'Lỗi server khi tạo layout' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Thiếu mã layout cần xóa' }, { status: 400 });
    }

    // Prevent deleting system layouts
    if (id === 'admin' || id === 'office' || id === 'design') {
      return NextResponse.json({ error: 'Không thể xóa các layout mặc định của hệ thống' }, { status: 400 });
    }

    const result = await pool.query('DELETE FROM layouts WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Không tìm thấy layout cần xóa' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Đã xóa layout thành công' });
  } catch (error) {
    console.error('Error deleting layout:', error);
    return NextResponse.json({ error: 'Lỗi server khi xóa layout' }, { status: 500 });
  }
}
