import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    // Check current database
    const dbNameRes = await pool.query('SELECT current_database(), current_user;');
    const currentDb = dbNameRes.rows[0].current_database;
    const currentUser = dbNameRes.rows[0].current_user;

    // Check tables
    const tablesRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    const tables = tablesRes.rows.map(r => r.table_name);

    // Try to query users
    let usersCount = 0;
    let usersError = null;
    try {
      const usersRes = await pool.query('SELECT COUNT(*) FROM users;');
      usersCount = parseInt(usersRes.rows[0].count, 10);
    } catch (err: any) {
      usersError = err.message || err.toString();
    }

    return NextResponse.json({
      success: true,
      currentDb,
      currentUser,
      tables,
      usersCount,
      usersError,
      envUsed: process.env.NEON_DATABASE_URL ? 'NEON_DATABASE_URL' : (process.env.DATABASE_URL ? 'DATABASE_URL' : 'OTHER')
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message || err.toString(),
      stack: err.stack
    });
  }
}
