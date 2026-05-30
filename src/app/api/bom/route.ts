import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get('product_id');

  try {
    let query = `
      SELECT b.*, m.name as material_name, m.unit, m.type, m.length as mat_length, m.width as mat_width
      FROM product_bom b
      JOIN materials m ON b.material_id = m.id
    `;
    const params = [];
    
    if (productId) {
      query += ` WHERE b.product_id = $1`;
      params.push(productId);
    }
    
    const result = await pool.query(query, params);
    return NextResponse.json(result.rows);
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi server nội bộ' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const client = await pool.connect();
  try {
    const { product_id, items, product_length, product_width, product_height } = await request.json();

    if (!product_id || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
    }

    await client.query('BEGIN');

    // Cập nhật kích thước tiêu chuẩn của sản phẩm nếu được truyền lên
    if (product_length !== undefined || product_width !== undefined || product_height !== undefined) {
      await client.query(
        'UPDATE materials SET length = $1, width = $2, thickness = $3 WHERE id = $4',
        [
          product_length !== undefined && product_length !== '' && product_length !== null ? Number(product_length) : null,
          product_width !== undefined && product_width !== '' && product_width !== null ? Number(product_width) : null,
          product_height !== undefined && product_height !== '' && product_height !== null ? Number(product_height) : null,
          Number(product_id)
        ]
      );
    }

    // Xóa định mức cũ
    await client.query('DELETE FROM product_bom WHERE product_id = $1', [product_id]);

    // Thêm định mức mới
    for (const item of items) {
      if (item.material_id && item.quantity_required > 0) {
        await client.query(
          `INSERT INTO product_bom (
            product_id, material_id, quantity_required, component_name, 
            length, width, quantity, length_map, width_map
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            product_id, 
            item.material_id, 
            item.quantity_required,
            item.component_name || null,
            item.length !== undefined && item.length !== '' && item.length !== null ? Number(item.length) : null,
            item.width !== undefined && item.width !== '' && item.width !== null ? Number(item.width) : null,
            item.quantity !== undefined && item.quantity !== '' && item.quantity !== null ? Number(item.quantity) : null,
            item.length_map || 'Fixed',
            item.width_map || 'Fixed'
          ]
        );
      }
    }

    await client.query('COMMIT');
    return NextResponse.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('BOM update error:', error);
    return NextResponse.json({ error: 'Lỗi server nội bộ' }, { status: 500 });
  } finally {
    client.release();
  }
}
