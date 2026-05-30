import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import MainLayout from '@/components/MainLayout';
import MenuConfigClient from './MenuConfigClient';

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

  // Chỉ cho phép admin truy cập trang quản lý menu
  if (user?.role !== 'admin') {
    redirect('/'); // Quay về trang chủ nếu không phải admin
  }

  return (
    <MainLayout user={user} title="Quản lý cấu trúc Menu (Dynamic)">
      <MenuConfigClient />
    </MainLayout>
  );
}
