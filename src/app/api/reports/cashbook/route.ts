import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

async function checkAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token');
  if (!token) return false;
  try {
    const user = JSON.parse(token.value);
    return !!user;
  } catch (e) {
    return false;
  }
}

export async function GET(request: Request) {
  const isAuthed = await checkAuth();
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get('from_date');
    const toDate = searchParams.get('to_date');
    const accountCode = searchParams.get('account_code') || '111';

    if (!fromDate || !toDate) {
      return NextResponse.json({ error: 'Vui lòng chọn đầy đủ từ ngày và đến ngày' }, { status: 400 });
    }

    const start_date = `${fromDate} 00:00:00`;
    const end_date = `${toDate} 23:59:59`;
    const acPattern = `${accountCode}%`;

    // 1. Query initial balance from account_initial_balances
    const initRes = await pool.query(
      `SELECT 
        COALESCE(SUM(debit_balance), 0)::float as debit_bal, 
        COALESCE(SUM(credit_balance), 0)::float as credit_bal 
       FROM account_initial_balances 
       WHERE account_code LIKE $1`,
      [acPattern]
    );
    const initialDebit = initRes.rows[0]?.debit_bal || 0;
    const initialCredit = initRes.rows[0]?.credit_bal || 0;
    const baselineBalance = initialDebit - initialCredit;

    // 2. Query movements before fromDate to calculate running opening balance
    const beforeRes = await pool.query(
      `SELECT 
        COALESCE(SUM(CASE WHEN fd.debit_account LIKE $1 THEN fd.total_amount ELSE 0 END), 0)::float as debit_before,
        COALESCE(SUM(CASE WHEN fd.credit_account LIKE $1 THEN fd.total_amount ELSE 0 END), 0)::float as credit_before
       FROM financial_details fd
       JOIN financial_documents doc ON fd.document_id = doc.id
       WHERE (fd.debit_account LIKE $1 OR fd.credit_account LIKE $1)
         AND doc.document_date < $2`,
      [acPattern, start_date]
    );
    const debitBefore = beforeRes.rows[0]?.debit_before || 0;
    const creditBefore = beforeRes.rows[0]?.credit_before || 0;
    
    const openingBalance = baselineBalance + debitBefore - creditBefore;

    // 3. Query transactions in the period
    const txRes = await pool.query(
      `SELECT 
        doc.id as voucher_id,
        doc.document_no,
        doc.type as voucher_type,
        doc.document_date,
        doc.partner_name,
        COALESCE(fd.description, doc.description, '') as description,
        fd.debit_account,
        fd.credit_account,
        fd.total_amount as amount
       FROM financial_details fd
       JOIN financial_documents doc ON fd.document_id = doc.id
       WHERE (fd.debit_account LIKE $1 OR fd.credit_account LIKE $1)
         AND doc.document_date >= $2
         AND doc.document_date <= $3
       ORDER BY doc.document_date ASC, doc.document_no ASC, fd.id ASC`,
      [acPattern, start_date, end_date]
    );

    return NextResponse.json({
      opening_balance: openingBalance,
      items: txRes.rows
    });

  } catch (error) {
    console.error('Error generating cashbook report:', error);
    return NextResponse.json({ error: 'Lỗi server nội bộ' }, { status: 500 });
  }
}
