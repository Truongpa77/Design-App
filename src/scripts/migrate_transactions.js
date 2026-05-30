const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function migrate() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5433', 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  try {
    await client.connect();
    console.log('✅ Kết nối cơ sở dữ liệu thành công.');

    // 1. Chèn tài khoản 131 và 511 vào bảng accounts nếu chưa tồn tại
    console.log('⏳ Đang tạo các tài khoản kế toán liên quan (131, 511)...');
    await client.query(`
      INSERT INTO accounts 
        (account_code, account_name, parent_code, track_foreign_currency, track_object_debt, track_project_cost, is_ledger, is_bank, is_long_term, debt_increase_side, is_active)
      VALUES 
        ('131', 'Phải thu của khách hàng', NULL, FALSE, TRUE, FALSE, TRUE, FALSE, FALSE, 'debit', TRUE),
        ('511', 'Doanh thu bán hàng và cung cấp dịch vụ', NULL, FALSE, FALSE, FALSE, TRUE, FALSE, FALSE, 'credit', TRUE)
      ON CONFLICT (account_code) DO NOTHING;
    `);
    console.log('✅ Các tài khoản kế toán 131 và 511 đã sẵn sàng.');

    // 2. Tạo bảng transactions
    console.log('⏳ Đang tạo bảng transactions...');
    await client.query(`
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
    console.log('✅ Tạo bảng transactions thành công.');

    // 3. Seed dữ liệu mẫu cho transactions
    console.log('⏳ Đang seed dữ liệu mẫu cho transactions...');
    await client.query(`
      INSERT INTO transactions (transaction_code, transaction_name, debit_account, credit_account, is_active)
      VALUES ('131', 'Bán hàng công nợ', '131', '511', TRUE)
      ON CONFLICT (transaction_code) DO NOTHING;
    `);
    console.log('✅ Đã seed giao dịch mẫu: 131 - Bán hàng công nợ.');

    // 4. Seed cấu hình lookup_configs cho transactions
    console.log('⏳ Đang cấu hình lookup_configs cho transactions...');
    await client.query(`
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
    console.log('✅ Cấu hình lookup_configs thành công.');

    // 5. Thêm menu "/transactions" dưới mục cha "DANH MỤC"
    console.log('⏳ Đang đăng ký menu Danh mục giao dịch...');
    const parentRes = await client.query(
      "SELECT id FROM layout_details WHERE title = 'DANH MỤC' AND parent_id IS NULL AND layout_id = 'admin'"
    );

    if (parentRes.rows.length > 0) {
      const parentId = parentRes.rows[0].id;
      // Kiểm tra xem menu đã có chưa
      const menuCheck = await client.query(
        "SELECT id FROM layout_details WHERE path = '/transactions' AND layout_id = 'admin'"
      );

      if (menuCheck.rows.length === 0) {
        // Lấy sort_order cao nhất hiện tại của danh mục con
        const maxSortRes = await client.query(
          "SELECT COALESCE(MAX(sort_order), 0) as max_order FROM layout_details WHERE parent_id = $1",
          [parentId]
        );
        const nextSort = maxSortRes.rows[0].max_order + 1;

        await client.query(
          `INSERT INTO layout_details (parent_id, sort_order, title, icon, path, layout_id, show_in_menu, show_in_submenu) 
           VALUES ($1, $2, 'Danh mục giao dịch', '🔄', '/transactions', 'admin', true, true)`,
          [parentId, nextSort]
        );
        console.log('✅ Đăng ký menu Danh mục giao dịch vào Sidebar thành công.');
      } else {
        console.log('ℹ️ Menu Danh mục giao dịch đã tồn tại.');
      }
    } else {
      console.log('⚠️ Không tìm thấy menu cha DANH MỤC, bỏ qua đăng ký menu.');
    }

    console.log('🎉 Hoàn thành di chuyển cơ sở dữ liệu thành công!');
  } catch (err) {
    console.error('❌ Lỗi di chuyển cơ sở dữ liệu:', err);
  } finally {
    await client.end();
  }
}

migrate();
