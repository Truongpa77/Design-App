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
    console.log('Testing updates and query of quotations with projects/categories...');

    // 1. Get a project and a category
    const projectRes = await pool.query("SELECT * FROM projects WHERE type = 'Công trình' LIMIT 1");
    const categoryRes = await pool.query("SELECT * FROM projects WHERE type = 'Hạng mục' LIMIT 1");

    if (projectRes.rows.length === 0 || categoryRes.rows.length === 0) {
      throw new Error('Please run insert_sample_projects.js first to populate projects');
    }

    const project = projectRes.rows[0];
    const category = categoryRes.rows[0];

    console.log(`Using Project: ${project.name} (ID: ${project.id})`);
    console.log(`Using Category: ${category.name} (ID: ${category.id})`);

    // 2. Update quotation with ID = 1 to associate with this project and category
    await pool.query(`
      UPDATE quotations
      SET project_id = $1, project_item_id = $2, project_name = $3
      WHERE id = 1
    `, [project.id, category.id, project.name]);
    console.log('Quotation ID 1 updated.');

    // 3. Query the quotations using the same query as the REST API GET method
    const query = `
      SELECT q.*, c.name as customer_name, p.name as selected_project_name, pi.name as selected_project_item_name
      FROM quotations q
      LEFT JOIN customers c ON q.customer_id = c.id
      LEFT JOIN projects p ON q.project_id = p.id
      LEFT JOIN projects pi ON q.project_item_id = pi.id
      WHERE q.id = 1
    `;
    const result = await pool.query(query);
    const updatedQuotation = result.rows[0];

    console.log('QueryResult for updated quotation:', {
      id: updatedQuotation.id,
      document_no: updatedQuotation.document_no,
      project_name: updatedQuotation.project_name,
      project_id: updatedQuotation.project_id,
      project_item_id: updatedQuotation.project_item_id,
      selected_project_name: updatedQuotation.selected_project_name,
      selected_project_item_name: updatedQuotation.selected_project_item_name
    });

    if (updatedQuotation.selected_project_name === project.name && updatedQuotation.selected_project_item_name === category.name) {
      console.log('Verification Success: Quotation projects successfully joined and fetched!');
    } else {
      console.error('Verification Failure: Joined project names do not match expected values.');
    }
  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    await pool.end();
  }
}

run();
