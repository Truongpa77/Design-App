import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import MainLayout from '@/components/MainLayout';
import OpeningStockClient from '@/app/synthesis/opening-stock/OpeningStockClient';
import pool from '@/lib/db';

export default async function OpeningStockPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token');

  if (!token) redirect('/login');

  let user = null;
  try {
    user = JSON.parse(token.value);
  } catch (e) {
    redirect('/login');
  }

  let warehouses = [];
  let materials = [];

  try {
    const [wRes, mRes] = await Promise.all([
      pool.query('SELECT * FROM warehouses ORDER BY warehouse_code ASC'),
      pool.query('SELECT id, material_code, name, unit, unit_price, type FROM materials ORDER BY name ASC'),
    ]);
    warehouses = wRes.rows;
    materials = mRes.rows;
  } catch (e) {
    console.error('Error fetching warehouses/materials in page:', e);
  }

  return (
    <MainLayout user={user} title="Tồn kho đầu kỳ">
      <OpeningStockClient warehouses={warehouses} materials={materials} />
    </MainLayout>
  );
}
