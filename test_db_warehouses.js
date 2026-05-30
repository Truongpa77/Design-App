const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function runDiagnostics() {
  console.log('--- BẮT ĐẦU KIỂM TRA HỆ THỐNG DATABASE ---');
  console.log('Cấu hình kết nối:');
  console.log(`- Host: ${process.env.DB_HOST}`);
  console.log(`- Port: ${process.env.DB_PORT || '5432 (default)'}`);
  console.log(`- Database: ${process.env.DB_NAME}`);
  console.log(`- User: ${process.env.DB_USER}`);

  try {
    // 1. Kiểm tra kết nối
    console.log('\n1. Đang kết nối tới PostgreSQL...');
    const timeRes = await pool.query('SELECT NOW()');
    console.log(`✅ Kết nối thành công! Thời gian server DB: ${timeRes.rows[0].now}`);

    // 2. Kiểm tra xem bảng warehouses có tồn tại không
    console.log('\n2. Kiểm tra sự tồn tại của bảng "warehouses"...');
    const tableCheckRes = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'warehouses'
      );
    `);
    
    const exists = tableCheckRes.rows[0].exists;
    if (!exists) {
      console.log('❌ Bảng "warehouses" KHÔNG TỒN TẠI trong database!');
      console.log('👉 Hướng giải quyết: Hãy chạy lệnh: node src/scripts/init_db.js');
    } else {
      console.log('✅ Bảng "warehouses" ĐÃ TỒN TẠI.');

      // 3. Kiểm tra các cột trong bảng warehouses
      console.log('\n3. Cấu trúc các cột trong bảng "warehouses" hiện tại:');
      const columnsRes = await pool.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'warehouses'
        ORDER BY ordinal_position;
      `);
      
      columnsRes.rows.forEach(col => {
        console.log(`- Cột: ${col.column_name} | Kiểu: ${col.data_type} | Nullable: ${col.is_nullable}`);
      });

      // 4. Thử chạy truy vấn Insert nháp
      console.log('\n4. Thử ghi thử nghiệm một bản ghi vào "warehouses"...');
      try {
        const testRes = await pool.query(`
          INSERT INTO warehouses (warehouse_code, warehouse_name, description) 
          VALUES ('TESTCODE', 'Kho Test Diagnostic', 'Mo ta test') 
          RETURNING *
        `);
        console.log('✅ Ghi thử nghiệm THÀNH CÔNG! Dữ liệu trả về:', testRes.rows[0]);
        
        // Xóa dòng test vừa tạo
        await pool.query("DELETE FROM warehouses WHERE warehouse_code = 'TESTCODE'");
        console.log('✅ Đã dọn dẹp dữ liệu thử nghiệm.');
      } catch (insertErr) {
        console.log('❌ Ghi thử nghiệm THẤT BẠI!');
        console.error('Lỗi chi tiết:', insertErr.message);
        
        if (insertErr.message.includes('column') || insertErr.message.includes('attribute')) {
          console.log('\n👉 Hướng giải quyết: Cấu trúc bảng warehouses bị lệch. Hãy chạy lệnh này để xóa bảng cũ và tạo lại bảng mới:');
          console.log('   psql hoặc pgAdmin chạy lệnh: DROP TABLE warehouses CASCADE;');
          console.log('   Sau đó chạy lại kịch bản tạo: node src/scripts/init_db.js');
        }
      }
    }

  } catch (error) {
    console.log('❌ Kết nối database hoặc truy vấn thất bại!');
    console.error('Chi tiết lỗi:', error.message);
  } finally {
    await pool.end();
    console.log('\n--- KẾT THÚC KIỂM TRA ---');
  }
}

runDiagnostics();
