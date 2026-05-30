import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { cookies } from 'next/headers';
import { hashPassword } from '@/lib/auth';

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

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminUser = await checkAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Quyền truy cập bị từ chối' }, { status: 403 });
  }

  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID không hợp lệ' }, { status: 400 });
    }

    const data = await request.json();
    const { username, role, password } = data;

    if (!username) {
      return NextResponse.json({ error: 'Tên đăng nhập không được để trống' }, { status: 400 });
    }

    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername.length < 3) {
      return NextResponse.json({ error: 'Tên đăng nhập phải có ít nhất 3 ký tự' }, { status: 400 });
    }

    // 1. Kiểm tra trùng lặp tên đăng nhập với ID khác
    const checkDup = await pool.query('SELECT id FROM users WHERE username = $1 AND id <> $2', [cleanUsername, id]);
    if (checkDup.rows.length > 0) {
      return NextResponse.json({ error: `Tên đăng nhập "${cleanUsername}" đã tồn tại` }, { status: 400 });
    }

    // 2. Lấy thông tin user hiện tại để kiểm tra
    const userQuery = await pool.query('SELECT id, role FROM users WHERE id = $1', [id]);
    if (userQuery.rowCount === 0) {
      return NextResponse.json({ error: 'Không tìm thấy người sử dụng' }, { status: 404 });
    }
    const targetUser = userQuery.rows[0];

    // Ngăn chặn admin tự hạ quyền của chính mình
    if (id === adminUser.id && role !== 'admin') {
      return NextResponse.json({ error: 'Bạn không thể tự hạ quyền quản trị viên của chính mình' }, { status: 400 });
    }

    let query: string;
    let queryParams: any[];

    if (password && password.trim().length > 0) {
      if (password.length < 4) {
        return NextResponse.json({ error: 'Mật khẩu phải có ít nhất 4 ký tự' }, { status: 400 });
      }
      const hashedPassword = hashPassword(password);
      query = `
        UPDATE users 
        SET username = $1, role = $2, password_hash = $3
        WHERE id = $4
        RETURNING id, username, role, created_at
      `;
      queryParams = [cleanUsername, role === 'admin' ? 'admin' : 'user', hashedPassword, id];
    } else {
      query = `
        UPDATE users 
        SET username = $1, role = $2
        WHERE id = $3
        RETURNING id, username, role, created_at
      `;
      queryParams = [cleanUsername, role === 'admin' ? 'admin' : 'user', id];
    }

    const result = await pool.query(query, queryParams);
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Lỗi server nội bộ' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminUser = await checkAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Quyền truy cập bị từ chối' }, { status: 403 });
  }

  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID không hợp lệ' }, { status: 400 });
    }

    // Ngăn chặn admin tự xóa chính mình
    if (id === adminUser.id) {
      return NextResponse.json({ error: 'Bạn không thể tự xóa tài khoản đang đăng nhập' }, { status: 400 });
    }

    // Thực hiện xóa
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id, username', [id]);
    
    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Không tìm thấy người sử dụng để xóa' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: `Đã xóa tài khoản "${result.rows[0].username}"` });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Lỗi server nội bộ' }, { status: 500 });
  }
}
