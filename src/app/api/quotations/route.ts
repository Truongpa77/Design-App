import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const query = `
      SELECT q.*, c.name as customer_name, p.name as selected_project_name, pi.name as selected_project_item_name
      FROM quotations q
      LEFT JOIN customers c ON q.customer_id = c.id
      LEFT JOIN projects p ON q.project_id = p.id
      LEFT JOIN projects pi ON q.project_item_id = pi.id
      ORDER BY q.created_at DESC
    `;
    const result = await pool.query(query);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching quotations:', error);
    return NextResponse.json({ error: 'Lỗi server nội bộ' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const client = await pool.connect();
  try {
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
      return NextResponse.json({ error: 'Thiếu thông tin báo giá' }, { status: 400 });
    }

    await client.query('BEGIN');

    // Calculate total price with tax percent
    const total_price = items.reduce((acc: number, item: any) => {
      const qty = Number(item.calculated_quantity || 0);
      const price = Number(item.unit_price || 0);
      const tax = Number(item.tax_percent || 0);
      return acc + (qty * price * (1 + tax / 100));
    }, 0);

    // Create quotation
    const qResult = await client.query(
      `INSERT INTO quotations (customer_id, total_price, status, quotation_date, document_no, project_name, description, partner_address, project_id, project_item_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        customer_id, 
        total_price, 
        'draft', 
        quotation_date || new Date(), 
        document_no, 
        project_name, 
        description, 
        partner_address,
        project_id ? parseInt(project_id) : null,
        project_item_id ? parseInt(project_item_id) : null
      ]
    );
    const quotation = qResult.rows[0];

    // Create items
    for (const item of items) {
      const qty = Number(item.calculated_quantity || 0);
      const price = Number(item.unit_price || 0);
      const tax = Number(item.tax_percent || 0);
      const lineTotal = qty * price * (1 + tax / 100);

      await client.query(
        `INSERT INTO quotation_items (
          quotation_id, material_id, calculated_quantity, unit_price, total_price, 
          length, width, height, category, tax_percent, image_path, project_item_id
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          quotation.id, 
          item.material_id, 
          qty, 
          price, 
          lineTotal,
          item.length ? Number(item.length) : null,
          item.width ? Number(item.width) : null,
          item.height ? Number(item.height) : null,
          item.category || null,
          tax,
          item.image_path || null,
          item.project_item_id ? parseInt(item.project_item_id) : null
        ]
      );
    }

    await client.query('COMMIT');
    
    // Fetch customer name
    const cRes = await pool.query('SELECT name FROM customers WHERE id = $1', [customer_id]);
    quotation.customer_name = cRes.rows[0]?.name || '';

    return NextResponse.json(quotation);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating quotation:', error);
    return NextResponse.json({ error: 'Lỗi server nội bộ' }, { status: 500 });
  } finally {
    client.release();
  }
}
