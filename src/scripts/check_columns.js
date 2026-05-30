const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const p = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5433'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function run() {
  const tables = ['quotations', 'quotation_items', 'materials'];
  for (const t of tables) {
    const r = await p.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position`, [t]);
    console.log(`Table ${t}:`, r.rows.map(x => `${x.column_name} (${x.data_type})`).join(', '));
  }
  p.end();
}
run().catch(e => { console.error(e); p.end(); });

