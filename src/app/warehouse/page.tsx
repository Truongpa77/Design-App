import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import MainLayout from '@/components/MainLayout';
import WarehouseClient from './WarehouseClient';
import pool from '@/lib/db';

export default async function WarehousePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token');

  if (!token) redirect('/login');

  let user = null;
  try {
    user = JSON.parse(token.value);
  } catch (e) {
    redirect('/login');
  }

  let initialWarehouses = [];
  try {
    const res = await pool.query('SELECT * FROM warehouses ORDER BY warehouse_code ASC');
    initialWarehouses = res.rows;
  } catch (e) {
    console.error(e);
  }

  return (
    <MainLayout user={user} title="Danh muc Kho">
      <WarehouseClient initialData={initialWarehouses} />
    </MainLayout>
  );
}
