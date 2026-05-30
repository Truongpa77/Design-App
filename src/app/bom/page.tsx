import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import MainLayout from '@/components/MainLayout';
import BOMClient from './BOMClient';
import pool from '@/lib/db';

export default async function BOMPage() {
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

  // Lấy danh sách sản phẩm và vật tư
  let materials = [];
  try {
    const res = await pool.query('SELECT * FROM materials ORDER BY name ASC');
    materials = res.rows.map(r => ({
      ...r,
      length: r.length ? Number(r.length) : null,
      width: r.width ? Number(r.width) : null,
      thickness: r.thickness ? Number(r.thickness) : null,
      unit_price: Number(r.unit_price),
      stock_quantity: Number(r.stock_quantity)
    }));
  } catch (e) {
    console.error('Lỗi khi truy vấn danh sách vật tư:', e);
  }

  return (
    <MainLayout user={user} title="Định mức BOM tiêu chuẩn">
      <BOMClient initialMaterials={materials} />
    </MainLayout>
  );
}