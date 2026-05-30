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
    console.log('Bắt đầu cập nhật cấu trúc bảng cho Báo giá...');

    // Cập nhật bảng quotations
    await pool.query(`
      ALTER TABLE quotations 
      ADD COLUMN IF NOT EXISTS document_no VARCHAR(100),
      ADD COLUMN IF NOT EXISTS project_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS partner_address TEXT;
    `);
    console.log('Đã cập nhật bảng quotations.');

    // Cập nhật bảng quotation_items
    await pool.query(`
      ALTER TABLE quotation_items 
      ADD COLUMN IF NOT EXISTS category VARCHAR(100),
      ADD COLUMN IF NOT EXISTS tax_percent NUMERIC DEFAULT 0,
      ADD COLUMN IF NOT EXISTS image_path TEXT;
    `);
    console.log('Đã cập nhật bảng quotation_items.');

    // Cập nhật dữ liệu cũ nếu cần
    // Ví dụ đặt document_no mặc định dựa trên id cho các báo giá cũ
    const res = await pool.query('SELECT id, document_no FROM quotations WHERE document_no IS NULL');
    for (const row of res.rows) {
      const docNo = `BG${String(row.id).padStart(4, '0')}`;
      await pool.query('UPDATE quotations SET document_no = $1 WHERE id = $2', [docNo, row.id]);
    }
    console.log(`Đã cập nhật số báo giá cho ${res.rowCount} bản ghi cũ.`);

    console.log('Hoàn thành cập nhật CSDL thành công!');
  } catch (err) {
    console.error('Lỗi khi cập nhật CSDL:', err);
  } finally {
    await pool.end();
  }
}

migrate();
