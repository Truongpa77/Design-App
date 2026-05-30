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
    console.log('Testing quotation items with project categories...');

    // 1. Get a project and its categories
    const projectRes = await pool.query("SELECT * FROM projects WHERE type = 'Công trình' LIMIT 1");
    if (projectRes.rows.length === 0) {
      throw new Error('Please run insert_sample_projects.js first');
    }
    const project = projectRes.rows[0];

    const categoriesRes = await pool.query("SELECT * FROM projects WHERE type = 'Hạng mục' AND parent_id = $1", [project.id]);
    if (categoriesRes.rows.length === 0) {
      throw new Error('No categories found for project ' + project.name);
    }

    console.log(`Using Project: ${project.name}`);
    console.log(`Available Categories: ${categoriesRes.rows.map(c => c.name).join(', ')}`);

    // 2. Query the quotation items with categories
    const testQuery = `
      SELECT qi.*, m.name as material_name, pi.name as project_item_name 
      FROM quotation_items qi 
      JOIN materials m ON qi.material_id = m.id 
      LEFT JOIN projects pi ON qi.project_item_id = pi.id
      ORDER BY qi.id ASC
    `;
    const result = await pool.query(testQuery);
    console.log(`Currently there are ${result.rows.length} quotation items in database.`);
    if (result.rows.length > 0) {
      console.log('Sample Quotation Item:');
      console.log({
        id: result.rows[0].id,
        material_name: result.rows[0].material_name,
        category: result.rows[0].category,
        project_item_id: result.rows[0].project_item_id,
        project_item_name: result.rows[0].project_item_name
      });
    }

    console.log('Database verification successfully completed!');
  } catch (err) {
    console.error('Error in verification script:', err);
  } finally {
    await pool.end();
  }
}

run();
