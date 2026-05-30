import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID không hợp lệ' }, { status: 400 });
    }

    const { code, name, type, parent_id, notes } = await request.json();
    if (!code || !name || !type) {
      return NextResponse.json({ error: 'Vui lòng điền đầy đủ các thông tin bắt buộc' }, { status: 400 });
    }

    // Check unique code excluding current ID
    const checkCode = await pool.query('SELECT id FROM projects WHERE code = $1 AND id <> $2', [code, id]);
    if (checkCode.rowCount && checkCode.rowCount > 0) {
      return NextResponse.json({ error: 'Mã công trình/hạng mục đã tồn tại' }, { status: 400 });
    }

    const query = `
      UPDATE projects 
      SET code = $1, name = $2, type = $3, parent_id = $4, notes = $5
      WHERE id = $6 
      RETURNING *
    `;
    const result = await pool.query(query, [
      code,
      name,
      type,
      type === 'Hạng mục' && parent_id ? parseInt(parent_id) : null,
      notes || null,
      id
    ]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Không tìm thấy công trình/hạng mục' }, { status: 404 });
    }

    // Fetch parent name for return
    const selectQuery = `
      SELECT p.*, parent.name as parent_name 
      FROM projects p
      LEFT JOIN projects parent ON p.parent_id = parent.id
      WHERE p.id = $1
    `;
    const finalResult = await pool.query(selectQuery, [id]);

    return NextResponse.json(finalResult.rows[0]);
  } catch (error) {
    console.error('Error updating project:', error);
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

    const result = await pool.query('DELETE FROM projects WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Không tìm thấy công trình/hạng mục' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Xóa thành công', project: result.rows[0] });
  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json({ error: 'Lỗi server nội bộ' }, { status: 500 });
  }
}
