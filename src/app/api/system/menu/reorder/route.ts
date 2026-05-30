import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function PUT(request: Request) {
  const client = await pool.connect();
  try {
    const data = await request.json();
    const { nodes } = data; // Array of { id, parent_id, sort_order }

    if (!nodes || !Array.isArray(nodes)) {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
    }

    await client.query('BEGIN');

    for (const node of nodes) {
      const { id, parent_id, sort_order } = node;
      await client.query(
        'UPDATE layout_details SET parent_id = $1, sort_order = $2 WHERE id = $3',
        [parent_id || null, sort_order, id]
      );
    }

    await client.query('COMMIT');
    return NextResponse.json({ message: 'Cập nhật thứ tự thành công' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error reordering menu nodes:', error);
    return NextResponse.json({ error: 'Lỗi server khi cập nhật thứ tự' }, { status: 500 });
  } finally {
    client.release();
  }
}
