import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const quotationId = Number(resolvedParams.id);

  try {
    // 1. Lấy tất cả các dòng sản phẩm trong báo giá này
    const qiQuery = `
      SELECT qi.*, m.name as material_name, m.material_code, m.type as material_type, m.unit as material_unit
      FROM quotation_items qi
      JOIN materials m ON qi.material_id = m.id
      WHERE qi.quotation_id = $1
    `;
    const qiRes = await pool.query(qiQuery, [quotationId]);
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
        // Lấy định mức cấu phần của sản phẩm
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
          // Tính toán kích thước cấu phần theo kích thước báo giá thực tế
          let compLen = pb.length ? Number(pb.length) : null;
          let compWid = pb.width ? Number(pb.width) : null;

          if (pb.length_map === 'L') compLen = getCustomDim(pb.length, 'L', pb.std_prod_length, qi.length);
          else if (pb.length_map === 'W') compLen = getCustomDim(pb.length, 'W', pb.std_prod_width, qi.width);
          else if (pb.length_map === 'H') compLen = getCustomDim(pb.length, 'H', pb.std_prod_height, qi.height);

          if (pb.width_map === 'L') compWid = getCustomDim(pb.width, 'L', pb.std_prod_length, qi.length);
          else if (pb.width_map === 'W') compWid = getCustomDim(pb.width, 'W', pb.std_prod_width, qi.width);
          else if (pb.width_map === 'H') compWid = getCustomDim(pb.width, 'H', pb.std_prod_height, qi.height);

          // Tính toán định mức quy đổi
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

          // Cộng dồn vào phần tổng hợp (Summary)
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
        // Đối với vật tư trực tiếp (không qua BOM)
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

    // 3. Lấy thông tin điều chỉnh thủ công từ bảng material_demands
    const demandQuery = `SELECT material_id, custom_quantity FROM material_demands WHERE quotation_id = $1`;
    const demandRes = await pool.query(demandQuery, [quotationId]);
    const demandsMap = new Map<number, number>();
    demandRes.rows.forEach(d => demandsMap.set(d.material_id, Number(d.custom_quantity)));

    // Merge các thông tin điều chỉnh thủ công vào phần tổng hợp
    const summary = Array.from(summaryMap.values()).map(s => {
      const customQty = demandsMap.get(s.material_id);
      return {
        ...s,
        custom_quantity: customQty !== undefined ? customQty : null
      };
    });

    return NextResponse.json({
      summary,
      breakdown
    });
  } catch (error) {
    console.error('Calculate error:', error);
    return NextResponse.json({ error: 'Lỗi server nội bộ' }, { status: 500 });
  }
}
