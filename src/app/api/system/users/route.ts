import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { cookies } from 'next/headers';
import { hashPassword } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Lấy thông tin user hiện tại và kiểm tra quyền admin
async function checkAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token');
  if (!token) return null;
  try {
    const user = JSON.parse(token.value);
    if (user && user.role === 'admin') {
      return user;
    }
  } catch (e) {
    return null;
  }
  return null;
}

export async function GET() {
  const adminUser = await checkAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Quyền truy cập bị từ chối' }, { status: 403 });
  }

  try {
    const result = await pool.query(
      'SELECT id, username, role, created_at FROM users ORDER BY username ASC'
    );
    return NextResponse.json(result.rows, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Lỗi server nội bộ' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const adminUser = await checkAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Quyền truy cập bị từ chối' }, { status: 403 });
  }

  try {
    const data = await request.json();
    const { username, password, role } = data;

    if (!username || !password) {
      return NextResponse.json({ error: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu' }, { status: 400 });
    }

    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername.length < 3) {
      return NextResponse.json({ error: 'Tên đăng nhập phải có ít nhất 3 ký tự' }, { status: 400 });
    }

    if (password.length < 4) {
      return NextResponse.json({ error: 'Mật khẩu phải có ít nhất 4 ký tự' }, { status: 400 });
    }

    // Kiểm tra trùng tên đăng nhập
    const checkDup = await pool.query('SELECT id FROM users WHERE username = $1', [cleanUsername]);
    if (checkDup.rows.length > 0) {
      return NextResponse.json({ error: `Tên đăng nhập "${cleanUsername}" đã tồn tại` }, { status: 400 });
    }

    const hashedPassword = hashPassword(password);
    const userRole = role === 'admin' ? 'admin' : 'user';

    const query = `
      INSERT INTO users (username, password_hash, role)
      VALUES ($1, $2, $3)
      RETURNING id, username, role, created_at
    `;
    const result = await pool.query(query, [cleanUsername, hashedPassword, userRole]);

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Lỗi server nội bộ' }, { status: 500 });
  }
}
