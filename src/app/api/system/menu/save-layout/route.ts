import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function PUT(request: Request) {
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(request.url);
    const layout = searchParams.get('layout') || 'admin';

    const data = await request.json();
    const { nodes } = data; // Array of MenuNode: { id, parent_id, sort_order, title, icon, path, is_active, show_in_menu, show_in_submenu }

    if (!nodes || !Array.isArray(nodes)) {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
    }

    await client.query('BEGIN');

    // 1. Lấy tất cả các node hiện có trong database của layout này để đối chiếu xóa
    const dbNodesRes = await client.query(
      'SELECT id FROM layout_details WHERE layout_id = $1',
      [layout]
    );
    const dbIds = dbNodesRes.rows.map((r: { id: number }) => r.id);

    // Tìm các ID không còn xuất hiện trong payload để thực hiện xóa hoàn toàn
    const payloadIds = new Set(nodes.filter(n => n.id > 0).map(n => n.id));
    const idsToDelete = dbIds.filter(id => !payloadIds.has(id));

    if (idsToDelete.length > 0) {
      await client.query(
        'DELETE FROM layout_details WHERE id = ANY($1)',
        [idsToDelete]
      );
    }

    // 2. Phân loại các node thành nhóm: Update (id > 0) và Insert (id < 0)
    const existingNodes = nodes.filter(n => n.id > 0);
    const newNodes = nodes.filter(n => n.id < 0);

    // Map ánh xạ từ ID tạm thời (âm) sang ID chính thức (dương) trong DB
    const idMap: { [key: number]: number } = {};

    // 3. Thực hiện INSERT các node mới trước để có ID chính thức
    for (const node of newNodes) {
      const query = `
        INSERT INTO layout_details (parent_id, sort_order, title, icon, path, is_active, layout_id, show_in_menu, show_in_submenu)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `;
      // Nếu parent_id của node mới này là âm (cũng là node mới), chúng ta ánh xạ nó.
      // Tuy nhiên, thường parent_id sẽ là ID dương của nhóm phân hệ cha đã tồn tại.
      let resolvedParentId = node.parent_id;
      if (resolvedParentId !== null && resolvedParentId < 0) {
        resolvedParentId = idMap[resolvedParentId] || null;
      }

      const values = [
        resolvedParentId,
        node.sort_order,
        node.title,
        node.icon,
        node.path, // Sẽ có định dạng '#separator-<temp>' hoặc '#header-<temp>' từ client gửi lên
        node.is_active !== undefined ? node.is_active : true,
        layout,
        node.show_in_menu !== undefined ? node.show_in_menu : true,
        node.show_in_submenu !== undefined ? node.show_in_submenu : true
      ];

      const res = await client.query(query, values);
      const newRealId = res.rows[0].id;
      idMap[node.id] = newRealId;

      // Cập nhật lại path cho separator và header chứa ID thực tế để đảm bảo tính duy nhất
      if (node.path && node.path.startsWith('#separator')) {
        await client.query(
          "UPDATE layout_details SET path = $1 WHERE id = $2",
          [`#separator-${newRealId}`, newRealId]
        );
      } else if (node.path && node.path.startsWith('#header')) {
        await client.query(
          "UPDATE layout_details SET path = $1 WHERE id = $2",
          [`#header-${newRealId}`, newRealId]
        );
      }
    }

    // 4. Thực hiện UPDATE các node hiện có
    for (const node of existingNodes) {
      let resolvedParentId = node.parent_id;
      if (resolvedParentId !== null && resolvedParentId < 0) {
        resolvedParentId = idMap[resolvedParentId] || null;
      }

      const query = `
        UPDATE layout_details
        SET parent_id = $1, sort_order = $2, title = $3, icon = $4, path = $5, is_active = $6, show_in_menu = $7, show_in_submenu = $8
        WHERE id = $9
      `;
      const values = [
        resolvedParentId,
        node.sort_order,
        node.title,
        node.icon,
        node.path,
        node.is_active !== undefined ? node.is_active : true,
        node.show_in_menu !== undefined ? node.show_in_menu : true,
        node.show_in_submenu !== undefined ? node.show_in_submenu : true,
        node.id
      ];

      await client.query(query, values);
    }

    await client.query('COMMIT');
    return NextResponse.json({ message: 'Lưu thiết lập menu thành công' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving menu layout:', error);
    return NextResponse.json({ error: 'Lỗi server khi lưu thiết lập menu' }, { status: 500 });
  } finally {
    client.release();
  }
}
