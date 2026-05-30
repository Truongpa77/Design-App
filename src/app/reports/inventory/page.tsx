import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import MainLayout from '@/components/MainLayout';
import pool from '@/lib/db';
import InventoryReportClient from './InventoryReportClient';

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

  let materials = [];
  let warehouses = [];

  try {
    const [mRes, wRes] = await Promise.all([
      pool.query('SELECT id, name, material_code, unit, unit_price FROM materials ORDER BY name ASC'),
      pool.query('SELECT id, warehouse_code, warehouse_name FROM warehouses ORDER BY warehouse_code ASC')
    ]);
    materials = mRes.rows;
    warehouses = wRes.rows;
  } catch (e) {
    console.error('Error loading inventory report filters:', e);
  }

  return (
    <MainLayout user={user} title="Báo cáo nhập xuất tồn">
      <InventoryReportClient 
        materials={materials}
        warehouses={warehouses}
      />
    </MainLayout>
  );
}