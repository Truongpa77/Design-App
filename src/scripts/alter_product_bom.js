const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function migrate() {
  try {
    console.log('Bắt đầu cập nhật cấu trúc cơ sở dữ liệu...');

    // 1. Thêm cột mapping vào product_bom
    await pool.query(`
      ALTER TABLE product_bom 
      ADD COLUMN IF NOT EXISTS length_map VARCHAR(10) DEFAULT 'Fixed',
      ADD COLUMN IF NOT EXISTS width_map VARCHAR(10) DEFAULT 'Fixed';
    `);
    console.log('✅ Đã cập nhật các cột length_map, width_map trong bảng product_bom');

    // 2. Tạo bảng material_demands
    await pool.query(`
      CREATE TABLE IF NOT EXISTS material_demands (
        id SERIAL PRIMARY KEY,
        quotation_id INTEGER REFERENCES quotations(id) ON DELETE CASCADE,
        material_id INTEGER REFERENCES materials(id) ON DELETE CASCADE,
        calculated_quantity NUMERIC NOT NULL,
        custom_quantity NUMERIC,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(quotation_id, material_id)
      );
    `);
    console.log('✅ Đã tạo bảng material_demands');

    console.log('Cấu trúc cơ sở dữ liệu đã được cập nhật thành công!');
  } catch (err) {
    console.error('❌ Lỗi khi cập nhật cơ sở dữ liệu:', err);
  } finally {
    await pool.end();
  }
}

migrate();
