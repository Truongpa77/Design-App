import { Pool } from 'pg';

const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL;

const host = process.env.DB_HOST || process.env.POSTGRES_HOST;

const isLocal = (!connectionString && (!host || host === 'localhost' || host === '127.0.0.1')) || 
                (connectionString && (connectionString.includes('localhost') || connectionString.includes('127.0.0.1')));

const sslConfig = isLocal ? false : { rejectUnauthorized: false };

const config = connectionString 
  ? { 
      connectionString, 
      ssl: sslConfig
    }
  : {
      host: host,
      port: parseInt(process.env.DB_PORT || process.env.POSTGRES_PORT || '5432', 10),
      database: process.env.DB_NAME || process.env.POSTGRES_DATABASE,
      user: process.env.DB_USER || process.env.POSTGRES_USER,
      password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD,
      ssl: sslConfig
    };

const pool = new Pool(config);

export default pool;
