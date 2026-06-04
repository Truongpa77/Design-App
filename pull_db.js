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
const destUrl = process.env.LOCAL_DATABASE_URL;

if (!sourceUrl) {
  console.error('❌ Lỗi: Không tìm thấy DATABASE_URL (Neon) trong file .env.local!');
  process.exit(1);
}

if (!destUrl) {
  console.error('❌ Lỗi: Không tìm thấy LOCAL_DATABASE_URL (Local Postgres) trong file .env.local!');
  console.log('Vui lòng cấu hình thêm dòng này vào .env.local, ví dụ:');
  console.log('LOCAL_DATABASE_URL=postgresql://postgres:123456@localhost:5432/design_db');
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
  console.log('=== ĐỒNG BỘ DỮ LIỆU TỪ NEON VỀ MÁY CỤC BỘ ===');
  console.log('🔗 Nguồn (Neon):', sourceUrl.split('@')[1] || sourceUrl);
  const sourceClient = new Client({ connectionString: sourceUrl, ssl: { rejectUnauthorized: false } });
  await sourceClient.connect();

  console.log('🔗 Đích (Local Postgres):', destUrl.split('@')[1] || destUrl);
  const destClient = new Client({ connectionString: destUrl });
  await destClient.connect();

  try {
    // 1. Dọn dẹp dữ liệu ở local theo thứ tự ngược lại (để tránh lỗi khóa ngoại)
    console.log('\n🧹 Bắt đầu dọn dẹp dữ liệu cũ ở Local...');
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
    console.log('\n🔄 Bắt đầu sao chép dữ liệu từ Neon về Local...');
    for (const table of tables) {
      console.log(`\n----------------------------------------`);
      console.log(`👉 Đồng bộ bảng: ${table.name}`);
      
      const srcRes = await sourceClient.query(table.query);
      console.log(`  - Tìm thấy ${srcRes.rows.length} dòng ở Neon.`);
      
      if (srcRes.rows.length === 0) {
        console.log(`  - Bảng trống, bỏ qua.`);
        continue;
      }

      const columns = Object.keys(srcRes.rows[0]);
      const insertQuery = `
        INSERT INTO ${table.name} (${columns.map(c => `"${c}"`).join(', ')})
        VALUES (${columns.map((_, idx) => `$${idx + 1}`).join(', ')})
      `;

      let count = 0;
      for (const row of srcRes.rows) {
        const values = columns.map(col => row[col]);
        await destClient.query(insertQuery, values);
        count++;
      }
      console.log(`  ✅ Đã đồng bộ ${count} dòng về Local.`);

      // 3. Reset sequence để không bị lỗi trùng khóa chính
      if (table.hasSequence) {
        try {
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
          console.warn(`  ⚠️ Không thể reset sequence:`, seqErr.message);
        }
      }
    }

    console.log('\n========================================');
    console.log('🎉 THÀNH CÔNG: Đã đồng bộ tất cả dữ liệu từ Neon về máy cục bộ!');
    console.log('========================================');
  } catch (globalErr) {
    console.error('\n❌ LỖI ĐỒNG BỘ:', globalErr.message);
  } finally {
    await sourceClient.end().catch(() => {});
    await destClient.end().catch(() => {});
  }
}

sync().catch(console.error);
