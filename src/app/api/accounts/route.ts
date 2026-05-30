import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await pool.query('SELECT * FROM accounts ORDER BY account_code ASC');
    return NextResponse.json(result.rows, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json({ error: 'Lỗi server nội bộ' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { 
      account_code, 
      account_name, 
      parent_code, 
      track_foreign_currency, 
      track_object_debt, 
      track_project_cost, 
      is_ledger, 
      is_bank, 
      is_long_term, 
      debt_increase_side 
    } = data;

    if (!account_code || !account_name) {
      return NextResponse.json({ error: 'Vui lòng nhập đầy đủ Số hiệu và Tên tài khoản' }, { status: 400 });
    }

    // Kiểm tra trùng lặp
    const checkDup = await pool.query('SELECT id FROM accounts WHERE account_code = $1', [account_code]);
    if (checkDup.rows.length > 0) {
      return NextResponse.json({ error: `Số hiệu tài khoản "${account_code}" đã tồn tại` }, { status: 400 });
    }

    // Kiểm tra tài khoản cha nếu có
    if (parent_code) {
      const checkParent = await pool.query('SELECT id FROM accounts WHERE account_code = $1', [parent_code]);
      if (checkParent.rows.length === 0) {
        return NextResponse.json({ error: `Tài khoản cha "${parent_code}" không tồn tại` }, { status: 400 });
      }
    }

    const query = `
      INSERT INTO accounts (
        account_code, account_name, parent_code, 
        track_foreign_currency, track_object_debt, track_project_cost, 
        is_ledger, is_bank, is_long_term, debt_increase_side, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE)
      RETURNING *
    `;
    const result = await pool.query(query, [
      account_code,
      account_name,
      parent_code || null,
      !!track_foreign_currency,
      !!track_object_debt,
      !!track_project_cost,
      !!is_ledger,
      !!is_bank,
      !!is_long_term,
      debt_increase_side || 'debit'
    ]);

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating account:', error);
    return NextResponse.json({ error: 'Lỗi server nội bộ' }, { status: 500 });
  }
}
