import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const quotationId = searchParams.get('quotation_id');

  try {
    if (!quotationId) {
      // 1. Nếu không truyền quotation_id, trả về danh sách Báo giá để hiển thị trên Dropdown
      const qListQuery = `
        SELECT q.id, q.document_no, q.quotation_date, q.total_price, q.status, c.name as customer_name, q.project_name
        FROM quotations q
        LEFT JOIN customers c ON q.customer_id = c.id
        ORDER BY q.quotation_date DESC, q.id DESC
      `;
      const qListRes = await pool.query(qListQuery);
      return NextResponse.json(qListRes.rows);
    }

    const qIdNum = Number(quotationId);

    // 2. Nếu có truyền quotation_id, tiến hành tính toán định mức tương tự API Quotation Calculate
    // Lấy chi tiết báo giá
    const qInfoQuery = `
      SELECT q.id, q.document_no, q.quotation_date, c.name as customer_name, q.project_name
      FROM quotations q
      LEFT JOIN customers c ON q.customer_id = c.id
      WHERE q.id = $1
    `;
    const qInfoRes = await pool.query(qInfoQuery, [qIdNum]);
    if (qInfoRes.rows.length === 0) {
      return NextResponse.json({ error: 'Không tìm thấy báo giá' }, { status: 404 });
    }
    const quotationInfo = qInfoRes.rows[0];

    // Lấy các dòng sản phẩm trong báo giá
    const qiQuery = `
      SELECT qi.*, m.name as material_name, m.material_code, m.type as material_type, m.unit as material_unit
      FROM quotation_items qi
      JOIN materials m ON qi.material_id = m.id
      WHERE qi.quotation_id = $1
    `;
    const qiRes = await pool.query(qiQuery, [qIdNum]);
    const quotationItems = qiRes.rows;

    const breakdown: any[] = [];
    const summaryMap = new Map<number, any>();

    // Hàm phụ tính toán kích thước cấu phần tùy biến theo tỷ lệ
    const getCustomDim = (compStdVal: any, map: string, stdProductVal: any, customProductVal: any) => {
      if (compStdVal === null || compStdVal === undefined) return null;
      const val = Number(compStdVal);
      if (map === 'Fixed' || !map) return val;
      const stdProd = Number(stdProductVal);
      const custProd = Number(customProductVal);
      if (stdProd > 0 && custProd > 0) {
        return Number((val * custProd / stdProd).toFixed(1));
      }
      return custProd || val;
    };

    for (const qi of quotationItems) {
      if (qi.material_type === 'Sản phẩm') {
        // Lấy định mức cấu phần
        const bomQuery = `
          SELECT pb.*, 
                 m.id as mat_id, m.name as mat_name, m.type as mat_type, m.unit as mat_unit, 
                 m.length as mat_length, m.width as mat_width, m.stock_quantity as mat_stock,
                 pm.length as std_prod_length, pm.width as std_prod_width, pm.thickness as std_prod_height
          FROM product_bom pb
          JOIN materials m ON pb.material_id = m.id
          JOIN materials pm ON pb.product_id = pm.id
          WHERE pb.product_id = $1
        `;
        const bomRes = await pool.query(bomQuery, [qi.material_id]);
        
        for (const pb of bomRes.rows) {
          let compLen = pb.length ? Number(pb.length) : null;
          let compWid = pb.width ? Number(pb.width) : null;

          if (pb.length_map === 'L') compLen = getCustomDim(pb.length, 'L', pb.std_prod_length, qi.length);
          else if (pb.length_map === 'W') compLen = getCustomDim(pb.length, 'W', pb.std_prod_width, qi.width);
          else if (pb.length_map === 'H') compLen = getCustomDim(pb.length, 'H', pb.std_prod_height, qi.height);

          if (pb.width_map === 'L') compWid = getCustomDim(pb.width, 'L', pb.std_prod_length, qi.length);
          else if (pb.width_map === 'W') compWid = getCustomDim(pb.width, 'W', pb.std_prod_width, qi.width);
          else if (pb.width_map === 'H') compWid = getCustomDim(pb.width, 'H', pb.std_prod_height, qi.height);

          let unitRequired = 0;
          if (pb.mat_type === 'Ván') {
            const sheetL = Number(pb.mat_length) || 1220;
            const sheetW = Number(pb.mat_width) || 2440;
            const sheetArea = sheetL * sheetW;
            const compArea = (compLen || 0) * (compWid || 0) * (Number(pb.quantity) || 1);
            unitRequired = sheetArea > 0 ? Number((compArea / sheetArea).toFixed(4)) : 0;
          } else {
            unitRequired = Number(pb.quantity) || 0;
          }

          const totalRequired = unitRequired * Number(qi.calculated_quantity);

          breakdown.push({
            quotation_item_id: qi.id,
            product_name: qi.material_name,
            product_code: qi.material_code,
            product_quantity: Number(qi.calculated_quantity),
            component_name: pb.component_name,
            component_length: compLen,
            component_width: compWid,
            component_quantity: pb.quantity ? Number(pb.quantity) : null,
            component_unit_required: unitRequired,
            component_total_required: totalRequired,
            material_id: pb.mat_id,
            material_name: pb.mat_name,
            material_type: pb.mat_type,
            material_unit: pb.mat_unit,
            mat_length: pb.mat_length ? Number(pb.mat_length) : null,
            mat_width: pb.mat_width ? Number(pb.mat_width) : null
          });

          if (summaryMap.has(pb.mat_id)) {
            const existing = summaryMap.get(pb.mat_id);
            existing.total_required += totalRequired;
          } else {
            summaryMap.set(pb.mat_id, {
              material_id: pb.mat_id,
              material_name: pb.mat_name,
              material_type: pb.mat_type,
              material_unit: pb.mat_unit,
              stock_quantity: Number(pb.mat_stock) || 0,
              total_required: totalRequired
            });
          }
        }
      } else {
        // Vật tư trực tiếp
        const matQuery = `SELECT stock_quantity FROM materials WHERE id = $1`;
        const matRes = await pool.query(matQuery, [qi.material_id]);
        const stockQty = matRes.rows[0]?.stock_quantity || 0;

        breakdown.push({
          quotation_item_id: qi.id,
          product_name: 'Vật tư trực tiếp',
          product_code: '',
          product_quantity: Number(qi.calculated_quantity),
          component_name: 'Trực tiếp',
          component_length: qi.length ? Number(qi.length) : null,
          component_width: qi.width ? Number(qi.width) : null,
          component_quantity: 1,
          component_unit_required: 1,
          component_total_required: Number(qi.calculated_quantity),
          material_id: qi.material_id,
          material_name: qi.material_name,
          material_type: qi.material_type,
          material_unit: qi.material_unit,
          mat_length: null,
          mat_width: null
        });

        if (summaryMap.has(qi.material_id)) {
          const existing = summaryMap.get(qi.material_id);
          existing.total_required += Number(qi.calculated_quantity);
        } else {
          summaryMap.set(qi.material_id, {
            material_id: qi.material_id,
            material_name: qi.material_name,
            material_type: qi.material_type,
            material_unit: qi.material_unit,
            stock_quantity: Number(stockQty) || 0,
            total_required: Number(qi.calculated_quantity)
          });
        }
      }
    }

    // Lấy thông tin điều chỉnh thủ công từ bảng material_demands
    const demandQuery = `SELECT material_id, custom_quantity FROM material_demands WHERE quotation_id = $1`;
    const demandRes = await pool.query(demandQuery, [qIdNum]);
    const demandsMap = new Map<number, number>();
    demandRes.rows.forEach(d => demandsMap.set(d.material_id, Number(d.custom_quantity)));

    const summary = Array.from(summaryMap.values()).map(s => {
      const customQty = demandsMap.get(s.material_id);
      return {
        ...s,
        custom_quantity: customQty !== undefined ? customQty : null
      };
    });

    return NextResponse.json({
      quotation: quotationInfo,
      summary,
      breakdown
    });
  } catch (error) {
    console.error('Synthesis calculation error:', error);
    return NextResponse.json({ error: 'Lỗi server nội bộ' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const client = await pool.connect();
  try {
    const { quotation_id, items } = await request.json(); // items: array of { material_id, calculated_quantity, custom_quantity }

    if (!quotation_id || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
    }

    await client.query('BEGIN');

    // Xóa các nhu cầu cũ của báo giá này
    await client.query('DELETE FROM material_demands WHERE quotation_id = $1', [quotation_id]);

    // Lưu các nhu cầu mới được điều chỉnh
    for (const item of items) {
      if (item.material_id) {
        await client.query(
          `INSERT INTO material_demands (quotation_id, material_id, calculated_quantity, custom_quantity) 
           VALUES ($1, $2, $3, $4)`,
          [
            quotation_id,
            item.material_id,
            Number(item.calculated_quantity || 0),
            item.custom_quantity !== undefined && item.custom_quantity !== '' && item.custom_quantity !== null ? Number(item.custom_quantity) : null
          ]
        );
      }
    }

    await client.query('COMMIT');
    return NextResponse.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Save demands error:', error);
    return NextResponse.json({ error: 'Lỗi server nội bộ' }, { status: 500 });
  } finally {
    client.release();
  }
}
