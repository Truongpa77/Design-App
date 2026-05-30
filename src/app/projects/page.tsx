import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import MainLayout from '@/components/MainLayout';
import ProjectsClient from './ProjectsClient';
import pool from '@/lib/db';

export default async function ProjectsPage() {
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

  // Fetch initial projects
  let initialProjects = [];
  try {
    const res = await pool.query(`
      SELECT p.*, parent.name as parent_name 
      FROM projects p
      LEFT JOIN projects parent ON p.parent_id = parent.id
      ORDER BY p.created_at DESC
    `);
    initialProjects = res.rows;
  } catch (e) {
    console.error(e);
  }

  return (
    <MainLayout user={user} title="Danh mục Công trình & Hạng mục">
      <ProjectsClient initialData={initialProjects} />
    </MainLayout>
  );
}
