import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import MainLayout from '@/components/MainLayout';
import VoucherExportClient from './VoucherExportClient';
import pool from '@/lib/db';

export default async function VoucherExportPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token');
  if (!token) redirect('/login');

  let user = null;
  try { user = JSON.parse(token.value); } catch (e) { redirect('/login'); }

  let vouchers = [], materials = [], warehouses = [], customers = [];
  try {
    const [vRes, mRes, wRes, cRes] = await Promise.all([
      pool.query(`
        SELECT d.*,
          (SELECT COUNT(*) FROM warehouse_details WHERE document_id = d.id) as item_count
        FROM warehouse_documents d
        WHERE d.type = 'export'
        ORDER BY d.document_date DESC, d.created_at DESC
      `),
      pool.query('SELECT id, material_code, name, unit, unit_price, stock_quantity FROM materials ORDER BY name ASC'),
      pool.query('SELECT id, warehouse_code, warehouse_name FROM warehouses ORDER BY warehouse_code ASC'),
      pool.query('SELECT id, name, phone, address FROM customers ORDER BY name ASC'),
    ]);
    vouchers = vRes.rows;
    materials = mRes.rows;
    warehouses = wRes.rows;
    customers = cRes.rows;
  } catch (e) {
    console.error(e);
  }

  return (
    <MainLayout user={user} title="Phieu Xuat Kho">
      <VoucherExportClient
        initialData={vouchers}
        materials={materials}
        warehouses={warehouses}
        customers={customers}
      />
    </MainLayout>
  );
}