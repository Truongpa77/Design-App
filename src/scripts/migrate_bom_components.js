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
    console.log('Bắt đầu cập nhật cấu trúc bảng product_bom...');

    // Thêm các cột cho bảng product_bom
    await pool.query(`
      ALTER TABLE product_bom 
      ADD COLUMN IF NOT EXISTS component_name VARCHAR(100),
      ADD COLUMN IF NOT EXISTS length NUMERIC,
      ADD COLUMN IF NOT EXISTS width NUMERIC,
      ADD COLUMN IF NOT EXISTS quantity NUMERIC;
    `);
    console.log('Đã thêm các cột component_name, length, width, quantity vào bảng product_bom thành công!');
  } catch (err) {
    console.error('Lỗi khi cập nhật bảng product_bom:', err);
  } finally {
    await pool.end();
  }
}

migrate();
