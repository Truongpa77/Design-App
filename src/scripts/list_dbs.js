const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function listDbs() {
  const connectionString = process.env.DATABASE_URL;
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to:', connectionString.split('@')[1].split('/')[0]);
    
    // List databases
    const dbs = await client.query('SELECT datname FROM pg_database WHERE datistemplate = false;');
    console.log('\nDatabases on this Neon server:');
    dbs.rows.forEach(r => console.log(' -', r.datname));

    // List tables in the current connected database
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    console.log(`\nTables in the currently connected database (${connectionString.split('/').pop().split('?')[0]}):`);
    tables.rows.forEach(r => console.log(' -', r.table_name));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

listDbs();
