import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID không hợp lệ' }, { status: 400 });
    }

    const { 
      customer_id, 
      quotation_date, 
      document_no, 
      project_name, 
      project_id,
      project_item_id,
      description, 
      partner_address, 
      items 
    } = await request.json();

    if (!customer_id || !items || items.length === 0) {
      return NextResponse.json({ error: 'Thiếu thông tin bắt buộc' }, { status: 400 });
    }

    // Tính lại tổng tiền có thuế
    let total_price = 0;
    const itemsWithTotal = items.map((item: any) => {
      const qty = Number(item.calculated_quantity || 0);
      const price = Number(item.unit_price || 0);
      const tax = Number(item.tax_percent || 0);
      const item_total = qty * price * (1 + tax / 100);
      total_price += item_total;
      return { 
        ...item, 
        calculated_quantity: qty,
        unit_price: price,
        tax_percent: tax,
        total_price: item_total 
      };
    });

    await pool.query('BEGIN');

    const updateQuery = `
      UPDATE quotations 
      SET customer_id = $1, 
          quotation_date = $2, 
          total_price = $3, 
          document_no = $4, 
          project_name = $5, 
          description = $6, 
          partner_address = $7, 
          project_id = $8,
          project_item_id = $9,
          updated_at = NOW()
      WHERE id = $10
      RETURNING *
    `;
    const result = await pool.query(updateQuery, [
      customer_id, 
      quotation_date, 
      total_price, 
      document_no, 
      project_name, 
      description, 
      partner_address, 
      project_id ? parseInt(project_id) : null,
      project_item_id ? parseInt(project_item_id) : null,
      id
    ]);
    
    if (result.rows.length === 0) {
      await pool.query('ROLLBACK');
      return NextResponse.json({ error: 'Không tìm thấy báo giá' }, { status: 404 });
    }

    const updatedQuotation = result.rows[0];

    // Xóa các item cũ
    await pool.query('DELETE FROM quotation_items WHERE quotation_id = $1', [id]);

    // Thêm các item mới
    for (const item of itemsWithTotal) {
      const itemQuery = `
        INSERT INTO quotation_items (
          quotation_id, material_id, calculated_quantity, unit_price, total_price, 
          length, width, height, category, tax_percent, image_path, project_item_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `;
      await pool.query(itemQuery, [
        id, 
        item.material_id, 
        item.calculated_quantity, 
        item.unit_price, 
        item.total_price,
        item.length ? Number(item.length) : null,
        item.width ? Number(item.width) : null,
        item.height ? Number(item.height) : null,
        item.category || null,
        item.tax_percent,
        item.image_path || null,
        item.project_item_id ? parseInt(item.project_item_id) : null
      ]);
    }

    await pool.query('COMMIT');

    // Lấy thêm tên khách hàng để trả về
    const customerRes = await pool.query('SELECT name FROM customers WHERE id = $1', [customer_id]);
    updatedQuotation.customer_name = customerRes.rows[0]?.name || '';

    return NextResponse.json(updatedQuotation);
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error updating quotation:', error);
    return NextResponse.json({ error: 'Lỗi server nội bộ' }, { status: 500 });
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);
    const qRes = await pool.query(`
      SELECT q.*, c.name as customer_name, p.name as selected_project_name, pi.name as selected_project_item_name
      FROM quotations q 
      LEFT JOIN customers c ON q.customer_id = c.id 
      LEFT JOIN projects p ON q.project_id = p.id
      LEFT JOIN projects pi ON q.project_item_id = pi.id
      WHERE q.id = $1
    `, [id]);

    if (qRes.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const itemsRes = await pool.query(`
      SELECT qi.*, m.name as material_name, m.unit as material_unit, m.material_code, pi.name as project_item_name 
      FROM quotation_items qi 
      JOIN materials m ON qi.material_id = m.id 
      LEFT JOIN projects pi ON qi.project_item_id = pi.id
      WHERE qi.quotation_id = $1
      ORDER BY qi.id ASC
    `, [id]);

    return NextResponse.json({ ...qRes.rows[0], items: itemsRes.rows });
  } catch (error) {
    console.error('Error getting quotation:', error);
    return NextResponse.json({ error: 'Lỗi server nội bộ' }, { status: 500 });
  }
}
