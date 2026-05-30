import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

// Helper check login
async function checkAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token');
  if (!token) return false;
  try {
    const user = JSON.parse(token.value);
    return !!user;
  } catch (e) {
    return false;
  }
}

export async function GET(request: Request) {
  const isAuthed = await checkAuth();
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get('from_date');
    const toDate = searchParams.get('to_date');
    const mode = searchParams.get('mode') || 'summary'; // 'summary' or 'detail'
    const materialIdsStr = searchParams.get('material_ids'); // '1,2,3'
    const customerIdStr = searchParams.get('customer_id');
    const warehouseCode = searchParams.get('warehouse_code');
    const detailMaterialIdStr = searchParams.get('material_id'); // target material_id for detail report

    if (!fromDate || !toDate) {
      return NextResponse.json({ error: 'Vui lòng chọn đầy đủ từ ngày và đến ngày' }, { status: 400 });
    }

    // Set end of day for toDate to include all records on that day
    const start_date = `${fromDate} 00:00:00`;
    const end_date = `${toDate} 23:59:59`;

    let params: any[] = [start_date, end_date];
    let paramCounter = 3;

    if (mode === 'summary') {
      let query = `
        SELECT 
          m.id as material_id,
          m.material_code,
          m.name as material_name,
          m.unit as material_unit,
          m.type as material_type,
          SUM(wd.quantity) as total_quantity,
          SUM(wd.quantity * wd.unit_price) as total_amount,
          SUM(wd.quantity * wd.unit_price * (wd.tax_percent / 100)) as total_tax,
          SUM(wd.total_price) as grand_total
        FROM warehouse_details wd
        JOIN warehouse_documents doc ON wd.document_id = doc.id
        JOIN materials m ON wd.material_id = m.id
        WHERE doc.type = 'export'
          AND doc.document_date >= $1 
          AND doc.document_date <= $2
      `;

      // Filter by material ids (multiple select)
      if (materialIdsStr) {
        const materialIds = materialIdsStr.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));
        if (materialIds.length > 0) {
          query += ` AND wd.material_id = ANY($${paramCounter})`;
          params.push(materialIds);
          paramCounter++;
        }
      }

      // Filter by customer_id
      if (customerIdStr) {
        const customerId = parseInt(customerIdStr, 10);
        if (!isNaN(customerId)) {
          query += ` AND doc.customer_id = $${paramCounter}`;
          params.push(customerId);
          paramCounter++;
        }
      }

      // Filter by warehouse_code
      if (warehouseCode && warehouseCode.trim() !== '') {
        query += ` AND wd.warehouse_code = $${paramCounter}`;
        params.push(warehouseCode.trim());
        paramCounter++;
      }

      query += `
        GROUP BY m.id, m.material_code, m.name, m.unit, m.type
        ORDER BY m.name ASC
      `;

      const result = await pool.query(query, params);
      return NextResponse.json(result.rows);

    } else if (mode === 'detail') {
      if (!detailMaterialIdStr) {
        return NextResponse.json({ error: 'Thiếu thông tin vật tư cần xem chi tiết' }, { status: 400 });
      }
      const detailMaterialId = parseInt(detailMaterialIdStr, 10);
      if (isNaN(detailMaterialId)) {
        return NextResponse.json({ error: 'ID vật tư không hợp lệ' }, { status: 400 });
      }

      let query = `
        SELECT 
          doc.id as voucher_id,
          doc.document_no,
          doc.document_date,
          doc.partner_name,
          wd.warehouse_code,
          wd.quantity,
          wd.unit_price,
          (wd.quantity * wd.unit_price) as line_amount,
          wd.tax_percent,
          wd.total_price,
          m.name as material_name,
          m.material_code,
          m.unit as material_unit
        FROM warehouse_details wd
        JOIN warehouse_documents doc ON wd.document_id = doc.id
        JOIN materials m ON wd.material_id = m.id
        WHERE doc.type = 'export'
          AND wd.material_id = $1
          AND doc.document_date >= $2 
          AND doc.document_date <= $3
      `;

      params = [detailMaterialId, start_date, end_date];
      paramCounter = 4;

      // Filter by customer_id
      if (customerIdStr) {
        const customerId = parseInt(customerIdStr, 10);
        if (!isNaN(customerId)) {
          query += ` AND doc.customer_id = $${paramCounter}`;
          params.push(customerId);
          paramCounter++;
        }
      }

      // Filter by warehouse_code
      if (warehouseCode && warehouseCode.trim() !== '') {
        query += ` AND wd.warehouse_code = $${paramCounter}`;
        params.push(warehouseCode.trim());
        paramCounter++;
      }

      query += `
        ORDER BY doc.document_date DESC, doc.document_no DESC
      `;

      const result = await pool.query(query, params);
      return NextResponse.json(result.rows);
    }

    return NextResponse.json({ error: 'Mode không hợp lệ' }, { status: 400 });

  } catch (error) {
    console.error('Error generating export report:', error);
    return NextResponse.json({ error: 'Lỗi server nội bộ' }, { status: 500 });
  }
}
