const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function diagnose() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    console.error('DATABASE_URL is not set in .env.local!');
    return;
  }

  // Replace database name with 'neondb' to connect successfully
  const urlParts = rawUrl.split('/');
  const dbNameWithQuery = urlParts.pop();
  const queryParams = dbNameWithQuery.includes('?') ? '?' + dbNameWithQuery.split('?')[1] : '';
  const neonDbUrl = urlParts.join('/') + '/neondb' + queryParams;

  console.log('Connecting to default "neondb" database to query database list...');
  const client = new Client({
    connectionString: neonDbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to default neondb successfully!');

    // List all databases
    const resDbs = await client.query("SELECT datname FROM pg_database WHERE datistemplate = false;");
    console.log('\nList of databases on this Neon server:');
    resDbs.rows.forEach(row => console.log(' -', row.datname));

    // Check if 'Db_Design' exists (case-sensitive or lowercase)
    const dbNames = resDbs.rows.map(row => row.datname);
    let targetDb = 'neondb';
    if (dbNames.includes('Db_Design')) {
      targetDb = 'Db_Design';
    } else if (dbNames.includes('db_design')) {
      targetDb = 'db_design';
    }

    console.log(`\nNow connecting to the target database "${targetDb}" to list tables...`);
    const targetUrl = urlParts.join('/') + '/' + targetDb + queryParams;
    const targetClient = new Client({
      connectionString: targetUrl,
      ssl: { rejectUnauthorized: false }
    });

    await targetClient.connect();
    const resTables = await targetClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    console.log(`Tables in "${targetDb}":`);
    resTables.rows.forEach(row => console.log(' -', row.table_name));
    await targetClient.end();

  } catch (err) {
    console.error('Error during diagnosis:', err);
  } finally {
    await client.end();
  }
}

diagnose();
