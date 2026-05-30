import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await pool.query(
      'SELECT id, title, icon, path, created_at FROM features ORDER BY title ASC, id ASC'
    );
    return NextResponse.json(result.rows, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error) {
    console.error('Error fetching master features:', error);
    return NextResponse.json({ error: 'Lỗi server khi lấy danh sách tính năng' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { title, icon, path } = data;

    if (!title || !path) {
      return NextResponse.json({ error: 'Vui lòng cung cấp tên hiển thị và đường dẫn' }, { status: 400 });
    }

    const trimmedPath = path.trim();
    if (!trimmedPath.startsWith('/')) {
      return NextResponse.json({ error: 'Đường dẫn phải bắt đầu bằng ký tự /' }, { status: 400 });
    }

    // Check if feature path already exists
    const checkRes = await pool.query('SELECT 1 FROM features WHERE path = $1', [trimmedPath]);
    if (checkRes.rowCount && checkRes.rowCount > 0) {
      return NextResponse.json({ error: 'Đường dẫn (path) này đã tồn tại trong danh mục tính năng' }, { status: 400 });
    }

    const query = `
      INSERT INTO features (title, icon, path)
      VALUES ($1, $2, $3)
      RETURNING id, title, icon, path, created_at
    `;
    const values = [title.trim(), icon || '📋', trimmedPath];
    const result = await pool.query(query, values);

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating master feature:', error);
    return NextResponse.json({ error: 'Lỗi server khi tạo tính năng' }, { status: 500 });
  }
}
