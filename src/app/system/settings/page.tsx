import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import MainLayout from '@/components/MainLayout';
import SettingsClient from './SettingsClient';

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

  return (
    <MainLayout user={user} title="Thiết lập hệ thống">
      <SettingsClient />
    </MainLayout>
  );
}
