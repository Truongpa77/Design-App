import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import MainLayout from '@/components/MainLayout';
import pool from '@/lib/db';
import CashbookReportClient from './CashbookReportClient';

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

  let accounts = [];

  try {
    const res = await pool.query('SELECT account_code, account_name FROM accounts ORDER BY account_code ASC');
    accounts = res.rows;
  } catch (e) {
    console.error('Error loading cashbook accounts:', e);
  }

  return (
    <MainLayout user={user} title="Số quỹ hoặc sổ ngân hàng">
      <CashbookReportClient 
        accounts={accounts}
      />
    </MainLayout>
  );
}
