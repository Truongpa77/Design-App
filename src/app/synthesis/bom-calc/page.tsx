import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import MainLayout from '@/components/MainLayout';
import BomCalcClient from './BomCalcClient';
import pool from '@/lib/db';

export default async function BomCalcPage() {
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

  // Lấy danh sách báo giá cho bộ lọc dropdown
  let quotations = [];
  try {
    const qListQuery = `
      SELECT q.id, q.document_no, q.quotation_date, q.total_price, q.status, c.name as customer_name, q.project_name
      FROM quotations q
      LEFT JOIN customers c ON q.customer_id = c.id
      ORDER BY q.quotation_date DESC, q.id DESC
    `;
    const qListRes = await pool.query(qListQuery);
    quotations = qListRes.rows.map(r => ({
      ...r,
      total_price: Number(r.total_price),
      quotation_date: r.quotation_date ? r.quotation_date.toISOString() : ''
    }));
  } catch (e) {
    console.error('Lỗi khi tải danh sách báo giá:', e);
  }

  return (
    <MainLayout user={user} title="Tính Nhu Cầu Mua">
      <BomCalcClient initialQuotations={quotations} />
    </MainLayout>
  );
}