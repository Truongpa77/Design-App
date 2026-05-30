import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import MainLayout from '@/components/MainLayout';
import FinancialVoucherClient from '@/components/FinancialVoucherClient';
import pool from '@/lib/db';

export default async function ReceiptVoucherPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token');

  if (!token) redirect('/login');

  let user = null;
  try {
    user = JSON.parse(token.value);
  } catch (e) {
    redirect('/login');
  }

  let customers = [];
  let materials = [];
  let accounts = [];

  try {
    const [cRes, mRes, aRes] = await Promise.all([
      pool.query('SELECT id, name, phone, address FROM customers ORDER BY name ASC'),
      pool.query('SELECT id, material_code, name, unit, unit_price FROM materials ORDER BY name ASC'),
      pool.query('SELECT account_code, account_name FROM accounts WHERE is_active = true ORDER BY account_code ASC')
    ]);
    customers = cRes.rows;
    materials = mRes.rows;
    accounts = aRes.rows;
  } catch (e) {
    console.error('Error loading voucher assets:', e);
  }

  return (
    <MainLayout user={user} title="Phiếu thu">
      <FinancialVoucherClient 
        type="receipt" 
        title="Phiếu thu" 
        customers={customers} 
        materials={materials} 
        accounts={accounts} 
      />
    </MainLayout>
  );
}
