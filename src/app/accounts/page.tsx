import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import MainLayout from '@/components/MainLayout';
import AccountsClient from './AccountsClient';
import pool from '@/lib/db';

export default async function AccountsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token');

  if (!token) redirect('/login');

  let user = null;
  try {
    user = JSON.parse(token.value);
  } catch (e) {
    redirect('/login');
  }

  let initialAccounts = [];
  try {
    const result = await pool.query('SELECT * FROM accounts ORDER BY account_code ASC');
    initialAccounts = result.rows;
  } catch (e) {
    console.error('Error fetching accounts for page:', e);
  }

  return (
    <MainLayout user={user} title="Danh mục tài khoản">
      <AccountsClient initialAccounts={initialAccounts} />
    </MainLayout>
  );
}
