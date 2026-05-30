const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function createDatabase() {
  // Connect to 'postgres' database to issue CREATE DATABASE command
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5433', 10),
    database: 'postgres', // default database
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  try {
    await client.connect();
    
    // Check if database exists
    const res = await client.query("SELECT 1 FROM pg_database WHERE datname = 'Db_Design'");
    if (res.rowCount === 0) {
      await client.query('CREATE DATABASE "Db_Design"');
      console.log('Tạo database Db_Design thành công!');
    } else {
      console.log('Database Db_Design đã tồn tại!');
    }
  } catch (err) {
    console.error('Lỗi khi tạo database:', err);
  } finally {
    await client.end();
  }
}

createDatabase();
