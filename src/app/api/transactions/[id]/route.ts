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
      transaction_code, 
      transaction_name, 
      debit_account, 
      credit_account,
      is_active
    } = data;

    if (!transaction_code || !transaction_name) {
      return NextResponse.json({ error: 'Vui lòng nhập đầy đủ Mã giao dịch và Tên giao dịch' }, { status: 400 });
    }

    // Kiểm tra trùng lặp mã với ID khác
    const checkDup = await pool.query('SELECT id FROM transactions WHERE transaction_code = $1 AND id <> $2', [transaction_code, id]);
    if (checkDup.rows.length > 0) {
      return NextResponse.json({ error: `Mã giao dịch "${transaction_code}" đã được sử dụng` }, { status: 400 });
    }

    // Kiểm tra tài khoản nợ
    if (debit_account) {
      const checkDebit = await pool.query('SELECT id FROM accounts WHERE account_code = $1', [debit_account]);
      if (checkDebit.rows.length === 0) {
        return NextResponse.json({ error: `Tài khoản nợ "${debit_account}" không tồn tại trong danh mục tài khoản` }, { status: 400 });
      }
    }

    // Kiểm tra tài khoản có
    if (credit_account) {
      const checkCredit = await pool.query('SELECT id FROM accounts WHERE account_code = $1', [credit_account]);
      if (checkCredit.rows.length === 0) {
        return NextResponse.json({ error: `Tài khoản có "${credit_account}" không tồn tại trong danh mục tài khoản` }, { status: 400 });
      }
    }

    const query = `
      UPDATE transactions 
      SET transaction_code = $1, 
          transaction_name = $2, 
          debit_account = $3, 
          credit_account = $4,
          is_active = $5,
          updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `;
    const result = await pool.query(query, [
      transaction_code,
      transaction_name,
      debit_account || null,
      credit_account || null,
      is_active === undefined ? true : !!is_active,
      id
    ]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Không tìm thấy giao dịch để cập nhật' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating transaction category:', error);
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

    // Lấy mã giao dịch để thông báo
    const getCode = await pool.query('SELECT transaction_code FROM transactions WHERE id = $1', [id]);
    if (getCode.rows.length === 0) {
      return NextResponse.json({ error: 'Không tìm thấy giao dịch' }, { status: 404 });
    }
    const code = getCode.rows[0].transaction_code;

    // Soft delete: đình chỉ hoạt động giao dịch này
    await pool.query("UPDATE transactions SET is_active = FALSE WHERE id = $1", [id]);

    return NextResponse.json({ success: true, message: `Đã đình chỉ giao dịch "${code}".` });
  } catch (error) {
    console.error('Error deleting transaction category:', error);
    return NextResponse.json({ error: 'Lỗi server nội bộ' }, { status: 500 });
  }
}
