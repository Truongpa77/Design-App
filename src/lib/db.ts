import { Pool } from 'pg';

const rawConnectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL;

const host = process.env.DB_HOST || process.env.POSTGRES_HOST;

const isLocal = (!rawConnectionString && (!host || host === 'localhost' || host === '127.0.0.1')) || 
                (rawConnectionString && (rawConnectionString.includes('localhost') || rawConnectionString.includes('127.0.0.1')));

const sslConfig = isLocal ? false : { rejectUnauthorized: false };

const config = rawConnectionString 
  ? { 
      connectionString: rawConnectionString, 
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

/**
 * Tạo pool kết nối TRỰC TIẾP (không qua PgBouncer pooler).
 * Dùng cho migration/DDL operations (CREATE TABLE, ALTER TABLE).
 * Pooler endpoint (-pooler) không hỗ trợ DDL.
 */
export function createDirectPool(): Pool {
  if (!rawConnectionString) {
    // Nếu dùng config riêng (host/port), trả về pool thường
    return pool;
  }
  
  // Chuyển đổi pooler URL thành direct URL
  const directUrl = rawConnectionString.replace('-pooler.', '.');
  
  console.log(`🔗 Direct connection: pooler stripped = ${directUrl !== rawConnectionString}`);
  
  return new Pool({
    connectionString: directUrl,
    ssl: sslConfig
  });
}

export default pool;
