import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import MainLayout from '@/components/MainLayout';
import OpeningBalancesClient from '@/app/synthesis/opening-balances/OpeningBalancesClient';
import pool from '@/lib/db';

export default async function OpeningBalancesPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token');

  if (!token) redirect('/login');

  let user = null;
  try {
    user = JSON.parse(token.value);
  } catch (e) {
    redirect('/login');
  }

  let activeAccounts = [];
  try {
    const result = await pool.query('SELECT * FROM accounts WHERE is_active = true ORDER BY account_code ASC');
    activeAccounts = result.rows;
  } catch (e) {
    console.error('Error fetching active accounts for opening balances page:', e);
  }

  return (
    <MainLayout user={user} title="Số dư đầu tài khoản">
      <OpeningBalancesClient activeAccounts={activeAccounts} />
    </MainLayout>
  );
}
