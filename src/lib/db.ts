import { Pool } from 'pg';
import { initializeSchema } from './dbInit';

const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL;
const host = process.env.DB_HOST || process.env.POSTGRES_HOST;

const isLocal = (!connectionString && (!host || host === 'localhost' || host === '127.0.0.1')) || 
                (connectionString && (connectionString.includes('localhost') || connectionString.includes('127.0.0.1')));

const sslConfig = isLocal ? false : { rejectUnauthorized: false };

const config = connectionString 
  ? { 
      connectionString, 
      ssl: sslConfig
    }
  : {
      host: host,
      port: parseInt(process.env.DB_PORT || process.env.POSTGRES_PORT || '5432', 10),
      database: process.env.DB_NAME || process.env.POSTGRES_DATABASE,
      user: process.env.DB_USER || process.env.POSTGRES_USER,
      password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD,
      ssl: sslConfig
    };

const pool = new Pool(config);


// Tự động chạy di cư CSDL (migration) khi khởi tạo pool kết nối
async function runAutoMigration() {
  try {
    // 0. Khởi tạo cấu trúc bảng cơ bản & seed dữ liệu mặc định nếu chưa có
    await initializeSchema(pool);

    // 1. Thêm các cột mapping vào bảng product_bom nếu chưa có
    await pool.query(`
      ALTER TABLE product_bom 
      ADD COLUMN IF NOT EXISTS length_map VARCHAR(10) DEFAULT 'Fixed',
      ADD COLUMN IF NOT EXISTS width_map VARCHAR(10) DEFAULT 'Fixed';
    `);
    console.log('✅ Auto-migration: product_bom altered successfully');

    // 2. Tạo bảng material_demands nếu chưa có
    await pool.query(`
      CREATE TABLE IF NOT EXISTS material_demands (
        id SERIAL PRIMARY KEY,
        quotation_id INTEGER REFERENCES quotations(id) ON DELETE CASCADE,
        material_id INTEGER REFERENCES materials(id) ON DELETE CASCADE,
        calculated_quantity NUMERIC NOT NULL,
        custom_quantity NUMERIC,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(quotation_id, material_id)
      );
    `);
    console.log('✅ Auto-migration: material_demands created successfully');

    // 3. Thêm cột updated_at vào bảng customers nếu chưa có
    await pool.query(`
      ALTER TABLE customers 
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);
    console.log('✅ Auto-migration: customers updated_at column added successfully');

    // 4. Thêm các cột cho warehouse_documents và warehouse_details nếu chưa có
    await pool.query(`
      ALTER TABLE warehouse_documents 
      ADD COLUMN IF NOT EXISTS subtotal_amount NUMERIC DEFAULT 0,
      ADD COLUMN IF NOT EXISTS tax_amount NUMERIC DEFAULT 0,
      ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;
    `);
    console.log('✅ Auto-migration: warehouse_documents columns added successfully');

    await pool.query(`
      ALTER TABLE warehouse_details 
      ADD COLUMN IF NOT EXISTS line_amount NUMERIC DEFAULT 0;
    `);
    console.log('✅ Auto-migration: warehouse_details line_amount column added successfully');

    // 5. Tạo hàm get_material_requirements
    await pool.query(`
      CREATE OR REPLACE FUNCTION get_material_requirements(
          p_from_date TIMESTAMP,
          p_to_date TIMESTAMP,
          p_quotation_id INT DEFAULT NULL
      )
      RETURNS TABLE (
          quotation_id INT,
          project_id INT,
          project_name VARCHAR,
          project_item_id INT,
          project_item_name VARCHAR,
          product_id INT,
          product_name VARCHAR,
          product_code VARCHAR,
          product_quantity NUMERIC,
          material_id INT,
          material_name VARCHAR,
          material_code VARCHAR,
          material_unit VARCHAR,
          material_type VARCHAR,
          component_name VARCHAR,
          component_length NUMERIC,
          component_width NUMERIC,
          component_quantity NUMERIC,
          calculated_quantity NUMERIC,
          custom_quantity NUMERIC,
          stock_quantity NUMERIC
      ) AS $$
      BEGIN
          RETURN QUERY
          WITH raw_requirements AS (
              -- 1. Sản phẩm đi qua BOM
              SELECT 
                  q.id as q_id,
                  q.project_id,
                  COALESCE(p.name, q.project_name, 'Không có công trình') :: VARCHAR as p_name,
                  qi.project_item_id,
                  COALESCE(pi.name, qi.category, 'Không có hạng mục') :: VARCHAR as p_item_name,
                  pm.id as prod_id,
                  pm.name :: VARCHAR as prod_name,
                  pm.material_code :: VARCHAR as prod_code,
                  qi.calculated_quantity as prod_qty,
                  m.id as mat_id,
                  m.name :: VARCHAR as mat_name,
                  m.material_code :: VARCHAR as mat_code,
                  m.unit :: VARCHAR as mat_unit,
                  m.type :: VARCHAR as mat_type,
                  pb.component_name :: VARCHAR as comp_name,
                  
                  CASE 
                      WHEN pb.length_map = 'L' AND pm.length > 0 THEN ROUND((pb.length * qi.length / pm.length) :: NUMERIC, 1)
                      WHEN pb.length_map = 'W' AND pm.width > 0 THEN ROUND((pb.length * qi.width / pm.width) :: NUMERIC, 1)
                      WHEN pb.length_map = 'H' AND pm.thickness > 0 THEN ROUND((pb.length * qi.height / pm.thickness) :: NUMERIC, 1)
                      ELSE pb.length
                  END as comp_len,
                  
                  CASE 
                      WHEN pb.width_map = 'L' AND pm.length > 0 THEN ROUND((pb.width * qi.length / pm.length) :: NUMERIC, 1)
                      WHEN pb.width_map = 'W' AND pm.width > 0 THEN ROUND((pb.width * qi.width / pm.width) :: NUMERIC, 1)
                      WHEN pb.width_map = 'H' AND pm.thickness > 0 THEN ROUND((pb.width * qi.height / pm.thickness) :: NUMERIC, 1)
                      ELSE pb.width
                  END as comp_wid,
                  
                  pb.quantity as comp_qty,
                  m.length as mat_len,
                  m.width as mat_wid,
                  m.stock_quantity as mat_stock
              FROM quotation_items qi
              JOIN quotations q ON qi.quotation_id = q.id
              LEFT JOIN projects p ON q.project_id = p.id
              LEFT JOIN projects pi ON qi.project_item_id = pi.id
              JOIN materials pm ON qi.material_id = pm.id
              JOIN product_bom pb ON qi.material_id = pb.product_id
              JOIN materials m ON pb.material_id = m.id
              WHERE q.quotation_date >= p_from_date AND q.quotation_date <= p_to_date
                AND (p_quotation_id IS NULL OR q.id = p_quotation_id)
                AND pm.type = 'Sản phẩm'

              UNION ALL

              -- 2. Vật tư trực tiếp (không qua BOM)
              SELECT 
                  q.id as q_id,
                  q.project_id,
                  COALESCE(p.name, q.project_name, 'Không có công trình') :: VARCHAR as p_name,
                  qi.project_item_id,
                  COALESCE(pi.name, qi.category, 'Không có hạng mục') :: VARCHAR as p_item_name,
                  NULL :: INT as prod_id,
                  'Vật tư trực tiếp' :: VARCHAR as prod_name,
                  '' :: VARCHAR as prod_code,
                  qi.calculated_quantity as prod_qty,
                  m.id as mat_id,
                  m.name :: VARCHAR as mat_name,
                  m.material_code :: VARCHAR as mat_code,
                  m.unit :: VARCHAR as mat_unit,
                  m.type :: VARCHAR as mat_type,
                  'Trực tiếp' :: VARCHAR as comp_name,
                  qi.length as comp_len,
                  qi.width as comp_wid,
                  1 :: NUMERIC as comp_qty,
                  m.length as mat_len,
                  m.width as mat_wid,
                  m.stock_quantity as mat_stock
              FROM quotation_items qi
              JOIN quotations q ON qi.quotation_id = q.id
              LEFT JOIN projects p ON q.project_id = p.id
              LEFT JOIN projects pi ON qi.project_item_id = pi.id
              JOIN materials m ON qi.material_id = m.id
              WHERE q.quotation_date >= p_from_date AND q.quotation_date <= p_to_date
                AND (p_quotation_id IS NULL OR q.id = p_quotation_id)
                AND m.type != 'Sản phẩm'
          ),
          calculated_requirements AS (
              SELECT 
                  r.q_id,
                  r.project_id,
                  r.p_name,
                  r.project_item_id,
                  r.p_item_name,
                  r.prod_id,
                  r.prod_name,
                  r.prod_code,
                  r.prod_qty,
                  r.mat_id,
                  r.mat_name,
                  r.mat_code,
                  r.mat_unit,
                  r.mat_type,
                  r.comp_name,
                  r.comp_len,
                  r.comp_wid,
                  r.comp_qty,
                  
                  CASE 
                      WHEN r.mat_type = 'Ván' THEN 
                          ROUND(
                              ((COALESCE(r.comp_len, 0) * COALESCE(r.comp_wid, 0) * COALESCE(r.comp_qty, 1)) / 
                              (COALESCE(r.mat_len, 1220) * COALESCE(r.mat_wid, 2440))) :: NUMERIC * r.prod_qty, 
                              4
                          )
                      ELSE 
                          COALESCE(r.comp_qty, 1) * r.prod_qty
                  END as calculated_qty,
                  r.mat_stock
              FROM raw_requirements r
          )
          SELECT 
              c.q_id as quotation_id,
              c.project_id,
              c.p_name as project_name,
              c.project_item_id,
              c.p_item_name as project_item_name,
              c.prod_id as product_id,
              c.prod_name as product_name,
              c.prod_code as product_code,
              c.prod_qty as product_quantity,
              c.mat_id as material_id,
              c.mat_name as material_name,
              c.mat_code as material_code,
              c.mat_unit as material_unit,
              c.mat_type as material_type,
              c.comp_name as component_name,
              c.comp_len as component_length,
              c.comp_wid as component_width,
              c.comp_qty as component_quantity,
              c.calculated_qty as calculated_quantity,
              COALESCE(
                  (SELECT d.custom_quantity FROM material_demands d WHERE d.material_id = c.mat_id AND d.quotation_id = c.q_id), 
                  c.calculated_qty
              ) as custom_quantity,
              c.mat_stock as stock_quantity
          FROM calculated_requirements c;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✅ Auto-migration: get_material_requirements stored function compiled');

    // 6. Đăng ký menu báo cáo nhu cầu vật tư vào Sidebar
    const parentRes = await pool.query(
      "SELECT id FROM layout_details WHERE title = 'BÁO CÁO' AND parent_id IS NULL AND layout_id = 'admin'"
    );
    if (parentRes.rows.length > 0) {
      const parentId = parentRes.rows[0].id;
      const menuCheck = await pool.query(
        "SELECT id FROM layout_details WHERE path = '/reports/material-requirements' AND layout_id = 'admin'"
      );
      if (menuCheck.rows.length === 0) {
        await pool.query(
          `INSERT INTO layout_details (parent_id, sort_order, title, icon, path, layout_id, show_in_menu, show_in_submenu) 
           VALUES ($1, 5, 'Nhu cầu vật tư', '📋', '/reports/material-requirements', 'admin', true, true)`,
          [parentId]
        );
        console.log('✅ Auto-migration: registered material requirements menu');
      }
    }

    // 7. Dọn dẹp dữ liệu trùng lặp và tạo các Unique Index để tránh trùng lặp sau này
    console.log('🧹 Auto-migration: cleaning up duplicates and creating unique indexes...');
    await pool.query(`
      DO $$
      DECLARE
          r RECORD;
          min_id INT;
      BEGIN
          FOR r IN 
              SELECT material_code, MIN(id) as keep_id 
              FROM materials 
              WHERE material_code IS NOT NULL 
              GROUP BY material_code 
              HAVING COUNT(*) > 1
          LOOP
              min_id := r.keep_id;
              UPDATE warehouse_transactions SET material_id = min_id WHERE material_id IN (SELECT id FROM materials WHERE material_code = r.material_code AND id <> min_id);
              UPDATE quotation_items SET material_id = min_id WHERE material_id IN (SELECT id FROM materials WHERE material_code = r.material_code AND id <> min_id);
              UPDATE product_bom SET product_id = min_id WHERE product_id IN (SELECT id FROM materials WHERE material_code = r.material_code AND id <> min_id);
              UPDATE product_bom SET material_id = min_id WHERE material_id IN (SELECT id FROM materials WHERE material_code = r.material_code AND id <> min_id);
              UPDATE material_demands SET material_id = min_id WHERE material_id IN (SELECT id FROM materials WHERE material_code = r.material_code AND id <> min_id);
              UPDATE warehouse_details SET material_id = min_id WHERE material_id IN (SELECT id FROM materials WHERE material_code = r.material_code AND id <> min_id);
              UPDATE warehouse_initial_stock SET material_id = min_id WHERE material_id IN (SELECT id FROM materials WHERE material_code = r.material_code AND id <> min_id);
              UPDATE financial_details SET material_id = min_id WHERE material_id IN (SELECT id FROM materials WHERE material_code = r.material_code AND id <> min_id);
              DELETE FROM materials WHERE material_code = r.material_code AND id <> min_id;
          END LOOP;
      END;
      $$;
    `);

    await pool.query(`
      DO $$
      DECLARE
          r RECORD;
          min_id INT;
      BEGIN
          FOR r IN 
              SELECT name, type, MIN(id) as keep_id 
              FROM materials 
              GROUP BY name, type
              HAVING COUNT(*) > 1
          LOOP
              min_id := r.keep_id;
              UPDATE warehouse_transactions SET material_id = min_id WHERE material_id IN (SELECT id FROM materials WHERE name = r.name AND type = r.type AND id <> min_id);
              UPDATE quotation_items SET material_id = min_id WHERE material_id IN (SELECT id FROM materials WHERE name = r.name AND type = r.type AND id <> min_id);
              UPDATE product_bom SET product_id = min_id WHERE product_id IN (SELECT id FROM materials WHERE name = r.name AND type = r.type AND id <> min_id);
              UPDATE product_bom SET material_id = min_id WHERE material_id IN (SELECT id FROM materials WHERE name = r.name AND type = r.type AND id <> min_id);
              UPDATE material_demands SET material_id = min_id WHERE material_id IN (SELECT id FROM materials WHERE name = r.name AND type = r.type AND id <> min_id);
              UPDATE warehouse_details SET material_id = min_id WHERE material_id IN (SELECT id FROM materials WHERE name = r.name AND type = r.type AND id <> min_id);
              UPDATE warehouse_initial_stock SET material_id = min_id WHERE material_id IN (SELECT id FROM materials WHERE name = r.name AND type = r.type AND id <> min_id);
              UPDATE financial_details SET material_id = min_id WHERE material_id IN (SELECT id FROM materials WHERE name = r.name AND type = r.type AND id <> min_id);
              DELETE FROM materials WHERE name = r.name AND type = r.type AND id <> min_id;
          END LOOP;
      END;
      $$;
    `);

    await pool.query(`
      DELETE FROM product_bom a USING product_bom b
      WHERE a.id > b.id 
        AND a.product_id = b.product_id 
        AND a.material_id = b.material_id 
        AND COALESCE(a.component_name, '') = COALESCE(b.component_name, '');
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_materials_code ON materials (material_code) WHERE material_code IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_product_bom_uniq ON product_bom (product_id, material_id, COALESCE(component_name, ''));
    `);
    console.log('✅ Auto-migration: duplicates cleaned up and unique indexes applied.');

    // 8. Seed Phụ kiện nội thất và cấu hình BOM mẫu
    console.log('🌱 Auto-migration: starting accessories and products seeding...');
    const seedAccessories = [
      { name: 'Tay nắm tủ hợp kim nhôm', type: 'Phụ kiện', unit: 'Cái', unit_price: 25000, code: 'PK-TN-TU' },
      { name: 'Bản lề giảm chấn inox 304', type: 'Phụ kiện', unit: 'Cái', unit_price: 35000, code: 'PK-BL-GC' },
      { name: 'Ray trượt bi 3 tầng giảm chấn', type: 'Phụ kiện', unit: 'Bộ', unit_price: 85000, code: 'PK-RAY-GC' },
      { name: 'Khóa tủ cốp 4 số', type: 'Phụ kiện', unit: 'Cái', unit_price: 45000, code: 'PK-KHOA-TU' },
      { name: 'Đèn LED thanh nhôm định hình 12V', type: 'Phụ kiện', unit: 'Mét', unit_price: 95000, code: 'PK-LED-AL' },
      { name: 'Suốt treo quần áo inox', type: 'Phụ kiện', unit: 'Cái', unit_price: 55000, code: 'PK-SUOT-AO' },
      { name: 'Giá bát đĩa nâng hạ tủ bếp trên', type: 'Phụ kiện', unit: 'Bộ', unit_price: 1850000, code: 'PK-GIA-BAT' },
      { name: 'Kệ góc liên hoàn tủ bếp dưới', type: 'Phụ kiện', unit: 'Bộ', unit_price: 2450000, code: 'PK-KE-GOC' },
      { name: 'Chân bàn sắt chữ U sơn tĩnh điện', type: 'Phụ kiện', unit: 'Cái', unit_price: 150000, code: 'PK-CHAN-BAN' },
      { name: 'Nắp luồn cáp bàn làm việc nhôm', type: 'Phụ kiện', unit: 'Cái', unit_price: 20000, code: 'PK-NAP-CAP' },
      { name: 'Khóa hộc kéo 3 ngăn', type: 'Phụ kiện', unit: 'Cái', unit_price: 40000, code: 'PK-KHOA-HK' },
      { name: 'Khóa vân tay cửa gỗ phòng ngủ', type: 'Phụ kiện', unit: 'Bộ', unit_price: 1500000, code: 'PK-KHOA-VT' },
      { name: 'Tay nắm cửa gỗ phòng ngủ', type: 'Phụ kiện', unit: 'Cái', unit_price: 120000, code: 'PK-TN-CUA' },
      { name: 'Bản lề lá inox cửa đi', type: 'Phụ kiện', unit: 'Cái', unit_price: 40000, code: 'PK-BL-CUA' },
      { name: 'Tay co thủy lực Hafele', type: 'Phụ kiện', unit: 'Bộ', unit_price: 450000, code: 'PK-TAYCO-CUA' },
      { name: 'Piston nâng giát giường thông minh', type: 'Phụ kiện', unit: 'Bộ', unit_price: 350000, code: 'PK-PISTON-GD' },
      { name: 'Ke góc liên kết sắt giường', type: 'Phụ kiện', unit: 'Cái', unit_price: 15000, code: 'PK-KE-GD' },
      { name: 'Bánh xe ghế xoay cao su', type: 'Phụ kiện', unit: 'Cái', unit_price: 12000, code: 'PK-BX-GHE' },
      { name: 'Piston nâng hạ ghế xoay D100', type: 'Phụ kiện', unit: 'Cái', unit_price: 75000, code: 'PK-PISTON-GHE' },
      { name: 'Mâm ghế xoay văn phòng', type: 'Phụ kiện', unit: 'Cái', unit_price: 95000, code: 'PK-MAM-GHE' },
      { name: 'Chân ghế xoay mạ crom', type: 'Phụ kiện', unit: 'Cái', unit_price: 180000, code: 'PK-CHAN-GHE' }
    ];

    const seedProducts = [
      { name: 'Cửa gỗ phòng ngủ', type: 'Sản phẩm', unit: 'Bộ', unit_price: 3200000, code: 'SP-CUA', length: 900, width: 40, thickness: 2200 },
      { name: 'Giường ngủ thông minh', type: 'Sản phẩm', unit: 'Cái', unit_price: 6500000, code: 'SP-GIUONG', length: 1800, width: 2000, thickness: 400 },
      { name: 'Bàn làm việc văn phòng', type: 'Sản phẩm', unit: 'Cái', unit_price: 2200000, code: 'SP-BAN', length: 1200, width: 600, thickness: 750 },
      { name: 'Ghế xoay văn phòng', type: 'Sản phẩm', unit: 'Cái', unit_price: 1350000, code: 'SP-GHE', length: 600, width: 600, thickness: 950 }
    ];

    const seedEdgeBands = [
      { name: 'Nẹp chỉ PVC 21x1mm Melamine', type: 'Nẹp chỉ', unit: 'Mét', unit_price: 3000, code: 'N-PVC-21', width: 21, thickness: 1 },
      { name: 'Nẹp chỉ PVC 43x2mm Acrylic', type: 'Nẹp chỉ', unit: 'Mét', unit_price: 12000, code: 'N-PVC-43', width: 43, thickness: 2 },
      { name: 'Nẹp chỉ Veneer sồi 21x0.5mm', type: 'Nẹp chỉ', unit: 'Mét', unit_price: 5000, code: 'N-VEN-21', width: 21, thickness: 0.5 }
    ];

    for (const item of seedAccessories) {
      const exists = await pool.query("SELECT id FROM materials WHERE material_code = $1", [item.code]);
      if (exists.rows.length === 0) {
        await pool.query(`
          INSERT INTO materials (name, type, unit, unit_price, material_code, stock_quantity)
          VALUES ($1, $2, $3, $4, $5, 100)
        `, [item.name, item.type, item.unit, item.unit_price, item.code]);
      }
    }

    for (const item of seedProducts) {
      const exists = await pool.query("SELECT id FROM materials WHERE material_code = $1", [item.code]);
      if (exists.rows.length === 0) {
        await pool.query(`
          INSERT INTO materials (name, type, length, width, thickness, unit, unit_price, material_code, stock_quantity)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 10)
        `, [item.name, item.type, item.length, item.width, item.thickness, item.unit, item.unit_price, item.code]);
      }
    }

    for (const item of seedEdgeBands) {
      const exists = await pool.query("SELECT id FROM materials WHERE material_code = $1", [item.code]);
      if (exists.rows.length === 0) {
        await pool.query(`
          INSERT INTO materials (name, type, length, width, thickness, unit, unit_price, material_code, stock_quantity)
          VALUES ($1, $2, null, $3, $4, $5, $6, $7, 500)
        `, [item.name, item.type, item.width, item.thickness, item.unit, item.unit_price, item.code]);
      }
    }

    const bomMappings = [
      {
        product_code: 'SP-TBT',
        components: [
          { component_name: 'Bản lề cánh giảm chấn', mat_code: 'PK-BL-GC', quantity: 8 },
          { component_name: 'Tay nắm tủ nhôm', mat_code: 'PK-TN-TU', quantity: 4 },
          { component_name: 'Giá bát đĩa nâng hạ', mat_code: 'PK-GIA-BAT', quantity: 1 },
          { component_name: 'Chỉ nẹp cạnh PVC 21mm', mat_code: 'N-PVC-21', quantity: 12 }
        ]
      },
      {
        product_code: 'SP-TBD',
        components: [
          { component_name: 'Bản lề cánh giảm chấn', mat_code: 'PK-BL-GC', quantity: 8 },
          { component_name: 'Tay nắm tủ nhôm', mat_code: 'PK-TN-TU', quantity: 4 },
          { component_name: 'Ray trượt bi hộc kéo', mat_code: 'PK-RAY-GC', quantity: 2 },
          { component_name: 'Kệ góc liên hoàn', mat_code: 'PK-KE-GOC', quantity: 1 },
          { component_name: 'Chỉ nẹp cạnh PVC 21mm', mat_code: 'N-PVC-21', quantity: 15 }
        ]
      },
      {
        product_code: 'SP-CUA',
        components: [
          { component_name: 'Bản lề lá inox', mat_code: 'PK-BL-CUA', quantity: 3 },
          { component_name: 'Tay nắm cửa phòng ngủ', mat_code: 'PK-TN-CUA', quantity: 1 },
          { component_name: 'Khóa vân tay thông minh', mat_code: 'PK-KHOA-VT', quantity: 1 },
          { component_name: 'Tay co thủy lực Hafele', mat_code: 'PK-TAYCO-CUA', quantity: 1 },
          { component_name: 'Chỉ nẹp cạnh PVC 43mm', mat_code: 'N-PVC-43', quantity: 6 }
        ]
      },
      {
        product_code: 'SP-GIUONG',
        components: [
          { component_name: 'Piston nâng giát giường', mat_code: 'PK-PISTON-GD', quantity: 1 },
          { component_name: 'Ke góc giường sắt', mat_code: 'PK-KE-GD', quantity: 8 }
        ]
      },
      {
        product_code: 'SP-BAN',
        components: [
          { component_name: 'Chân bàn sắt chữ U', mat_code: 'PK-CHAN-BAN', quantity: 2 },
          { component_name: 'Nắp luồn cáp bàn làm việc nhôm', mat_code: 'PK-NAP-CAP', quantity: 1 },
          { component_name: 'Khóa hộc kéo 3 ngăn', mat_code: 'PK-KHOA-HK', quantity: 1 },
          { component_name: 'Ray trượt bi hộc kéo', mat_code: 'PK-RAY-GC', quantity: 3 },
          { component_name: 'Chỉ nẹp cạnh PVC 21mm', mat_code: 'N-PVC-21', quantity: 8 }
        ]
      },
      {
        product_code: 'SP-GHE',
        components: [
          { component_name: 'Bánh xe ghế xoay', mat_code: 'PK-BX-GHE', quantity: 5 },
          { component_name: 'Piston nâng hạ ghế xoay D100', mat_code: 'PK-PISTON-GHE', quantity: 1 },
          { component_name: 'Mâm ghế xoay văn phòng', mat_code: 'PK-MAM-GHE', quantity: 1 },
          { component_name: 'Chân ghế xoay mạ crom', mat_code: 'PK-CHAN-GHE', quantity: 1 }
        ]
      }
    ];

    for (const mapping of bomMappings) {
      const prodRes = await pool.query("SELECT id FROM materials WHERE material_code = $1", [mapping.product_code]);
      if (prodRes.rows.length > 0) {
        const prodId = prodRes.rows[0].id;
        for (const comp of mapping.components) {
          const matRes = await pool.query("SELECT id FROM materials WHERE material_code = $1", [comp.mat_code]);
          if (matRes.rows.length > 0) {
            const matId = matRes.rows[0].id;
            const linkCheck = await pool.query(
              "SELECT id FROM product_bom WHERE product_id = $1 AND material_id = $2",
              [prodId, matId]
            );
            if (linkCheck.rows.length === 0) {
              await pool.query(
                `INSERT INTO product_bom 
                 (product_id, material_id, quantity_required, component_name, quantity, length_map, width_map) 
                 VALUES ($1, $2, $3, $4, $5, 'Fixed', 'Fixed')`,
                [prodId, matId, comp.quantity, comp.component_name, comp.quantity]
              );
            }
          }
        }
      }
    }
    console.log('✅ Auto-migration: accessories and products seeding complete');

  } catch (err) {
    console.error('❌ Auto-migration failed:', err);
  }
}

runAutoMigration();

export default pool;
