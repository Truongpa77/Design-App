import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID không hợp lệ' }, { status: 400 });
    }

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
      debt_increase_side,
      is_active
    } = data;

    if (!account_code || !account_name) {
      return NextResponse.json({ error: 'Vui lòng nhập đầy đủ Số hiệu và Tên tài khoản' }, { status: 400 });
    }

    // Kiểm tra trùng lặp mã với ID khác
    const checkDup = await pool.query('SELECT id FROM accounts WHERE account_code = $1 AND id <> $2', [account_code, id]);
    if (checkDup.rows.length > 0) {
      return NextResponse.json({ error: `Số hiệu tài khoản "${account_code}" đã được sử dụng` }, { status: 400 });
    }

    // Kiểm tra tài khoản cha nếu có
    if (parent_code) {
      if (parent_code === account_code) {
        return NextResponse.json({ error: 'Tài khoản cha không được trùng với chính nó' }, { status: 400 });
      }
      const checkParent = await pool.query('SELECT id FROM accounts WHERE account_code = $1', [parent_code]);
      if (checkParent.rows.length === 0) {
        return NextResponse.json({ error: `Tài khoản cha "${parent_code}" không tồn tại` }, { status: 400 });
      }
    }

    const query = `
      UPDATE accounts 
      SET account_code = $1, 
          account_name = $2, 
          parent_code = $3, 
          track_foreign_currency = $4, 
          track_object_debt = $5, 
          track_project_cost = $6, 
          is_ledger = $7, 
          is_bank = $8, 
          is_long_term = $9, 
          debt_increase_side = $10,
          is_active = $11,
          updated_at = NOW()
      WHERE id = $12
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
      debt_increase_side || 'debit',
      is_active === undefined ? true : !!is_active,
      id
    ]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Không tìm thấy tài khoản để cập nhật' }, { status: 404 });
    }

    // Nếu kích hoạt lại, cũng kích hoạt lại các tài khoản cha nếu chúng đang bị đình chỉ?
    // Thường thì chỉ kích hoạt lại tài khoản này, tài khoản con vẫn giữ nguyên hoặc tự kích hoạt.
    // Nếu đình chỉ (is_active = false) thông qua PUT:
    if (is_active === false) {
      const code = result.rows[0].account_code;
      await pool.query("UPDATE accounts SET is_active = FALSE WHERE account_code LIKE $1 || '%'", [code]);
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating account:', error);
    return NextResponse.json({ error: 'Lỗi server nội bộ' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID không hợp lệ' }, { status: 400 });
    }

    // Lấy mã tài khoản
    const getCode = await pool.query('SELECT account_code FROM accounts WHERE id = $1', [id]);
    if (getCode.rows.length === 0) {
      return NextResponse.json({ error: 'Không tìm thấy tài khoản' }, { status: 404 });
    }
    const code = getCode.rows[0].account_code;

    // Soft delete: đình chỉ hoạt động tài khoản này và toàn bộ tài khoản con của nó
    await pool.query("UPDATE accounts SET is_active = FALSE WHERE account_code = $1 OR account_code LIKE $1 || '%'", [code]);

    return NextResponse.json({ success: true, message: `Đã đình chỉ tài khoản "${code}" và các tài khoản con của nó.` });
  } catch (error) {
    console.error('Error deleting account (soft delete):', error);
    return NextResponse.json({ error: 'Lỗi server nội bộ' }, { status: 500 });
  }
}
