const { Client } = require('pg');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables from .env.local
if (fs.existsSync('.env.local')) {
  const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

const sourceUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
const destUrl = process.argv[2];

if (!sourceUrl) {
  console.error('❌ Lỗi: Không tìm thấy DATABASE_URL nguồn trong file .env.local!');
  process.exit(1);
}

if (!destUrl) {
  console.log('\n--- HƯỚNG DẪN CHẠY SCRIPT ĐỒNG BỘ TOÀN BỘ CSDL ---');
  console.log('Vui lòng cung cấp connection string của database đích (mới) làm tham số.');
  console.log('Ví dụ:');
  console.log('node sync_db_tables.js "postgres://neondb_owner:password@ep-host.us-east-1.aws.neon.tech/neondb?sslmode=require"');
  console.log('--------------------------------------------------\n');
  process.exit(1);
}

// Danh sách các bảng theo thứ tự phụ thuộc (bảng con xếp sau bảng cha)
const tables = [
  { name: 'users', query: 'SELECT * FROM users ORDER BY id ASC', hasSequence: true },
  { name: 'customers', query: 'SELECT * FROM customers ORDER BY id ASC', hasSequence: true },
  { name: 'materials', query: 'SELECT * FROM materials ORDER BY id ASC', hasSequence: true },
  { name: 'layouts', query: 'SELECT * FROM layouts ORDER BY id ASC', hasSequence: false },
  { name: 'features', query: 'SELECT * FROM features ORDER BY id ASC', hasSequence: true },
  { name: 'warehouses', query: 'SELECT * FROM warehouses ORDER BY id ASC', hasSequence: true },
  { name: 'lookup_configs', query: 'SELECT * FROM lookup_configs ORDER BY id ASC', hasSequence: true },
  { name: 'projects', query: 'SELECT * FROM projects ORDER BY id ASC', hasSequence: true },
  { name: 'accounts', query: 'SELECT * FROM accounts ORDER BY account_code ASC', hasSequence: true },
  { name: 'layout_details', query: 'SELECT * FROM layout_details ORDER BY id ASC', hasSequence: true },
  { name: 'product_bom', query: 'SELECT * FROM product_bom ORDER BY id ASC', hasSequence: true },
  { name: 'warehouse_initial_stock', query: 'SELECT * FROM warehouse_initial_stock ORDER BY id ASC', hasSequence: true },
  { name: 'warehouse_transactions', query: 'SELECT * FROM warehouse_transactions ORDER BY id ASC', hasSequence: true },
  { name: 'quotations', query: 'SELECT * FROM quotations ORDER BY id ASC', hasSequence: true },
  { name: 'transactions', query: 'SELECT * FROM transactions ORDER BY id ASC', hasSequence: true },
  { name: 'warehouse_documents', query: 'SELECT * FROM warehouse_documents ORDER BY id ASC', hasSequence: true },
  { name: 'warehouse_details', query: 'SELECT * FROM warehouse_details ORDER BY id ASC', hasSequence: true },
  { name: 'quotation_items', query: 'SELECT * FROM quotation_items ORDER BY id ASC', hasSequence: true },
  { name: 'material_demands', query: 'SELECT * FROM material_demands ORDER BY id ASC', hasSequence: true },
  { name: 'account_initial_balances', query: 'SELECT * FROM account_initial_balances ORDER BY id ASC', hasSequence: true },
  { name: 'financial_documents', query: 'SELECT * FROM financial_documents ORDER BY id ASC', hasSequence: true },
  { name: 'financial_details', query: 'SELECT * FROM financial_details ORDER BY id ASC', hasSequence: true }
];

async function sync() {
  console.log('🔗 Đang kết nối tới database Nguồn (cũ):', sourceUrl.split('@')[1] || sourceUrl);
  const sourceClient = new Client({ connectionString: sourceUrl, ssl: { rejectUnauthorized: false } });
  await sourceClient.connect();

  console.log('🔗 Đang kết nối tới database Đích (mới):', destUrl.split('@')[1] || destUrl);
  const destClient = new Client({ connectionString: destUrl, ssl: { rejectUnauthorized: false } });
  await destClient.connect();

  try {
    // 1. Dọn dẹp dữ liệu ở database đích theo thứ tự ngược lại (để tránh lỗi khóa ngoại)
    console.log('\n🧹 Bắt đầu dọn dẹp dữ liệu cũ ở database Đích...');
    for (let i = tables.length - 1; i >= 0; i--) {
      const table = tables[i].name;
      try {
        console.log(`- Truncate bảng ${table}...`);
        await destClient.query(`TRUNCATE TABLE ${table} CASCADE`);
      } catch (err) {
        console.warn(`⚠️ Cảnh báo khi dọn dẹp bảng ${table}:`, err.message);
      }
    }

    // 2. Đồng bộ dữ liệu theo thứ tự xuôi
    console.log('\n🔄 Bắt đầu sao chép dữ liệu...');
    for (const table of tables) {
      console.log(`\n----------------------------------------`);
      console.log(`👉 Đồng bộ bảng: ${table.name}`);
      
      // Đọc dữ liệu từ nguồn
      const srcRes = await sourceClient.query(table.query);
      console.log(`  - Tìm thấy ${srcRes.rows.length} dòng ở nguồn.`);
      
      if (srcRes.rows.length === 0) {
        console.log(`  - Bảng trống, bỏ qua.`);
        continue;
      }

      // Tạo truy vấn chèn dữ liệu
      const columns = Object.keys(srcRes.rows[0]);
      const insertQuery = `
        INSERT INTO ${table.name} (${columns.map(c => `"${c}"`).join(', ')})
        VALUES (${columns.map((_, idx) => `$${idx + 1}`).join(', ')})
      `;

      // Chèn từng dòng vào database đích
      let count = 0;
      for (const row of srcRes.rows) {
        const values = columns.map(col => row[col]);
        await destClient.query(insertQuery, values);
        count++;
      }
      console.log(`  ✅ Đã đồng bộ thành công ${count} dòng vào bảng ${table.name}.`);

      // 3. Reset sequence để không bị lỗi trùng khóa chính (duplicate key) khi chèn mới sau này
      if (table.hasSequence) {
        try {
          // Lấy tên sequence thuộc cột id
          const seqRes = await destClient.query(`
            SELECT pg_get_serial_sequence($1, 'id') as seq_name
          `, [table.name]);
          const seqName = seqRes.rows[0]?.seq_name;
          
          if (seqName) {
            await destClient.query(`
              SELECT setval($1, COALESCE(MAX(id), 1)) FROM ${table.name}
            `, [seqName]);
            console.log(`  🔄 Đã reset sequence: ${seqName}`);
          }
        } catch (seqErr) {
          console.warn(`  ⚠️ Không thể reset sequence cho bảng ${table.name}:`, seqErr.message);
        }
      }
    }

    console.log('\n========================================');
    console.log('🎉 THÀNH CÔNG: Đã đồng bộ toàn bộ cơ sở dữ liệu!');
    console.log('========================================');
  } catch (globalErr) {
    console.error('\n❌ LỖI ĐỒNG BỘ TOÀN CỤC:', globalErr.message);
  } finally {
    await sourceClient.end().catch(() => {});
    await destClient.end().catch(() => {});
  }
}

sync().catch(console.error);
