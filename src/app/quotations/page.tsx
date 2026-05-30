import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import MainLayout from '@/components/MainLayout';
import QuotationsClient from './QuotationsClient';
import pool from '@/lib/db';

export default async function QuotationsPage() {
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

  // Fetch initial data
  let quotations = [];
  let customers = [];
  let materials = [];
  let projects = [];
  try {
    const resQ = await pool.query(`
      SELECT q.*, c.name as customer_name, p.name as selected_project_name, pi.name as selected_project_item_name
      FROM quotations q
      LEFT JOIN customers c ON q.customer_id = c.id
      LEFT JOIN projects p ON q.project_id = p.id
      LEFT JOIN projects pi ON q.project_item_id = pi.id
      ORDER BY q.created_at DESC
    `);
    quotations = resQ.rows;

    const resC = await pool.query('SELECT id, name FROM customers ORDER BY name ASC');
    customers = resC.rows;

    const resM = await pool.query('SELECT * FROM materials ORDER BY name ASC');
    materials = resM.rows;

    const resP = await pool.query('SELECT p.*, parent.name as parent_name FROM projects p LEFT JOIN projects parent ON p.parent_id = parent.id ORDER BY name ASC');
    projects = resP.rows;
  } catch (e) {
    console.error(e);
  }

  return (
    <MainLayout user={user} title="Quản lý Báo giá">
      <QuotationsClient initialData={quotations} customers={customers} materials={materials} projects={projects} />
    </MainLayout>
  );
}
