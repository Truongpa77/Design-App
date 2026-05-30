import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import MainLayout from '@/components/MainLayout';
import MaterialsClient from './MaterialsClient';
import pool from '@/lib/db';

export default async function MaterialsPage() {
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
  let initialMaterials = [];
  try {
    const res = await pool.query('SELECT * FROM materials ORDER BY created_at DESC');
    initialMaterials = res.rows;
  } catch (e) {
    console.error(e);
  }

  return (
    <MainLayout user={user} title="Danh mục Sản phẩm & Vật tư">
      <MaterialsClient initialData={initialMaterials} />
    </MainLayout>
  );
}
