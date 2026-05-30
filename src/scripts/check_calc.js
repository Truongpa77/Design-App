const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5433', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function run() {
  try {
    const quotationId = 4;
    console.log(`Đang tính toán vật tư cho Báo giá ID: ${quotationId}...`);

    // 1. Summary query
    const summaryQuery = `
      SELECT 
        m.name as material_name,
        m.type as material_type,
        m.unit as material_unit,
        m.stock_quantity,
        SUM(qi.calculated_quantity * pb.quantity_required) as total_required
      FROM quotation_items qi
      JOIN product_bom pb ON qi.material_id = pb.product_id
      JOIN materials m ON pb.material_id = m.id
      WHERE qi.quotation_id = $1
      GROUP BY m.id, m.name, m.type, m.unit, m.stock_quantity
      ORDER BY m.type DESC, m.name ASC
    `;
    const summaryRes = await pool.query(summaryQuery, [quotationId]);

    // 2. Breakdown query
    const breakdownQuery = `
      SELECT 
        pm.name as product_name,
        qi.calculated_quantity as product_quantity,
        pb.component_name,
        pb.length as component_length,
        pb.width as component_width,
        pb.quantity as component_quantity,
        m.name as material_name,
        m.unit as material_unit,
        (qi.calculated_quantity * pb.quantity_required) as component_total_required
      FROM quotation_items qi
      JOIN materials pm ON qi.material_id = pm.id
      JOIN product_bom pb ON qi.material_id = pb.product_id
      JOIN materials m ON pb.material_id = m.id
      WHERE qi.quotation_id = $1
      ORDER BY m.name ASC, product_name ASC
    `;
    const breakdownRes = await pool.query(breakdownQuery, [quotationId]);

    console.log('\n--- BẢNG TỔNG HỢP NHU CẦU VẬT TƯ (SUMMARY) ---');
    console.table(summaryRes.rows.map(r => ({
      'Vật tư': r.material_name,
      'Phân loại': r.material_type,
      'Số lượng cần': `${Number(r.total_required).toFixed(4)} ${r.material_unit}`,
      'Tồn kho': `${Number(r.stock_quantity).toFixed(2)} ${r.material_unit}`
    })));

    console.log('\n--- CHI TIẾT CẤU PHẦN PHÂN RÃ (BREAKDOWN) ---');
    console.table(breakdownRes.rows.map(r => ({
      'Sản phẩm': r.product_name,
      'SL SP': r.product_quantity,
      'Cấu phần': r.component_name,
      'Kích thước': r.component_length ? `${r.component_length}x${r.component_width} mm` : '-',
      'SL tấm/cấu phần': r.component_quantity,
      'Vật tư sử dụng': r.material_name,
      'Quy đổi (Tấm/Cái)': `${Number(r.component_total_required).toFixed(4)} ${r.material_unit}`
    })));

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
