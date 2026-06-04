import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyPassword } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    console.log('Login request received for:', username);

    if (!username || !password) {
      return NextResponse.json({ error: 'Vui lòng nhập tên đăng nhập và mật khẩu' }, { status: 400 });
    }

    const query = 'SELECT id, username, password_hash, role FROM users WHERE username = $1';
    const result = await pool.query(query, [username]);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng' }, { status: 401 });
    }

    const user = result.rows[0];
    
    // Xác thực mật khẩu
    const isValid = verifyPassword(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng' }, { status: 401 });
    }


    // Set a simple cookie for authentication (In production, use JWT or proper session)
    (await cookies()).set('auth_token', JSON.stringify({ id: user.id, username: user.username, role: user.role }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 1 day
      path: '/',
    });

    return NextResponse.json({ success: true, user });
  } catch (error: any) {
    console.error('Login error:', error);
    
    // Diagnostic query inside catch block
    try {
      const dbRes = await pool.query('SELECT current_database(), current_user;');
      const tablesRes = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name;
      `);
      console.error('DIAGNOSTICS - Connected database:', dbRes.rows[0].current_database);
      console.error('DIAGNOSTICS - Connected user:', dbRes.rows[0].current_user);
      console.error('DIAGNOSTICS - Available tables:', tablesRes.rows.map(r => r.table_name).join(', '));
      console.error('DIAGNOSTICS - NEON_DATABASE_URL exists:', !!process.env.NEON_DATABASE_URL);
      console.error('DIAGNOSTICS - DATABASE_URL exists:', !!process.env.DATABASE_URL);
    } catch (diagErr: any) {
      console.error('DIAGNOSTICS FAILED:', diagErr.message || diagErr);
    }

    return NextResponse.json({ error: 'Lỗi server nội bộ' }, { status: 500 });
  }
}
