import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import MainLayout from '@/components/MainLayout';
import TransactionsClient from '@/app/transactions/TransactionsClient';
import pool from '@/lib/db';

export default async function TransactionsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token');

  if (!token) redirect('/login');

  let user = null;
  try {
    user = JSON.parse(token.value);
  } catch (e) {
    redirect('/login');
  }

  let initialTransactions = [];
  try {
    // Đảm bảo bảng transactions tồn tại (Auto migration khi load trang)
    const tableCheck = await pool.query(
      "SELECT 1 FROM information_schema.tables WHERE table_name = 'transactions'"
    );
    
    if (tableCheck.rows.length === 0) {
      console.log('⏳ Table "transactions" does not exist. Running auto migration in Page...');
      
      // 1. Seed standard accounts
      await pool.query(`
        INSERT INTO accounts 
          (account_code, account_name, parent_code, track_foreign_currency, track_object_debt, track_project_cost, is_ledger, is_bank, is_long_term, debt_increase_side, is_active)
        VALUES 
          ('131', 'Phải thu của khách hàng', NULL, FALSE, TRUE, FALSE, TRUE, FALSE, FALSE, 'debit', TRUE),
          ('511', 'Doanh thu bán hàng và cung cấp dịch vụ', NULL, FALSE, FALSE, FALSE, TRUE, FALSE, FALSE, 'credit', TRUE)
        ON CONFLICT (account_code) DO NOTHING;
      `);

      // 2. Create transactions table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS transactions (
          id SERIAL PRIMARY KEY,
          transaction_code VARCHAR(50) UNIQUE NOT NULL,
          transaction_name VARCHAR(255) NOT NULL,
          debit_account VARCHAR(50) REFERENCES accounts(account_code) ON DELETE SET NULL,
          credit_account VARCHAR(50) REFERENCES accounts(account_code) ON DELETE SET NULL,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 3. Seed example transaction
      await pool.query(`
        INSERT INTO transactions (transaction_code, transaction_name, debit_account, credit_account, is_active)
        VALUES ('131', 'Bán hàng công nợ', '131', '511', TRUE)
        ON CONFLICT (transaction_code) DO NOTHING;
      `);

      // 4. Seed lookup configuration
      await pool.query(`
        INSERT INTO lookup_configs 
          (lookup_key, table_name, value_field, display_field, sublabel_field, search_fields, additional_filter, parent_field)
        VALUES 
          ('transaction', 'transactions', 'transaction_code', 'transaction_name', 'transaction_code', ARRAY['transaction_code', 'transaction_name'], 'is_active = true', NULL)
        ON CONFLICT (lookup_key) DO UPDATE SET
          table_name = EXCLUDED.table_name,
          value_field = EXCLUDED.value_field,
          display_field = EXCLUDED.display_field,
          sublabel_field = EXCLUDED.sublabel_field,
          search_fields = EXCLUDED.search_fields,
          additional_filter = EXCLUDED.additional_filter,
          parent_field = EXCLUDED.parent_field;
      `);

      // 5. Add menu to Sidebar layout_details
      const parentRes = await pool.query(
        "SELECT id FROM layout_details WHERE title = 'DANH MỤC' AND parent_id IS NULL AND layout_id = 'admin'"
      );
      if (parentRes.rows.length > 0) {
        const parentId = parentRes.rows[0].id;
        const menuCheck = await pool.query(
          "SELECT id FROM layout_details WHERE path = '/transactions' AND layout_id = 'admin'"
        );
        if (menuCheck.rows.length === 0) {
          const maxSortRes = await pool.query(
            "SELECT COALESCE(MAX(sort_order), 0) as max_order FROM layout_details WHERE parent_id = $1",
            [parentId]
          );
          const nextSort = maxSortRes.rows[0].max_order + 1;
          await pool.query(
            `INSERT INTO layout_details (parent_id, sort_order, title, icon, path, layout_id, show_in_menu, show_in_submenu) 
             VALUES ($1, $2, 'Danh mục giao dịch', '🔄', '/transactions', 'admin', true, true)`,
            [parentId, nextSort]
          );
        }
      }

      // 6. Đăng ký vào bảng features phục vụ cấu hình phân quyền/menu
      await pool.query(`
        INSERT INTO features (title, icon, path)
        VALUES ('Danh mục giao dịch', '🔄', '/transactions')
        ON CONFLICT (path) DO NOTHING;
      `);

      console.log('✅ Page auto migration completed successfully!');
    }

    const result = await pool.query('SELECT * FROM transactions ORDER BY transaction_code ASC');
    initialTransactions = result.rows;
  } catch (error) {
    console.error('Error fetching transactions for page:', error);
  }

  return (
    <MainLayout user={user} title="Danh mục giao dịch">
      <TransactionsClient initialData={initialTransactions} />
    </MainLayout>
  );
}
