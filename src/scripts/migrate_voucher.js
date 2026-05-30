const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5433'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const sql = `
  -- Them cot material_code vao materials
  ALTER TABLE materials ADD COLUMN IF NOT EXISTS material_code VARCHAR(50);

  -- Them cac cot tong hop vao warehouse_documents
  ALTER TABLE warehouse_documents ADD COLUMN IF NOT EXISTS subtotal_amount NUMERIC DEFAULT 0;
  ALTER TABLE warehouse_documents ADD COLUMN IF NOT EXISTS tax_amount NUMERIC DEFAULT 0;

  -- Them cot tien hang (truoc thue) vao warehouse_details
  ALTER TABLE warehouse_details ADD COLUMN IF NOT EXISTS line_amount NUMERIC DEFAULT 0;
`;

pool.query(sql)
  .then(() => { console.log('OK: Migration thanh cong'); pool.end(); })
  .catch(e => { console.error('ERROR:', e.message); pool.end(); });
