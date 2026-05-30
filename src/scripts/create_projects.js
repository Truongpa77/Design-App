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
    console.log('Bắt đầu cập nhật cấu trúc CSDL cho Công trình & Hạng mục...');

    // 1. Tạo bảng projects
    await pool.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL, -- 'Công trình' hoặc 'Hạng mục'
        parent_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Đã tạo bảng projects (nếu chưa có).');

    // 2. Thêm cột parent_id nếu chưa có (để đề phòng lỗi cấu trúc)
    await pool.query(`
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES projects(id) ON DELETE CASCADE;
    `);

    // 3. Thêm cột project_id và project_item_id vào bảng quotations
    await pool.query(`
      ALTER TABLE quotations 
      ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS project_item_id INTEGER REFERENCES projects(id) ON DELETE SET NULL;
    `);
    console.log('Đã cập nhật bảng quotations với các trường project_id và project_item_id.');

    console.log('Hoàn thành di chuyển cơ sở dữ liệu thành công!');
  } catch (err) {
    console.error('Lỗi khi cập nhật cơ sở dữ liệu:', err);
  } finally {
    await pool.end();
  }
}

migrate();
