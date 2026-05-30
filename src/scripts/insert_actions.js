const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function insertActions() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5433', 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  try {
    await client.connect();
    console.log('✅ Kết nối DB thành công');

    const actions = [
      // Actions for Receipt Voucher (Phiếu thu)
      { title: 'Thêm mới phiếu thu', icon: '➕', path: '/vouchers/receipt/create' },
      { title: 'Sửa phiếu thu',      icon: '✏️', path: '/vouchers/receipt/edit' },
      { title: 'Xóa phiếu thu',      icon: '🗑️', path: '/vouchers/receipt/delete' },

      // Actions for Payment Voucher (Phiếu chi)
      { title: 'Thêm mới phiếu chi', icon: '➕', path: '/vouchers/payment/create' },
      { title: 'Sửa phiếu chi',      icon: '✏️', path: '/vouchers/payment/edit' },
      { title: 'Xóa phiếu chi',      icon: '🗑️', path: '/vouchers/payment/delete' },
      
      // Other general actions
      { title: 'Thêm mới khách hàng', icon: '➕', path: '/customers/create' },
      { title: 'Sửa khách hàng',      icon: '✏️', path: '/customers/edit' },
      { title: 'Xóa khách hàng',      icon: '🗑️', path: '/customers/delete' },
    ];

    for (const item of actions) {
      // Kiểm tra xem đã tồn tại chưa bằng path
      const check = await client.query('SELECT 1 FROM layout_details WHERE path = $1 AND layout_id = \'admin\'', [item.path]);
      if (check.rowCount === 0) {
        // Lấy sort_order cao nhất cho parent_id IS NULL để đưa vào cuối
        const orderRes = await client.query('SELECT COALESCE(MAX(sort_order), 0) as max_order FROM layout_details WHERE parent_id IS NULL AND layout_id = \'admin\'');
        const nextOrder = parseInt(orderRes.rows[0].max_order, 10) + 1;

        await client.query(
          `INSERT INTO layout_details (parent_id, sort_order, title, icon, path, is_active, layout_id, show_in_menu, show_in_submenu)
           VALUES (NULL, $1, $2, $3, $4, false, 'admin', true, true)`,
          [nextOrder, item.title, item.icon, item.path]
        );
        console.log(`🌱 Đã thêm hành động: "${item.title}" (Chờ kích hoạt)`);
      } else {
        console.log(`⚠️ Hành động "${item.title}" đã tồn tại, bỏ qua.`);
      }
    }

    console.log('✅ Hoàn tất nạp dữ liệu hành động mẫu!');
  } catch (err) {
    console.error('❌ Lỗi:', err);
  } finally {
    await client.end();
  }
}

insertActions();
