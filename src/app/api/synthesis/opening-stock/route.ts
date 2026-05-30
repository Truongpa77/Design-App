import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET - Tải chi tiết số dư đầu kỳ hoặc danh sách tổng hợp của tất cả các kho
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const warehouseCode = searchParams.get('warehouse_code');

    // Nếu không truyền warehouse_code, trả về danh sách tổng hợp tất cả các kho đã lập số dư đầu kỳ
    if (!warehouseCode) {
      const query = `
        SELECT wis.warehouse_code, 
               COALESCE(w.warehouse_name, wis.warehouse_code) as warehouse_name,
               wis.opening_date, 
               COUNT(wis.material_id)::int as total_items, 
               SUM(wis.total_price)::float as total_value
        FROM warehouse_initial_stock wis
        LEFT JOIN warehouses w ON wis.warehouse_code = w.warehouse_code
        GROUP BY wis.warehouse_code, w.warehouse_name, wis.opening_date
        ORDER BY wis.warehouse_code ASC
      `;
      const result = await pool.query(query);
      return NextResponse.json(result.rows, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      });
    }

    // Nếu có warehouse_code, trả về chi tiết các dòng tồn kho đầu kỳ của kho đó
    const query = `
      SELECT wis.*, 
             m.material_code, 
             m.name as material_name, 
             m.unit as material_unit,
             m.type as material_type
      FROM warehouse_initial_stock wis
      JOIN materials m ON wis.material_id = m.id
      WHERE wis.warehouse_code = $1
      ORDER BY wis.id ASC
    `;
    const result = await pool.query(query, [warehouseCode]);
    return NextResponse.json(result.rows, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error: any) {
    console.error('Error fetching opening stock:', error);
    return NextResponse.json({ error: 'Lỗi server: ' + error.message }, { status: 500 });
  }
}

// POST - Lưu và đồng bộ số dư đầu kỳ của một kho bãi
export async function POST(request: Request) {
  const client = await pool.connect();
  try {
    const { warehouse_code, opening_date, items } = await request.json();

    if (!warehouse_code || !opening_date) {
      return NextResponse.json({ error: 'Vui lòng cung cấp mã kho và ngày đầu kỳ' }, { status: 400 });
    }

    await client.query('BEGIN');

    // 1. Lấy toàn bộ số dư đầu kỳ hiện tại để hoàn trả tồn kho tổng
    const existingRes = await client.query(
      'SELECT material_id, quantity FROM warehouse_initial_stock WHERE warehouse_code = $1',
      [warehouse_code]
    );
    for (const row of existingRes.rows) {
      await client.query(
        'UPDATE materials SET stock_quantity = stock_quantity - $1 WHERE id = $2',
        [row.quantity, row.material_id]
      );
    }

    // 2. Xóa toàn bộ số dư đầu kỳ cũ của kho bãi này
    await client.query(
      'DELETE FROM warehouse_initial_stock WHERE warehouse_code = $1',
      [warehouse_code]
    );

    // 3. Thêm mới danh sách số dư đầu kỳ và cập nhật tồn kho tổng
    const validItems = (items || []).filter((item: any) => item.material_id && Number(item.quantity) > 0);
    
    for (const item of validItems) {
      const qty = Number(item.quantity);
      const price = Number(item.unit_price || 0);
      const total = qty * price;

      // Chèn vào bảng warehouse_initial_stock
      await client.query(
        `INSERT INTO warehouse_initial_stock 
          (warehouse_code, opening_date, material_id, quantity, unit_price, total_price)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (warehouse_code, material_id) 
         DO UPDATE SET 
            opening_date = EXCLUDED.opening_date,
            quantity = EXCLUDED.quantity,
            unit_price = EXCLUDED.unit_price,
            total_price = EXCLUDED.total_price,
            updated_at = NOW()`,
        [warehouse_code, opening_date, item.material_id, qty, price, total]
      );

      // Cộng lại vào tồn kho tổng
      await client.query(
        'UPDATE materials SET stock_quantity = stock_quantity + $1 WHERE id = $2',
        [qty, item.material_id]
      );
    }

    await client.query('COMMIT');
    return NextResponse.json({ success: true });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error saving opening stock:', error);
    return NextResponse.json({ error: 'Lỗi server khi lưu số dư: ' + error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

// DELETE - Xóa toàn bộ số dư đầu kỳ của một kho bãi và hoàn trả tồn kho vật tư
export async function DELETE(request: NextRequest) {
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(request.url);
    const warehouseCode = searchParams.get('warehouse_code');

    if (!warehouseCode) {
      return NextResponse.json({ error: 'Thiếu mã kho bãi' }, { status: 400 });
    }

    await client.query('BEGIN');

    // 1. Hoàn trả tồn kho tổng cho các vật tư của kho bãi này
    const existingRes = await client.query(
      'SELECT material_id, quantity FROM warehouse_initial_stock WHERE warehouse_code = $1',
      [warehouseCode]
    );
    for (const row of existingRes.rows) {
      await client.query(
        'UPDATE materials SET stock_quantity = stock_quantity - $1 WHERE id = $2',
        [row.quantity, row.material_id]
      );
    }

    // 2. Xóa các dòng số dư đầu kỳ của kho này
    await client.query(
      'DELETE FROM warehouse_initial_stock WHERE warehouse_code = $1',
      [warehouseCode]
    );

    await client.query('COMMIT');
    return NextResponse.json({ success: true });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error deleting opening stock:', error);
    return NextResponse.json({ error: 'Lỗi server khi xóa số dư: ' + error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
