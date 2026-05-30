import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import MainLayout from '@/components/MainLayout';
import pool from '@/lib/db';
import UsersClient from './UsersClient';

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token');
  if (!token) redirect('/login');

  let user = null;
  try {
    user = JSON.parse(token.value);
  } catch (e) {
    redirect('/login');
  }

  // Chỉ cho phép admin truy cập trang quản lý người dùng
  if (user?.role !== 'admin') {
    redirect('/'); // Quay về trang chủ nếu không phải admin
  }

  let initialUsers = [];
  try {
    const result = await pool.query('SELECT id, username, role, created_at FROM users ORDER BY username ASC');
    initialUsers = result.rows.map(row => ({
      ...row,
      created_at: row.created_at ? row.created_at.toISOString() : null
    }));
  } catch (e) {
    console.error('Error fetching users:', e);
  }

  return (
    <MainLayout user={user} title="Quản lý người sử dụng">
      <UsersClient initialUsers={initialUsers} currentUser={user} />
    </MainLayout>
  );
}