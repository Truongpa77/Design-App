const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function cleanupActions() {
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

    const res = await client.query(
      "DELETE FROM layout_details WHERE path LIKE '%/create' OR path LIKE '%/edit' OR path LIKE '%/delete'"
    );
    console.log(`🧹 Đã xóa ${res.rowCount} hành động mẫu cứng trong bảng layout_details.`);
    console.log('✅ Dọn dẹp hoàn tất!');
  } catch (err) {
    console.error('❌ Lỗi:', err);
  } finally {
    await client.end();
  }
}

cleanupActions();
