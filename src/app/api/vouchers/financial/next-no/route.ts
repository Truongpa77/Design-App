import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET - Lấy số phiếu kế tiếp dựa trên type
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'receipt', 'payment', 'debit_advice', 'credit_advice'
    
    if (!type) {
      return NextResponse.json({ error: 'Thiếu loại chứng từ (type)' }, { status: 400 });
    }

    const result = await pool.query(
      `SELECT COUNT(*) + 1 as next_num FROM financial_documents WHERE type = $1`,
      [type]
    );
    const nextNum = parseInt(result.rows[0].next_num);
    
    let prefix = 'PC';
    if (type === 'receipt') prefix = 'PT';
    else if (type === 'debit_advice') prefix = 'BN';
    else if (type === 'credit_advice') prefix = 'BC';

    const document_no = `${prefix}${String(nextNum).padStart(4, '0')}`;
    return NextResponse.json({ document_no });
  } catch (error: any) {
    console.error('Error generating next document number:', error);
    return NextResponse.json({ error: 'Lỗi server: ' + error.message }, { status: 500 });
  }
}
