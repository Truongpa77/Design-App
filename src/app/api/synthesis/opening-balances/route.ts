import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const query = `
      SELECT aib.*, 
             a.account_name,
             c.name as customer_name,
             p.name as project_item_name
      FROM account_initial_balances aib
      JOIN accounts a ON aib.account_code = a.account_code
      LEFT JOIN customers c ON aib.customer_id = c.id
      LEFT JOIN projects p ON aib.project_item_id = p.id
      ORDER BY aib.account_code ASC, aib.id ASC
    `;
    const result = await pool.query(query);
    return NextResponse.json(result.rows, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error) {
    console.error('Error fetching opening balances:', error);
    return NextResponse.json({ error: 'Lỗi server nội bộ' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { items } = data;

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Dữ liệu không đúng định dạng' }, { status: 400 });
    }

    // Lọc các dòng hợp lệ (phải có tài khoản và có ít nhất 1 số dư > 0)
    const validItems = items.filter(i => {
      const codeOk = !!i.account_code;
      const val1 = parseFloat(i.debit_balance) || 0;
      const val2 = parseFloat(i.credit_balance) || 0;
      const val3 = parseFloat(i.debit_balance_ytd) || 0;
      const val4 = parseFloat(i.credit_balance_ytd) || 0;
      return codeOk && (val1 > 0 || val2 > 0 || val3 > 0 || val4 > 0);
    });

    await pool.query('BEGIN');

    // Xóa số dư cũ
    await pool.query('DELETE FROM account_initial_balances');

    // Chèn số dư mới
    for (const item of validItems) {
      const insertQuery = `
        INSERT INTO account_initial_balances (
          account_code, customer_id, project_item_id, 
          debit_balance, credit_balance, debit_balance_ytd, credit_balance_ytd
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;
      await pool.query(insertQuery, [
        item.account_code,
        item.customer_id ? parseInt(item.customer_id) : null,
        item.project_item_id ? parseInt(item.project_item_id) : null,
        parseFloat(item.debit_balance) || 0,
        parseFloat(item.credit_balance) || 0,
        parseFloat(item.debit_balance_ytd) || 0,
        parseFloat(item.credit_balance_ytd) || 0
      ]);
    }

    await pool.query('COMMIT');

    // Truy vấn lại để trả về dữ liệu chuẩn kèm tên hiển thị
    const getQuery = `
      SELECT aib.*, 
             a.account_name,
             c.name as customer_name,
             p.name as project_item_name
      FROM account_initial_balances aib
      JOIN accounts a ON aib.account_code = a.account_code
      LEFT JOIN customers c ON aib.customer_id = c.id
      LEFT JOIN projects p ON aib.project_item_id = p.id
      ORDER BY aib.account_code ASC, aib.id ASC
    `;
    const finalResult = await pool.query(getQuery);

    return NextResponse.json(finalResult.rows);
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error saving opening balances:', error);
    return NextResponse.json({ error: 'Lỗi server nội bộ' }, { status: 500 });
  }
}
