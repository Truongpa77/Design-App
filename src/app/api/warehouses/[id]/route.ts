import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (isNaN(id)) return NextResponse.json({ error: 'ID khong hop le' }, { status: 400 });

    const { warehouse_code, warehouse_name, description } = await request.json();
    if (!warehouse_code || !warehouse_name) {
      return NextResponse.json({ error: 'Vui long nhap Ma kho va Ten kho' }, { status: 400 });
    }

    const result = await pool.query(
      `UPDATE warehouses SET warehouse_code = $1, warehouse_name = $2, description = $3, updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [warehouse_code.trim().toUpperCase(), warehouse_name.trim(), description || null, id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Khong tim thay kho' }, { status: 404 });
    }
    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    console.error(error);
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Ma kho da ton tai' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Loi server noi bo' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);
    await pool.query('DELETE FROM warehouses WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Loi server noi bo' }, { status: 500 });
  }
}
