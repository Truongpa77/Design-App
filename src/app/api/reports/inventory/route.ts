import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

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
    const warehouseCode = searchParams.get('warehouse_code');
    const materialIdsStr = searchParams.get('material_ids'); // e.g. '1,2,3'

    if (!fromDate || !toDate) {
      return NextResponse.json({ error: 'Vui lòng chọn đầy đủ từ ngày và đến ngày' }, { status: 400 });
    }

    const start_date = `${fromDate} 00:00:00`;
    const end_date = `${toDate} 23:59:59`;

    let params: any[] = [start_date, end_date];
    let paramCounter = 3;

    // Building the query with dynamic filters
    let filterSql = '';

    if (warehouseCode && warehouseCode.trim() !== '') {
      filterSql += ` AND rd.warehouse_code = $${paramCounter}`;
      params.push(warehouseCode.trim());
      paramCounter++;
    }

    if (materialIdsStr) {
      const materialIds = materialIdsStr.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));
      if (materialIds.length > 0) {
        filterSql += ` AND rd.material_id = ANY($${paramCounter})`;
        params.push(materialIds);
        paramCounter++;
      }
    }

    const query = `
      WITH raw_data AS (
        -- Initial stock (đầu kỳ)
        SELECT 
          warehouse_code,
          material_id,
          quantity as qty,
          total_price as val,
          'initial' as tx_type,
          CAST('1970-01-01 00:00:00' AS TIMESTAMP) as doc_date
        FROM warehouse_initial_stock

        UNION ALL

        -- Imports (nhập)
        SELECT 
          wd.warehouse_code,
          wd.material_id,
          wd.quantity as qty,
          wd.line_amount as val,
          'import' as tx_type,
          CAST(doc.document_date AS TIMESTAMP) as doc_date
        FROM warehouse_details wd
        JOIN warehouse_documents doc ON wd.document_id = doc.id
        WHERE doc.type = 'import'

        UNION ALL

        -- Exports (xuất)
        SELECT 
          wd.warehouse_code,
          wd.material_id,
          wd.quantity as qty,
          wd.line_amount as val,
          'export' as tx_type,
          CAST(doc.document_date AS TIMESTAMP) as doc_date
        FROM warehouse_details wd
        JOIN warehouse_documents doc ON wd.document_id = doc.id
        WHERE doc.type = 'export'
      ),
      agg_data AS (
        SELECT 
          rd.warehouse_code,
          COALESCE(w.warehouse_name, rd.warehouse_code) as warehouse_name,
          rd.material_id,
          m.material_code,
          m.name as material_name,
          m.unit as material_unit,

          -- Opening (Đầu kỳ)
          COALESCE(SUM(CASE 
            WHEN rd.tx_type = 'initial' OR rd.doc_date < $1 THEN
              CASE 
                WHEN rd.tx_type = 'initial' THEN rd.qty
                WHEN rd.tx_type = 'import' THEN rd.qty
                WHEN rd.tx_type = 'export' THEN -rd.qty
                ELSE 0
              END
            ELSE 0
          END), 0)::float as opening_qty,

          COALESCE(SUM(CASE 
            WHEN rd.tx_type = 'initial' OR rd.doc_date < $1 THEN
              CASE 
                WHEN rd.tx_type = 'initial' THEN rd.val
                WHEN rd.tx_type = 'import' THEN rd.val
                WHEN rd.tx_type = 'export' THEN -rd.val
                ELSE 0
              END
            ELSE 0
          END), 0)::float as opening_val,

          -- Imports (Nhập trong kỳ)
          COALESCE(SUM(CASE 
            WHEN rd.doc_date >= $1 AND rd.doc_date <= $2 AND rd.tx_type = 'import' THEN rd.qty
            ELSE 0
          END), 0)::float as import_qty,

          COALESCE(SUM(CASE 
            WHEN rd.doc_date >= $1 AND rd.doc_date <= $2 AND rd.tx_type = 'import' THEN rd.val
            ELSE 0
          END), 0)::float as import_val,

          -- Exports (Xuất trong kỳ)
          COALESCE(SUM(CASE 
            WHEN rd.doc_date >= $1 AND rd.doc_date <= $2 AND rd.tx_type = 'export' THEN rd.qty
            ELSE 0
          END), 0)::float as export_qty,

          COALESCE(SUM(CASE 
            WHEN rd.doc_date >= $1 AND rd.doc_date <= $2 AND rd.tx_type = 'export' THEN rd.val
            ELSE 0
          END), 0)::float as export_val

        FROM raw_data rd
        JOIN warehouses w ON rd.warehouse_code = w.warehouse_code
        JOIN materials m ON rd.material_id = m.id
        WHERE 1=1 ${filterSql}
        GROUP BY rd.warehouse_code, w.warehouse_name, rd.material_id, m.material_code, m.name, m.unit
      )
      SELECT 
        *,
        (opening_qty + import_qty - export_qty)::float as closing_qty,
        (opening_val + import_val - export_val)::float as closing_val
      FROM agg_data
      WHERE (
        opening_qty <> 0 OR opening_val <> 0 OR 
        import_qty <> 0 OR import_val <> 0 OR 
        export_qty <> 0 OR export_val <> 0 OR 
        (opening_qty + import_qty - export_qty) <> 0 OR 
        (opening_val + import_val - export_val) <> 0
      )
      ORDER BY warehouse_code ASC, material_name ASC
    `;

    const result = await pool.query(query, params);
    return NextResponse.json(result.rows);

  } catch (error) {
    console.error('Error generating inventory report:', error);
    return NextResponse.json({ error: 'Lỗi server nội bộ' }, { status: 500 });
  }
}
