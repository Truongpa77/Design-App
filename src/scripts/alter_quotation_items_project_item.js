const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5433', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function migrate() {
  try {
    console.log('Bắt đầu cập nhật cấu trúc bảng quotation_items...');

    // Thêm cột project_item_id vào bảng quotation_items
    await pool.query(`
      ALTER TABLE quotation_items 
      ADD COLUMN IF NOT EXISTS project_item_id INTEGER REFERENCES projects(id) ON DELETE SET NULL;
    `);
    console.log('Đã thêm cột project_item_id vào bảng quotation_items thành công!');
  } catch (err) {
    console.error('Lỗi khi cập nhật bảng quotation_items:', err);
  } finally {
    await pool.end();
  }
}

migrate();
