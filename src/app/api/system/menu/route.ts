import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

async function ensureLayoutsAndColumns() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create layouts table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS layouts (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        icon VARCHAR(20) DEFAULT '📋',
        is_system BOOLEAN DEFAULT false
      );
    `);

    // Seed default layouts if empty
    const checkLayouts = await client.query('SELECT COUNT(*) FROM layouts');
    if (parseInt(checkLayouts.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO layouts (id, name, icon, is_system) VALUES
        ('admin', 'Admin', '🔑', true),
        ('office', 'Office', '🏢', true),
        ('design', 'Design', '🎨', true)
      `);
    }

    // 1.5. Create features table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS features (
        id SERIAL PRIMARY KEY,
        title VARCHAR(100) NOT NULL,
        icon VARCHAR(20) DEFAULT '📋',
        path VARCHAR(200) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed default features if empty
    const checkFeatures = await client.query('SELECT COUNT(*) FROM features');
    if (parseInt(checkFeatures.rows[0].count, 10) === 0) {
      const defaultFeatures = [
        // DANH MỤC
        { title: 'Khách hàng', icon: '👥', path: '/customers' },
        { title: 'Vật tư & SP', icon: '🧱', path: '/materials' },
        { title: 'Kho bãi', icon: '📦', path: '/warehouse' },
        { title: 'Công trình & Hạng mục', icon: '🏗️', path: '/projects' },
        { title: 'Định mức BOM', icon: '⚙️', path: '/bom' },
        { title: 'Danh mục tài khoản', icon: '💳', path: '/accounts' },
        { title: 'Danh mục giao dịch', icon: '🔄', path: '/transactions' },
        
        // CHỨNG TỪ
        { title: 'Báo giá', icon: '📝', path: '/quotations' },
        { title: 'Phiếu nhập', icon: '📥', path: '/vouchers/import' },
        { title: 'Phiếu xuất', icon: '📤', path: '/vouchers/export' },
        { title: 'Phiếu thu', icon: '💵', path: '/vouchers/receipt' },
        { title: 'Phiếu chi', icon: '💸', path: '/vouchers/payment' },
        { title: 'Báo nợ', icon: '🏦', path: '/vouchers/debit-advice' },
        { title: 'Báo có', icon: '🏦', path: '/vouchers/credit-advice' },
        
        // TỔNG HỢP
        { title: 'Tính nhu cầu mua', icon: '🧮', path: '/synthesis/bom-calc' },
        { title: 'Tồn kho đầu kỳ', icon: '📥', path: '/synthesis/opening-stock' },
        { title: 'Số dư đầu tài khoản', icon: '💵', path: '/synthesis/opening-balances' },
        
        // BÁO CÁO
        { title: 'Báo cáo nhập', icon: '📊', path: '/reports/imports' },
        { title: 'Báo cáo xuất', icon: '📈', path: '/reports/exports' },
        { title: 'Nhập xuất tồn', icon: '📋', path: '/reports/inventory' },
        { title: 'Số quỹ hoặc sổ ngân hàng', icon: '💵', path: '/reports/cashbook' },
        
        // HỆ THỐNG
        { title: 'Người sử dụng', icon: '🧑‍💻', path: '/system/users' },
        { title: 'Thiết lập hệ thống', icon: '⚙️', path: '/system/settings' },
        { title: 'Quản lý menu', icon: '📋', path: '/system/menu-config' }
      ];
 
      for (const f of defaultFeatures) {
        await client.query(
          'INSERT INTO features (title, icon, path) VALUES ($1, $2, $3) ON CONFLICT (path) DO NOTHING',
          [f.title, f.icon, f.path]
        );
      }
      console.log('🌱 Seeded default features catalog');
    }

    // Đảm bảo Danh mục giao dịch luôn có mặt trong bảng features
    await client.query(
      'INSERT INTO features (title, icon, path) VALUES ($1, $2, $3) ON CONFLICT (path) DO NOTHING',
      ['Danh mục giao dịch', '🔄', '/transactions']
    );

    // 2. Rename menu_nodes to layout_details if it exists
    await client.query(`
      ALTER TABLE IF EXISTS menu_nodes RENAME TO layout_details;
    `);

    // 3. Create layout_details table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS layout_details (
        id SERIAL PRIMARY KEY,
        layout_id VARCHAR(50) REFERENCES layouts(id) ON DELETE CASCADE DEFAULT 'admin',
        parent_id INTEGER REFERENCES layout_details(id) ON DELETE CASCADE,
        sort_order INTEGER,
        title VARCHAR(100) NOT NULL,
        icon VARCHAR(20) DEFAULT '📁',
        path VARCHAR(200),
        is_active BOOLEAN DEFAULT true,
        show_in_menu BOOLEAN DEFAULT true,
        show_in_submenu BOOLEAN DEFAULT true
      );
    `);

    // 4. Add layout_id column to layout_details if not present (in case of legacy/partial tables)
    await client.query(`
      ALTER TABLE layout_details
      ADD COLUMN IF NOT EXISTS layout_id VARCHAR(50) REFERENCES layouts(id) ON DELETE CASCADE DEFAULT 'admin';
    `);

    // 5. Add show_in_menu and show_in_submenu columns if not present
    await client.query(`
      ALTER TABLE layout_details ADD COLUMN IF NOT EXISTS show_in_menu BOOLEAN DEFAULT true;
      ALTER TABLE layout_details ADD COLUMN IF NOT EXISTS show_in_submenu BOOLEAN DEFAULT true;
    `);

    // 6. Migrate any NULL layout_id to 'admin'
    await client.query(`
      UPDATE layout_details SET layout_id = 'admin' WHERE layout_id IS NULL;
    `);

    // 7. Update unique index on path to be layout-aware
    await client.query(`
      DROP INDEX IF EXISTS idx_menu_nodes_path;
      DROP INDEX IF EXISTS idx_menu_nodes_layout_path;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_layout_details_layout_path 
      ON layout_details (layout_id, path) 
      WHERE (path IS NOT NULL);
    `);

    // 8. Clean up corrupted non-admin layouts (only categories, no features) to trigger full seed
    const layoutsToCheck = await client.query("SELECT id FROM layouts WHERE id <> 'admin'");
    for (const row of layoutsToCheck.rows) {
      const lId = row.id;
      const featureCheck = await client.query(
        "SELECT COUNT(*) FROM layout_details WHERE layout_id = $1 AND path IS NOT NULL",
        [lId]
      );
      if (parseInt(featureCheck.rows[0].count, 10) === 0) {
        console.log(`🧹 Cleaning up corrupted layout menu nodes for: ${lId}`);
        await client.query("DELETE FROM layout_details WHERE layout_id = $1", [lId]);
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in database migration for layouts:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function seedLayoutDefaultMenu(layoutId: string) {
  const check = await pool.query('SELECT COUNT(*) FROM layout_details WHERE layout_id = $1', [layoutId]);
  if (parseInt(check.rows[0].count, 10) > 0) {
    return;
  }

  console.log(`🌱 Seeding default menu nodes for layout: ${layoutId}`);
  
  // Create 5 main active category folders
  const categories = [
    { key: 'danh_muc', title: 'DANH MỤC', icon: '📋', sort: 1 },
    { key: 'chung_tu', title: 'CHỨNG TỪ', icon: '📄', sort: 2 },
    { key: 'tong_hop', title: 'TỔNG HỢP', icon: '🧮', sort: 3 },
    { key: 'bao_cao',  title: 'BÁO CÁO',  icon: '📊', sort: 4 },
    { key: 'he_thong', title: 'HỆ THỐNG', icon: '⚙️',  sort: 5 }
  ];

  const catMap: { [key: string]: number } = {};
  for (const cat of categories) {
    const res = await pool.query(
      `INSERT INTO layout_details (parent_id, sort_order, title, icon, path, is_active, layout_id, show_in_menu, show_in_submenu)
       VALUES (NULL, $1, $2, $3, NULL, true, $4, true, true) RETURNING id`,
      [cat.sort, cat.title, cat.icon, layoutId]
    );
    catMap[cat.key] = res.rows[0].id;
  }

  // Query features from database features catalog
  const featuresRes = await pool.query('SELECT title, icon, path FROM features');

  const officePaths = new Set([
    '/customers', '/accounts', '/quotations', '/vouchers/receipt',
    '/vouchers/payment', '/vouchers/debit-advice', '/vouchers/credit-advice',
    '/synthesis/opening-balances', '/reports/exports', '/reports/cashbook',
    '/system/settings', '/system/menu-config'
  ]);

  const designPaths = new Set([
    '/materials', '/warehouse', '/bom', '/vouchers/import',
    '/vouchers/export', '/synthesis/bom-calc', '/synthesis/opening-stock',
    '/reports/imports', '/reports/exports', '/reports/inventory'
  ]);

  const getCategoryKey = (path: string): string => {
    if (['/customers', '/materials', '/warehouse', '/projects', '/bom', '/accounts'].includes(path)) return 'danh_muc';
    if (['/quotations', '/vouchers/import', '/vouchers/export', '/vouchers/receipt', '/vouchers/payment', '/vouchers/debit-advice', '/vouchers/credit-advice'].includes(path)) return 'chung_tu';
    if (['/synthesis/bom-calc', '/synthesis/opening-stock', '/synthesis/opening-balances'].includes(path)) return 'tong_hop';
    if (['/reports/imports', '/reports/exports', '/reports/inventory', '/reports/cashbook'].includes(path)) return 'bao_cao';
    if (['/system/users', '/system/settings', '/system/menu-config'].includes(path)) return 'he_thong';
    return 'danh_muc';
  };

  let order = 1;
  for (const f of featuresRes.rows) {
    let isActive = false;
    if (layoutId === 'admin') {
      isActive = true;
    } else if (layoutId === 'office') {
      isActive = officePaths.has(f.path);
    } else if (layoutId === 'design') {
      isActive = designPaths.has(f.path);
    }

    if (isActive) {
      const catKey = getCategoryKey(f.path);
      const parentId = catMap[catKey];

      await pool.query(
        `INSERT INTO layout_details (parent_id, sort_order, title, icon, path, is_active, layout_id, show_in_menu, show_in_submenu)
         VALUES ($1, $2, $3, $4, $5, true, $6, true, true)`,
        [parentId, order++, f.title, f.icon, f.path, layoutId]
      );
    }
  }
}

export async function GET(request: Request) {
  try {
    await ensureLayoutsAndColumns();
    
    const { searchParams } = new URL(request.url);
    const layout = searchParams.get('layout') || 'admin';

    // Seed default menus for non-admin layouts if they are empty
    if (layout !== 'admin') {
      await seedLayoutDefaultMenu(layout);
    }

    // Filter strictly by the requested layout ID
    const result = await pool.query(
      'SELECT id, parent_id, sort_order, title, icon, path, is_active, layout_id, show_in_menu, show_in_submenu FROM layout_details WHERE layout_id = $1 ORDER BY sort_order ASC, id ASC',
      [layout]
    );

    return NextResponse.json(result.rows, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error) {
    console.error('Error fetching menu nodes:', error);
    return NextResponse.json({ error: 'Lỗi server khi lấy dữ liệu menu' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureLayoutsAndColumns();
    
    const { searchParams } = new URL(request.url);
    const layout = searchParams.get('layout') || 'admin';

    const data = await request.json();
    const { parent_id, title, icon, path, is_active, show_in_menu, show_in_submenu } = data;

    if (!title) {
      return NextResponse.json({ error: 'Vui lòng nhập tên hiển thị' }, { status: 400 });
    }

    // Get max sort_order scoped to this layout
    const orderResult = await pool.query(
      'SELECT COALESCE(MAX(sort_order), 0) as max_order FROM layout_details WHERE layout_id = $1 AND parent_id IS NOT DISTINCT FROM $2',
      [layout, parent_id || null]
    );
    const nextOrder = parseInt(orderResult.rows[0].max_order, 10) + 1;

    const query = `
      INSERT INTO layout_details (parent_id, sort_order, title, icon, path, is_active, layout_id, show_in_menu, show_in_submenu)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, parent_id, sort_order, title, icon, path, is_active, layout_id, show_in_menu, show_in_submenu
    `;
    const values = [
      parent_id || null,
      nextOrder,
      title.trim(),
      icon || '📁',
      path ? path.trim() : null,
      is_active !== undefined ? is_active : true,
      layout,
      show_in_menu !== undefined ? show_in_menu : true,
      show_in_submenu !== undefined ? show_in_submenu : true
    ];

    const result = await pool.query(query, values);
    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    console.error('Error creating menu node:', error);
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Đường dẫn (path) này đã tồn tại' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Lỗi server khi tạo node menu' }, { status: 500 });
  }
}
