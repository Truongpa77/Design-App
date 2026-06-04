const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
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

const client = new Client(config);

async function createMenuTables() {
  try {
    await client.connect();
    console.log('✅ Kết nối DB thành công');

    // Tạo bảng layout_details
    await client.query(`
      CREATE TABLE IF NOT EXISTS layout_details (
        id          SERIAL PRIMARY KEY,
        layout_id   VARCHAR(50) DEFAULT 'admin',
        parent_id   INTEGER REFERENCES layout_details(id) ON DELETE CASCADE,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        title       VARCHAR(200) NOT NULL,
        icon        VARCHAR(10) DEFAULT '📁',
        path        VARCHAR(200),
        is_active   BOOLEAN DEFAULT true,
        show_in_menu BOOLEAN DEFAULT true,
        show_in_submenu BOOLEAN DEFAULT true,
        created_at  TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Tạo bảng layout_details thành công');

    // Tạo index
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_layout_details_parent ON layout_details(parent_id);
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_layout_details_layout_path ON layout_details(layout_id, path) WHERE path IS NOT NULL;
    `);
    console.log('✅ Tạo index thành công');

    // Kiểm tra xem đã có dữ liệu chưa
    const check = await client.query('SELECT COUNT(*) FROM layout_details');
    if (parseInt(check.rows[0].count) > 0) {
      console.log('⚠️ Bảng layout_details đã có dữ liệu, bỏ qua seed.');
      return;
    }

    // ============================================================
    // SEED DATA
    // ============================================================
    console.log('🌱 Bắt đầu seed dữ liệu...');

    // 1. DANH MỤC
    const g1 = await client.query(
      `INSERT INTO layout_details (parent_id, sort_order, title, icon, path, layout_id, show_in_menu, show_in_submenu) VALUES (NULL, 1, 'DANH MỤC', '📋', NULL, 'admin', true, true) RETURNING id`
    );
    const g1Id = g1.rows[0].id;

    const danhMucItems = [
      { sort: 1, title: 'Khách hàng',             icon: '👥', path: '/customers' },
      { sort: 2, title: 'Vật tư & SP',            icon: '🧱', path: '/materials' },
      { sort: 3, title: 'Kho bãi',                icon: '📦', path: '/warehouse' },
      { sort: 4, title: 'Công trình & Hạng mục',  icon: '🏗️', path: '/projects' },
      { sort: 5, title: 'Định mức BOM',           icon: '⚙️', path: '/bom' },
      { sort: 6, title: 'Danh mục tài khoản',     icon: '💳', path: '/accounts' },
    ];
    for (const item of danhMucItems) {
      await client.query(
        `INSERT INTO layout_details (parent_id, sort_order, title, icon, path, layout_id, show_in_menu, show_in_submenu) VALUES ($1, $2, $3, $4, $5, 'admin', true, true)`,
        [g1Id, item.sort, item.title, item.icon, item.path]
      );
    }

    // 2. CHỨNG TỪ
    const g2 = await client.query(
      `INSERT INTO layout_details (parent_id, sort_order, title, icon, path, layout_id, show_in_menu, show_in_submenu) VALUES (NULL, 2, 'CHỨNG TỪ', '📄', NULL, 'admin', true, true) RETURNING id`
    );
    const g2Id = g2.rows[0].id;

    const chungTuItems = [
      { sort: 1, title: 'Báo giá',    icon: '📝', path: '/quotations' },
      { sort: 2, title: 'Phiếu nhập', icon: '📥', path: '/vouchers/import' },
      { sort: 3, title: 'Phiếu xuất', icon: '📤', path: '/vouchers/export' },
      { sort: 4, title: 'Phiếu thu',  icon: '💵', path: '/vouchers/receipt' },
      { sort: 5, title: 'Phiếu chi',  icon: '💸', path: '/vouchers/payment' },
      { sort: 6, title: 'Báo nợ',     icon: '🏦', path: '/vouchers/debit-advice' },
      { sort: 7, title: 'Báo có',     icon: '🏦', path: '/vouchers/credit-advice' },
    ];
    for (const item of chungTuItems) {
      await client.query(
        `INSERT INTO layout_details (parent_id, sort_order, title, icon, path, layout_id, show_in_menu, show_in_submenu) VALUES ($1, $2, $3, $4, $5, 'admin', true, true)`,
        [g2Id, item.sort, item.title, item.icon, item.path]
      );
    }

    // 3. TỔNG HỢP
    const g3 = await client.query(
      `INSERT INTO layout_details (parent_id, sort_order, title, icon, path, layout_id, show_in_menu, show_in_submenu) VALUES (NULL, 3, 'TỔNG HỢP', '🧮', NULL, 'admin', true, true) RETURNING id`
    );
    const g3Id = g3.rows[0].id;

    const tongHopItems = [
      { sort: 1, title: 'Tính nhu cầu mua',    icon: '🧮', path: '/synthesis/bom-calc' },
      { sort: 2, title: 'Tồn kho đầu kỳ',      icon: '📥', path: '/synthesis/opening-stock' },
      { sort: 3, title: 'Số dư đầu tài khoản', icon: '💵', path: '/synthesis/opening-balances' },
    ];
    for (const item of tongHopItems) {
      await client.query(
        `INSERT INTO layout_details (parent_id, sort_order, title, icon, path, layout_id, show_in_menu, show_in_submenu) VALUES ($1, $2, $3, $4, $5, 'admin', true, true)`,
        [g3Id, item.sort, item.title, item.icon, item.path]
      );
    }

    // 4. BÁO CÁO
    const g4 = await client.query(
      `INSERT INTO layout_details (parent_id, sort_order, title, icon, path, layout_id, show_in_menu, show_in_submenu) VALUES (NULL, 4, 'BÁO CÁO', '📊', NULL, 'admin', true, true) RETURNING id`
    );
    const g4Id = g4.rows[0].id;

    const baoCaoItems = [
      { sort: 1, title: 'Báo cáo nhập',              icon: '📊', path: '/reports/imports' },
      { sort: 2, title: 'Báo cáo xuất',              icon: '📈', path: '/reports/exports' },
      { sort: 3, title: 'Nhập xuất tồn',             icon: '📋', path: '/reports/inventory' },
      { sort: 4, title: 'Số quỹ hoặc sổ ngân hàng',  icon: '💵', path: '/reports/cashbook' },
    ];
    for (const item of baoCaoItems) {
      await client.query(
        `INSERT INTO layout_details (parent_id, sort_order, title, icon, path, layout_id, show_in_menu, show_in_submenu) VALUES ($1, $2, $3, $4, $5, 'admin', true, true)`,
        [g4Id, item.sort, item.title, item.icon, item.path]
      );
    }

    // 5. HỆ THỐNG
    const g5 = await client.query(
      `INSERT INTO layout_details (parent_id, sort_order, title, icon, path, layout_id, show_in_menu, show_in_submenu) VALUES (NULL, 5, 'HỆ THỐNG', '⚙️', NULL, 'admin', true, true) RETURNING id`
    );
    const g5Id = g5.rows[0].id;

    const heThongItems = [
      { sort: 1, title: 'Người sử dụng',      icon: '🧑‍💻', path: '/system/users' },
      { sort: 2, title: 'Thiết lập hệ thống', icon: '⚙️',  path: '/system/settings' },
      { sort: 3, title: 'Quản lý menu',       icon: '📋',  path: '/system/menu-config' },
    ];
    for (const item of heThongItems) {
      await client.query(
        `INSERT INTO layout_details (parent_id, sort_order, title, icon, path, layout_id, show_in_menu, show_in_submenu) VALUES ($1, $2, $3, $4, $5, 'admin', true, true)`,
        [g5Id, item.sort, item.title, item.icon, item.path]
      );
    }

    console.log('✅ Seed dữ liệu thành công (5 phân hệ + 23 chức năng)');
  } catch (err) {
    console.error('❌ Lỗi:', err);
  } finally {
    await client.end();
  }
}

createMenuTables();
