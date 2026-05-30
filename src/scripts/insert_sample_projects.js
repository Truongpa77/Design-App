const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5433', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function run() {
  try {
    console.log('Inserting sample projects and categories...');

    // Delete existing projects
    await pool.query('DELETE FROM projects');

    // 1. Insert Projects (Công trình)
    const p1 = await pool.query(`
      INSERT INTO projects (code, name, type, notes)
      VALUES ($1, $2, $3, $4) RETURNING id
    `, ['CT-GD01', 'Chung cư Golden Land', 'Công trình', 'Dự án căn hộ mẫu 3 phòng ngủ']);
    const ct1Id = p1.rows[0].id;

    const p2 = await pool.query(`
      INSERT INTO projects (code, name, type, notes)
      VALUES ($1, $2, $3, $4) RETURNING id
    `, ['CT-VP02', 'Văn phòng Công ty Techcom', 'Công trình', 'Thiết kế văn phòng làm việc và pantry']);
    const ct2Id = p2.rows[0].id;

    // 2. Insert Categories (Hạng mục) belonging to CT-GD01
    await pool.query(`
      INSERT INTO projects (code, name, type, parent_id, notes)
      VALUES ($1, $2, $3, $4, $5)
    `, ['HM-PK', 'Nội thất phòng khách', 'Hạng mục', ct1Id, 'Bàn ghế sofa, kệ tivi, tủ trang trí']);

    await pool.query(`
      INSERT INTO projects (code, name, type, parent_id, notes)
      VALUES ($1, $2, $3, $4, $5)
    `, ['HM-PN', 'Nội thất phòng ngủ Master', 'Hạng mục', ct1Id, 'Giường ngủ, tủ quần áo, bàn trang điểm']);

    // 3. Insert Categories (Hạng mục) belonging to CT-VP02
    await pool.query(`
      INSERT INTO projects (code, name, type, parent_id, notes)
      VALUES ($1, $2, $3, $4, $5)
    `, ['HM-LH', 'Khu vực làm việc chung', 'Hạng mục', ct2Id, 'Bàn làm việc nhân viên, tủ tài liệu']);

    await pool.query(`
      INSERT INTO projects (code, name, type, parent_id, notes)
      VALUES ($1, $2, $3, $4, $5)
    `, ['HM-PT', 'Khu vực Pantry', 'Hạng mục', ct2Id, 'Tủ bếp pantry, quầy bar, bàn ghế ăn']);

    console.log('Sample projects and categories inserted successfully!');
  } catch (err) {
    console.error('Error inserting sample data:', err);
  } finally {
    await pool.end();
  }
}

run();
