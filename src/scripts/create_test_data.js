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
    console.log('Khởi chạy tiến trình tạo dữ liệu thử nghiệm...');

    // 1. Tạo Khách hàng Nguyễn Văn A
    let custRes = await pool.query("SELECT id FROM customers WHERE name = 'Nguyễn Văn A'");
    let custId;
    if (custRes.rows.length > 0) {
      custId = custRes.rows[0].id;
      console.log(`Đã tìm thấy khách hàng Nguyễn Văn A (ID: ${custId})`);
    } else {
      let insertCust = await pool.query(
        "INSERT INTO customers (name, phone, address) VALUES ($1, $2, $3) RETURNING id",
        ['Nguyễn Văn A', '0912345678', 'Cầu Giấy, Hà Nội']
      );
      custId = insertCust.rows[0].id;
      console.log(`Đã tạo khách hàng mới Nguyễn Văn A (ID: ${custId})`);
    }

    // 2. Tạo Công trình mới: CT Biệt thự Phố
    let projCode = 'CT-BTP-' + Date.now().toString().slice(-4);
    let projRes = await pool.query(
      "INSERT INTO projects (code, name, type, notes) VALUES ($1, $2, $3, $4) RETURNING id",
      [projCode, 'Dự án Biệt thự Phố', 'Công trình', 'Báo giá thiết kế trọn gói phòng khách và bếp biệt thự']
    );
    let projId = projRes.rows[0].id;
    console.log(`Đã tạo Công trình: Dự án Biệt thự Phố (ID: ${projId}, Code: ${projCode})`);

    // 3. Tạo Hạng mục: Phòng khách & Bếp
    let pkRes = await pool.query(
      "INSERT INTO projects (code, name, type, parent_id, notes) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      ['HM-PK-' + Date.now().toString().slice(-3), 'Phòng khách', 'Hạng mục', projId, 'Nội thất phòng khách']
    );
    let pkId = pkRes.rows[0].id;

    let bpRes = await pool.query(
      "INSERT INTO projects (code, name, type, parent_id, notes) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      ['HM-B-' + Date.now().toString().slice(-3), 'Bếp', 'Hạng mục', projId, 'Nội thất bếp']
    );
    let bpId = bpRes.rows[0].id;
    console.log(`Đã tạo các hạng mục: Phòng khách (ID: ${pkId}), Bếp (ID: ${bpId})`);

    // 4. Tạo hoặc lấy Vật tư ván MDF và Phụ kiện
    const materialsData = [
      { name: 'Ván MDF Melamine 17mm', type: 'Ván', length: 1220, width: 2440, thickness: 17, unit: 'Tấm', unit_price: 350000, code: 'V-MDF17' },
      { name: 'Ván MDF Melamine 6mm', type: 'Ván', length: 1220, width: 2440, thickness: 6, unit: 'Tấm', unit_price: 150000, code: 'V-MDF06' },
      { name: 'Ván MDF Acrylic 18mm', type: 'Ván', length: 1220, width: 2440, thickness: 18, unit: 'Tấm', unit_price: 950000, code: 'V-MDF18AC' },
      { name: 'Bản lề hơi giảm chấn', type: 'Phụ kiện', length: null, width: null, thickness: null, unit: 'Cái', unit_price: 15000, code: 'PK-BL' }
    ];

    const materialsMap = {};
    for (const item of materialsData) {
      let checkMat = await pool.query("SELECT id, length, width FROM materials WHERE name = $1", [item.name]);
      if (checkMat.rows.length > 0) {
        materialsMap[item.code] = { id: checkMat.rows[0].id, length: Number(checkMat.rows[0].length || 1220), width: Number(checkMat.rows[0].width || 2440) };
        console.log(`Đã lấy vật tư: ${item.name} (ID: ${checkMat.rows[0].id})`);
      } else {
        let insertMat = await pool.query(
          "INSERT INTO materials (name, type, length, width, thickness, unit, unit_price, material_code) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",
          [item.name, item.type, item.length, item.width, item.thickness, item.unit, item.unit_price, item.code]
        );
        materialsMap[item.code] = { id: insertMat.rows[0].id, length: item.length || 1220, width: item.width || 2440 };
        console.log(`Đã tạo vật tư mới: ${item.name} (ID: ${insertMat.rows[0].id})`);
      }
    }

    // 5. Tạo các Sản phẩm trong vật tư (type = 'Sản phẩm')
    const productsData = [
      { name: 'Kệ tivi MDF', type: 'Sản phẩm', unit: 'Cái', unit_price: 3500000, code: 'SP-KTV' },
      { name: 'Bàn uống nước gỗ', type: 'Sản phẩm', unit: 'Cái', unit_price: 1500000, code: 'SP-BUN' },
      { name: 'Ghế sofa gỗ nỉ', type: 'Sản phẩm', unit: 'Bộ', unit_price: 8500000, code: 'SP-GSF' },
      { name: 'Tủ trang trí gỗ', type: 'Sản phẩm', unit: 'Cái', unit_price: 7500000, code: 'SP-TTT' },
      { name: 'Tủ bếp trên tủ', type: 'Sản phẩm', unit: 'Bộ', unit_price: 5200000, code: 'SP-TBT' },
      { name: 'Tủ bếp dưới tủ', type: 'Sản phẩm', unit: 'Bộ', unit_price: 6800000, code: 'SP-TBD' }
    ];

    const productsMap = {};
    for (const item of productsData) {
      let checkProd = await pool.query("SELECT id FROM materials WHERE name = $1", [item.name]);
      if (checkProd.rows.length > 0) {
        productsMap[item.code] = checkProd.rows[0].id;
        console.log(`Đã lấy sản phẩm: ${item.name} (ID: ${checkProd.rows[0].id})`);
      } else {
        let insertProd = await pool.query(
          "INSERT INTO materials (name, type, length, width, thickness, unit, unit_price, material_code) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",
          [item.name, item.type, null, null, null, item.unit, item.unit_price, item.code]
        );
        productsMap[item.code] = insertProd.rows[0].id;
        console.log(`Đã tạo sản phẩm mới: ${item.name} (ID: ${insertProd.rows[0].id})`);
      }
    }

    // 6. Định nghĩa Định mức BOM chi tiết cấu phần (hông, đáy, hậu, cánh...) cho các sản phẩm
    // Hàm phụ để tính toán số tấm quy đổi diện tích
    const calcQtyRequired = (matCode, len, wid, q) => {
      const mat = materialsMap[matCode];
      if (!mat || !len || !wid) return q;
      const sheetArea = mat.length * mat.width;
      const compArea = Number(len) * Number(wid) * Number(q);
      return Number((compArea / sheetArea).toFixed(4));
    };

    const boms = [
      // Kệ tivi MDF
      {
        product_code: 'SP-KTV',
        components: [
          { component_name: 'Khung kệ', mat_code: 'V-MDF17', length: 1800, width: 400, quantity: 2 },
          { component_name: 'Hậu kệ', mat_code: 'V-MDF06', length: 1800, width: 450, quantity: 1 }
        ]
      },
      // Bàn uống nước gỗ
      {
        product_code: 'SP-BUN',
        components: [
          { component_name: 'Mặt bàn', mat_code: 'V-MDF17', length: 1200, width: 600, quantity: 1 }
        ]
      },
      // Ghế sofa
      {
        product_code: 'SP-GSF',
        components: [
          { component_name: 'Khung sofa', mat_code: 'V-MDF17', length: 2000, width: 800, quantity: 1 }
        ]
      },
      // Tủ trang trí (kích thước user yêu cầu: 1000 x 800, cao 3300)
      {
        product_code: 'SP-TTT',
        components: [
          { component_name: 'Hông tủ đứng', mat_code: 'V-MDF17', length: 3300, width: 800, quantity: 2 },
          { component_name: 'Đáy + Đỉnh', mat_code: 'V-MDF17', length: 1000, width: 800, quantity: 2 },
          { component_name: 'Đợt trang trí', mat_code: 'V-MDF17', length: 1000, width: 800, quantity: 5 },
          { component_name: 'Hậu tủ 6mm', mat_code: 'V-MDF06', length: 3300, width: 1000, quantity: 1 }
        ]
      },
      // Tủ bếp trên (user: 2500, 700, 600)
      {
        product_code: 'SP-TBT',
        components: [
          { component_name: 'Hông tủ trên', mat_code: 'V-MDF17', length: 700, width: 600, quantity: 2 },
          { component_name: 'Đáy + Đỉnh tủ trên', mat_code: 'V-MDF17', length: 2500, width: 600, quantity: 2 },
          { component_name: 'Hậu tủ trên 6mm', mat_code: 'V-MDF06', length: 2500, width: 700, quantity: 1 },
          { component_name: 'Cánh tủ Acrylic', mat_code: 'V-MDF18AC', length: 700, width: 620, quantity: 4 },
          { component_name: 'Bản lề cánh', mat_code: 'PK-BL', length: null, width: null, quantity: 8 }
        ]
      },
      // Tủ bếp dưới (tương ứng: 2500 x 800 x 600)
      {
        product_code: 'SP-TBD',
        components: [
          { component_name: 'Hông tủ dưới', mat_code: 'V-MDF17', length: 800, width: 600, quantity: 2 },
          { component_name: 'Đáy tủ dưới', mat_code: 'V-MDF17', length: 2500, width: 600, quantity: 1 },
          { component_name: 'Hậu tủ dưới 6mm', mat_code: 'V-MDF06', length: 2500, width: 800, quantity: 1 },
          { component_name: 'Cánh tủ Acrylic', mat_code: 'V-MDF18AC', length: 800, width: 620, quantity: 4 },
          { component_name: 'Bản lề cánh', mat_code: 'PK-BL', length: null, width: null, quantity: 8 }
        ]
      }
    ];

    for (const bom of boms) {
      const pId = productsMap[bom.product_code];
      // Xóa cấu hình cũ
      await pool.query("DELETE FROM product_bom WHERE product_id = $1", [pId]);

      // Chèn các chi tiết cấu phần mới
      for (const comp of bom.components) {
        const matId = materialsMap[comp.mat_code].id;
        const qtyReq = calcQtyRequired(comp.mat_code, comp.length, comp.width, comp.quantity);
        await pool.query(
          `INSERT INTO product_bom 
           (product_id, material_id, quantity_required, component_name, length, width, quantity) 
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [pId, matId, qtyReq, comp.component_name, comp.length, comp.width, comp.quantity]
        );
      }
      console.log(`Đã tạo BOM chi tiết cho sản phẩm: ${bom.product_code}`);
    }

    // 7. Tạo Báo giá mới
    const docNo = 'BG-2026-' + Date.now().toString().slice(-4);
    const quotationDate = new Date();
    
    // Tính tổng tiền báo giá (gồm thuế VAT 10%)
    const quotationItems = [
      { product_code: 'SP-KTV', price: 3500000, qty: 1, cat_id: pkId, len: 1800, wid: 400, hgt: 450 },
      { product_code: 'SP-BUN', price: 1500000, qty: 1, cat_id: pkId, len: 1200, wid: 600, hgt: 450 },
      { product_code: 'SP-GSF', price: 8500000, qty: 1, cat_id: pkId, len: 2000, wid: 800, hgt: 750 },
      { product_code: 'SP-TTT', price: 7500000, qty: 1, cat_id: pkId, len: 1000, wid: 800, hgt: 3300 }, // Tủ trang trí
      { product_code: 'SP-TBT', price: 5200000, qty: 1, cat_id: bpId, len: 2500, wid: 700, hgt: 600 },  // Tủ bếp trên
      { product_code: 'SP-TBD', price: 6800000, qty: 1, cat_id: bpId, len: 2500, wid: 800, hgt: 600 }   // Tủ bếp dưới
    ];

    let subtotal = 0;
    quotationItems.forEach(i => subtotal += i.price * i.qty);
    const taxPercent = 10;
    const grandTotal = subtotal * (1 + taxPercent / 100);

    const qRes = await pool.query(
      `INSERT INTO quotations (customer_id, total_price, status, quotation_date, document_no, project_name, description, partner_address, project_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        custId,
        grandTotal,
        'draft',
        quotationDate,
        docNo,
        'Dự án Biệt thự Phố',
        'Báo giá nội thất trọn gói Phòng khách và Phòng bếp nhà Nguyễn Văn A',
        'Cầu Giấy, Hà Nội',
        projId
      ]
    );
    const quotationId = qRes.rows[0].id;
    console.log(`Đã tạo Báo giá thành công: ID: ${quotationId}, Số: ${docNo}`);

    // 8. Chèn các mặt hàng của báo giá
    for (const item of quotationItems) {
      const matId = productsMap[item.product_code];
      const lineTotal = item.price * item.qty * (1 + taxPercent / 100);
      
      await pool.query(
        `INSERT INTO quotation_items (
          quotation_id, material_id, calculated_quantity, unit_price, total_price, 
          length, width, height, category, tax_percent, project_item_id
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          quotationId,
          matId,
          item.qty,
          item.price,
          lineTotal,
          item.len,
          item.wid,
          item.hgt,
          item.product_code === 'SP-TBT' || item.product_code === 'SP-TBD' ? 'Bếp' : 'Phòng khách',
          taxPercent,
          item.cat_id
        ]
      );
    }
    console.log(`Đã thêm thành công ${quotationItems.length} mặt hàng vào Báo giá.`);

    console.log('Hoàn thành! Bạn có thể tải lại trang Báo giá trên giao diện và nhấn nút "Tính toán" của báo giá này để xem kết quả tính toán ván gỗ chi tiết.');
  } catch (err) {
    console.error('Lỗi khi chạy script tạo dữ liệu thử nghiệm:', err);
  } finally {
    await pool.end();
  }
}

run();
