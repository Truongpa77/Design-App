import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import MainLayout from '@/components/MainLayout';
import CustomersClient from './CustomersClient';
import pool from '@/lib/db';

export default async function CustomersPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token');

  if (!token) {
    redirect('/login');
  }

  let user = null;
  try {
    user = JSON.parse(token.value);
  } catch (e) {
    redirect('/login');
  }

  // Fetch initial data
  let initialCustomers = [];
  try {
    const res = await pool.query('SELECT * FROM customers ORDER BY created_at DESC');
    initialCustomers = res.rows;
  } catch (e) {
    console.error(e);
  }

  return (
    <MainLayout user={user} title="Danh mục Khách hàng">
      <CustomersClient initialData={initialCustomers} />
    </MainLayout>
  );
}
