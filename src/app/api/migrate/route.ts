import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    console.log('Bắt đầu chẩn đoán database và cập nhật cấu trúc...');

    // 1. Chạy các truy vấn chẩn đoán trạng thái read-only
    const roCheck = await pool.query(`
      SELECT 
        current_setting('transaction_read_only') as transaction_ro,
        current_setting('default_transaction_read_only') as default_ro,
        inet_server_addr() as server_ip,
        inet_server_port() as server_port,
        current_database() as current_db
    `);
    
    console.log('DIAGNOSTICS DATABASE:', roCheck.rows[0]);

    // 2. Thêm cột mapping vào product_bom
    await pool.query(`
      ALTER TABLE product_bom 
      ADD COLUMN IF NOT EXISTS length_map VARCHAR(10) DEFAULT 'Fixed',
      ADD COLUMN IF NOT EXISTS width_map VARCHAR(10) DEFAULT 'Fixed';
    `);
    console.log('✅ Đã cập nhật các cột length_map, width_map trong bảng product_bom');

    // 3. Tạo bảng material_demands
    await pool.query(`
      CREATE TABLE IF NOT EXISTS material_demands (
        id SERIAL PRIMARY KEY,
        quotation_id INTEGER REFERENCES quotations(id) ON DELETE CASCADE,
        material_id INTEGER REFERENCES materials(id) ON DELETE CASCADE,
        calculated_quantity NUMERIC NOT NULL,
        custom_quantity NUMERIC,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(quotation_id, material_id)
      );
    `);
    console.log('✅ Đã tạo bảng material_demands');

    return NextResponse.json({ 
      success: true, 
      message: 'Database migrated successfully!',
      db_status: roCheck.rows[0]
    });
  } catch (err: any) {
    console.error('❌ Lỗi khi cập nhật cơ sở dữ liệu:', err);
    
    // Thu thập trạng thái read-only nếu có thể
    let roStatus = {};
    try {
      const roCheck = await pool.query(`
        SELECT 
          current_setting('transaction_read_only') as transaction_ro,
          current_setting('default_transaction_read_only') as default_ro,
          inet_server_addr() as server_ip,
          inet_server_port() as server_port,
          current_database() as current_db
      `);
      roStatus = roCheck.rows[0];
    } catch (e: any) {
      roStatus = { error_fetching_ro_status: e.message || String(e) };
    }

    const connStr = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL;
    let anonymizedConn = 'undefined';
    if (connStr) {
      try {
        const url = new URL(connStr);
        anonymizedConn = `${url.protocol}//${url.username}:***@${url.host}${url.pathname}?${url.searchParams.toString()}`;
      } catch (e) {
        anonymizedConn = 'invalid-url-format';
      }
    }

    return NextResponse.json({ 
      success: false, 
      error: err.message || String(err),
      db_status: roStatus,
      diagnostics: {
        has_neon_db_url: !!process.env.NEON_DATABASE_URL,
        has_db_url: !!process.env.DATABASE_URL,
        has_postgres_url: !!process.env.POSTGRES_URL,
        anonymized_connection_string: anonymizedConn,
        db_host: process.env.DB_HOST || 'undefined',
        node_env: process.env.NODE_ENV
      }
    }, { status: 200 });
  }
}

