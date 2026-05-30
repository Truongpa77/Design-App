const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const initSql = `
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS materials (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    length NUMERIC,
    width NUMERIC,
    thickness NUMERIC,
    unit VARCHAR(20),
    unit_price NUMERIC NOT NULL,
    stock_quantity NUMERIC DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    material_code VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS warehouse_transactions (
    id SERIAL PRIMARY KEY,
    material_id INTEGER REFERENCES materials(id),
    transaction_type VARCHAR(20) NOT NULL, -- 'import' or 'export'
    quantity NUMERIC NOT NULL,
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS quotations (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    total_price NUMERIC NOT NULL,
    status VARCHAR(50) DEFAULT 'draft',
    quotation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bổ sung cột quotation_date nếu chưa có
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS quotation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS quotation_items (
    id SERIAL PRIMARY KEY,
    quotation_id INTEGER REFERENCES quotations(id) ON DELETE CASCADE,
    material_id INTEGER REFERENCES materials(id),
    calculated_quantity NUMERIC NOT NULL,
    unit_price NUMERIC NOT NULL,
    total_price NUMERIC NOT NULL,
    length NUMERIC,
    width NUMERIC,
    height NUMERIC
);

-- Bổ sung cột kích thước nếu chưa có
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS length NUMERIC;
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS width NUMERIC;
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS height NUMERIC;

CREATE TABLE IF NOT EXISTS product_bom (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES materials(id) ON DELETE CASCADE,
    material_id INTEGER REFERENCES materials(id) ON DELETE CASCADE,
    quantity_required NUMERIC NOT NULL,
    component_name VARCHAR(100),
    length NUMERIC,
    width NUMERIC,
    quantity NUMERIC,
    length_map VARCHAR(10) DEFAULT 'Fixed',
    width_map VARCHAR(10) DEFAULT 'Fixed'
);

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

-- V2: Warehouse Documents
CREATE TABLE IF NOT EXISTS warehouse_documents (
    id SERIAL PRIMARY KEY,
    document_no VARCHAR(100) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'import' or 'export'
    document_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    partner_name VARCHAR(255),
    partner_address TEXT,
    description TEXT,
    subtotal_amount NUMERIC DEFAULT 0,
    tax_amount NUMERIC DEFAULT 0,
    total_amount NUMERIC DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS warehouse_details (
    id SERIAL PRIMARY KEY,
    document_id INTEGER REFERENCES warehouse_documents(id) ON DELETE CASCADE,
    material_id INTEGER REFERENCES materials(id),
    warehouse_code VARCHAR(100),
    quantity NUMERIC NOT NULL,
    unit_price NUMERIC DEFAULT 0,
    tax_percent NUMERIC DEFAULT 0,
    line_amount NUMERIC DEFAULT 0,
    total_price NUMERIC DEFAULT 0
);

CREATE TABLE IF NOT EXISTS warehouse_initial_stock (
    id SERIAL PRIMARY KEY,
    warehouse_code VARCHAR(50) NOT NULL,
    opening_date DATE NOT NULL,
    material_id INTEGER REFERENCES materials(id) ON DELETE CASCADE,
    quantity NUMERIC NOT NULL DEFAULT 0,
    unit_price NUMERIC NOT NULL DEFAULT 0,
    total_price NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(warehouse_code, material_id)
);

CREATE TABLE IF NOT EXISTS lookup_configs (
    id SERIAL PRIMARY KEY,
    lookup_key VARCHAR(50) UNIQUE NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    value_field VARCHAR(50) DEFAULT 'id',
    display_field VARCHAR(100) DEFAULT 'name',
    sublabel_field VARCHAR(100),
    search_fields VARCHAR(100)[] NOT NULL,
    additional_filter VARCHAR(255),
    parent_field VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

async function initializeDatabase() {
  try {
    console.log('Đang khởi tạo các bảng trong CSDL...');
    await pool.query(initSql);

    // Tạo bảng warehouses nếu chưa có
    await pool.query(`
      CREATE TABLE IF NOT EXISTS warehouses (
        id SERIAL PRIMARY KEY,
        warehouse_code VARCHAR(50) UNIQUE NOT NULL,
        warehouse_name VARCHAR(200) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Tạo bảng projects nếu chưa có
    await pool.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        parent_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Thêm các trường project_id và project_item_id vào bảng quotations nếu chưa có
    await pool.query(`
      ALTER TABLE quotations 
      ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS project_item_id INTEGER REFERENCES projects(id) ON DELETE SET NULL;
    `);

    // Thêm cột role vào bảng users nếu chưa có (vì database đã có sẵn từ project trước)
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user'");

    // Thêm cột material_code vào bảng materials nếu chưa có
    await pool.query("ALTER TABLE materials ADD COLUMN IF NOT EXISTS material_code VARCHAR(100)");

    // Thêm cột updated_at vào bảng materials nếu chưa có
    await pool.query("ALTER TABLE materials ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");

    // Thêm các cột mapping vào product_bom nếu chưa có
    await pool.query(`
      ALTER TABLE product_bom 
      ADD COLUMN IF NOT EXISTS length_map VARCHAR(10) DEFAULT 'Fixed',
      ADD COLUMN IF NOT EXISTS width_map VARCHAR(10) DEFAULT 'Fixed';
    `);

    // Thêm cột updated_at vào bảng customers nếu chưa có
    await pool.query(`
      ALTER TABLE customers 
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

    // Thêm các cột cho warehouse_documents và warehouse_details nếu chưa có
    await pool.query(`
      ALTER TABLE warehouse_documents 
      ADD COLUMN IF NOT EXISTS subtotal_amount NUMERIC DEFAULT 0,
      ADD COLUMN IF NOT EXISTS tax_amount NUMERIC DEFAULT 0,
      ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;
    `);
    await pool.query(`
      ALTER TABLE warehouse_details 
      ADD COLUMN IF NOT EXISTS line_amount NUMERIC DEFAULT 0;
    `);

    // Tạo bảng material_demands nếu chưa có
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

    // Tạo bảng warehouse_initial_stock nếu chưa có
    await pool.query(`
      CREATE TABLE IF NOT EXISTS warehouse_initial_stock (
          id SERIAL PRIMARY KEY,
          warehouse_code VARCHAR(50) NOT NULL,
          opening_date DATE NOT NULL,
          material_id INTEGER REFERENCES materials(id) ON DELETE CASCADE,
          quantity NUMERIC NOT NULL DEFAULT 0,
          unit_price NUMERIC NOT NULL DEFAULT 0,
          total_price NUMERIC NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(warehouse_code, material_id)
      );
    `);

    // Tạo bảng lookup_configs nếu chưa có
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lookup_configs (
          id SERIAL PRIMARY KEY,
          lookup_key VARCHAR(50) UNIQUE NOT NULL,
          table_name VARCHAR(100) NOT NULL,
          value_field VARCHAR(50) DEFAULT 'id',
          display_field VARCHAR(100) DEFAULT 'name',
          sublabel_field VARCHAR(100),
          search_fields VARCHAR(100)[] NOT NULL,
          additional_filter VARCHAR(255),
          parent_field VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed lookup configurations
    const seedLookups = [
      {
        lookup_key: 'customer',
        table_name: 'customers',
        value_field: 'id',
        display_field: 'name',
        sublabel_field: 'phone',
        search_fields: ['name', 'phone', 'address'],
        additional_filter: null,
        parent_field: null
      },
      {
        lookup_key: 'material',
        table_name: 'materials',
        value_field: 'id',
        display_field: 'name',
        sublabel_field: 'material_code',
        search_fields: ['name', 'material_code'],
        additional_filter: null,
        parent_field: null
      },
      {
        lookup_key: 'project',
        table_name: 'projects',
        value_field: 'id',
        display_field: 'name',
        sublabel_field: 'code',
        search_fields: ['name', 'code'],
        additional_filter: "type = 'Công trình'",
        parent_field: null
      },
      {
        lookup_key: 'project_item',
        table_name: 'projects',
        value_field: 'id',
        display_field: 'name',
        sublabel_field: null,
        search_fields: ['name'],
        additional_filter: "type = 'Hạng mục'",
        parent_field: 'parent_id'
      },
      {
        lookup_key: 'account',
        table_name: 'accounts',
        value_field: 'account_code',
        display_field: 'account_name',
        sublabel_field: 'account_code',
        search_fields: ['account_code', 'account_name'],
        additional_filter: 'is_active = true',
        parent_field: null
      },
      {
        lookup_key: 'leaf_account',
        table_name: 'accounts',
        value_field: 'account_code',
        display_field: 'account_name',
        sublabel_field: 'account_code',
        search_fields: ['account_code', 'account_name'],
        additional_filter: 'is_active = true AND NOT EXISTS (SELECT 1 FROM accounts sub WHERE sub.parent_code = accounts.account_code)',
        parent_field: null
      },
      {
        lookup_key: 'transaction',
        table_name: 'transactions',
        value_field: 'transaction_code',
        display_field: 'transaction_name',
        sublabel_field: 'transaction_code',
        search_fields: ['transaction_code', 'transaction_name'],
        additional_filter: 'is_active = true',
        parent_field: null
      }
    ];

    for (const lookup of seedLookups) {
      await pool.query(`
        INSERT INTO lookup_configs 
          (lookup_key, table_name, value_field, display_field, sublabel_field, search_fields, additional_filter, parent_field)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (lookup_key) DO UPDATE SET
          table_name = EXCLUDED.table_name,
          value_field = EXCLUDED.value_field,
          display_field = EXCLUDED.display_field,
          sublabel_field = EXCLUDED.sublabel_field,
          search_fields = EXCLUDED.search_fields,
          additional_filter = EXCLUDED.additional_filter,
          parent_field = EXCLUDED.parent_field
      `, [
        lookup.lookup_key,
        lookup.table_name,
        lookup.value_field,
        lookup.display_field,
        lookup.sublabel_field,
        lookup.search_fields,
        lookup.additional_filter,
        lookup.parent_field
      ]);
    }

    // Tạo bảng accounts
    await pool.query(`
      CREATE TABLE IF NOT EXISTS accounts (
          id SERIAL PRIMARY KEY,
          account_code VARCHAR(50) UNIQUE NOT NULL,
          account_name VARCHAR(255) NOT NULL,
          parent_code VARCHAR(50) REFERENCES accounts(account_code) ON DELETE SET NULL,
          track_foreign_currency BOOLEAN DEFAULT FALSE,
          track_object_debt BOOLEAN DEFAULT FALSE,
          track_project_cost BOOLEAN DEFAULT FALSE,
          is_ledger BOOLEAN DEFAULT FALSE,
          is_bank BOOLEAN DEFAULT FALSE,
          is_long_term BOOLEAN DEFAULT FALSE,
          debt_increase_side VARCHAR(20) DEFAULT 'debit',
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed accounts
    const seedAccounts = [
      { code: '111', name: 'Tiền mặt', parent: null, foreign: false, debt: false, cost: false, ledger: false, bank: false, long_term: false, side: 'debit' },
      { code: '1111', name: 'Tiền Việt Nam', parent: '111', foreign: false, debt: false, cost: false, ledger: true, bank: false, long_term: false, side: 'debit' },
      { code: '1112', name: 'Ngoại tệ', parent: '111', foreign: true, debt: false, cost: false, ledger: true, bank: false, long_term: false, side: 'debit' },
      { code: '11121', name: 'Tiền mặt Đô la Mỹ', parent: '1112', foreign: true, debt: false, cost: false, ledger: true, bank: false, long_term: false, side: 'debit' },
      { code: '11122', name: 'Tiền mặt EURO', parent: '1112', foreign: true, debt: false, cost: false, ledger: true, bank: false, long_term: false, side: 'debit' },

      { code: '112', name: 'Tiền gửi không kỳ hạn', parent: null, foreign: false, debt: false, cost: false, ledger: false, bank: false, long_term: false, side: 'debit' },
      { code: '1121', name: 'Tiền Việt Nam', parent: '112', foreign: false, debt: false, cost: false, ledger: false, bank: false, long_term: false, side: 'debit' },
      { code: '11211', name: 'Tiền VNĐ gửi NH Techcombank Chi nhánh Hai bà Trưng Hà Nội', parent: '1121', foreign: false, debt: false, cost: false, ledger: true, bank: true, long_term: false, side: 'debit' },
      { code: '11212', name: 'Tiền VNĐ gửi NH Đầu tư phát triển Hà Nội', parent: '1121', foreign: false, debt: false, cost: false, ledger: true, bank: true, long_term: false, side: 'debit' },
      { code: '11213', name: 'Tiền VND tại NH công thương Hà Nội', parent: '1121', foreign: false, debt: false, cost: false, ledger: true, bank: true, long_term: false, side: 'debit' },
      { code: '1122', name: 'Ngoại tệ', parent: '112', foreign: true, debt: false, cost: false, ledger: true, bank: false, long_term: false, side: 'debit' },
      { code: '11221', name: 'Tiền USD gửi NH Ngoại thương Việt Nam', parent: '1122', foreign: true, debt: false, cost: false, ledger: true, bank: true, long_term: false, side: 'debit' },

      { code: '131', name: 'Phải thu của khách hàng', parent: null, foreign: false, debt: true, cost: false, ledger: true, bank: false, long_term: false, side: 'debit' },
      { code: '136', name: 'Phải thu nội bộ', parent: null, foreign: false, debt: true, cost: false, ledger: true, bank: false, long_term: false, side: 'debit' },
      { code: '138', name: 'Phải thu khác', parent: null, foreign: false, debt: true, cost: false, ledger: true, bank: false, long_term: false, side: 'debit' },
      { code: '1381', name: 'Tài sản thừa chờ giải quyết', parent: '138', foreign: false, debt: true, cost: false, ledger: true, bank: false, long_term: false, side: 'debit' },
      { code: '1388', name: 'Phải thu khác', parent: '138', foreign: false, debt: true, cost: false, ledger: true, bank: false, long_term: false, side: 'debit' },
      { code: '141', name: 'Tạm ứng', parent: null, foreign: false, debt: false, cost: false, ledger: true, bank: false, long_term: false, side: 'debit' },
      { code: '152', name: 'Nguyên vật liệu', parent: null, foreign: false, debt: false, cost: false, ledger: true, bank: false, long_term: false, side: 'debit' },
      { code: '154', name: 'Dở dang nguyên vật liệu', parent: null, foreign: false, debt: false, cost: false, ledger: true, bank: false, long_term: false, side: 'debit' },
      { code: '156', name: 'Hàng hóa', parent: null, foreign: false, debt: false, cost: false, ledger: true, bank: false, long_term: false, side: 'debit' },
      { code: '155', name: 'Thành phẩm', parent: null, foreign: false, debt: false, cost: false, ledger: true, bank: false, long_term: false, side: 'debit' },
      { code: '155', name: 'Thành phẩm', parent: null, foreign: false, debt: false, cost: false, ledger: true, bank: false, long_term: false, side: 'debit' },

      { code: '211', name: 'Tài sản cố định hữu hình', parent: null, foreign: false, debt: false, cost: false, ledger: true, bank: false, long_term: false, side: 'debit' },
      { code: '212', name: 'Tài sản cố định vô hình', parent: null, foreign: false, debt: false, cost: false, ledger: true, bank: false, long_term: false, side: 'debit' },
      { code: '213', name: 'Tài sản cố định thuê tài chính', parent: null, foreign: false, debt: false, cost: false, ledger: true, bank: false, long_term: false, side: 'debit' },
      { code: '214', name: 'Hao mòn tài sản cố định', parent: null, foreign: false, debt: false, cost: false, ledger: true, bank: false, long_term: false, side: 'debit' },
      { code: '217', name: 'Bất động sản đầu tư', parent: null, foreign: false, debt: false, cost: false, ledger: true, bank: false, long_term: false, side: 'debit' },
      { code: '218', name: 'Tài sản dài hạn khác', parent: null, foreign: false, debt: false, cost: false, ledger: true, bank: false, long_term: false, side: 'debit' },

      { code: '331', name: 'Phải trả người bán', parent: null, foreign: false, debt: true, cost: false, ledger: true, bank: false, long_term: false, side: 'credit' },
      { code: '336', name: 'Phải trả nội bộ', parent: null, foreign: false, debt: true, cost: false, ledger: true, bank: false, long_term: false, side: 'credit' },
      { code: '338', name: 'Phải trả khác', parent: null, foreign: false, debt: true, cost: false, ledger: true, bank: false, long_term: false, side: 'credit' },
      { code: '3381', name: 'Tài sản thừa chờ giải quyết', parent: '338', foreign: false, debt: true, cost: false, ledger: true, bank: false, long_term: false, side: 'credit' },
      { code: '3388', name: 'Phải trả khác', parent: '338', foreign: false, debt: true, cost: false, ledger: true, bank: false, long_term: false, side: 'credit' },

      { code: '411', name: 'Vốn chủ sở hữu', parent: null, foreign: false, debt: true, cost: false, ledger: true, bank: false, long_term: false, side: 'credit' },
      { code: '412', name: 'Chênh lệch đánh giá lại tài sản', parent: null, foreign: false, debt: true, cost: false, ledger: true, bank: false, long_term: false, side: 'credit' },
      { code: '413', name: 'Chênh lệch tỷ giá hối đoái', parent: null, foreign: false, debt: true, cost: false, ledger: true, bank: false, long_term: false, side: 'credit' },
      { code: '414', name: 'Quỹ khen thưởng phúc lợi', parent: null, foreign: false, debt: true, cost: false, ledger: true, bank: false, long_term: false, side: 'credit' },
      { code: '418', name: 'Vốn chủ sở hữu khác', parent: null, foreign: false, debt: true, cost: false, ledger: true, bank: false, long_term: false, side: 'credit' },
      { code: '421', name: 'Lợi nhuận chưa phân phối', parent: null, foreign: false, debt: true, cost: false, ledger: true, bank: false, long_term: false, side: 'credit' },
      { code: '4211', name: 'Lợi nhuận chưa phân phối năm trước', parent: '421', foreign: false, debt: true, cost: false, ledger: true, bank: false, long_term: false, side: 'credit' },
      { code: '4212', name: 'Lợi nhuận chưa phân phối năm trước', parent: '421', foreign: false, debt: true, cost: false, ledger: true, bank: false, long_term: false, side: 'credit' },

      { code: '511', name: 'Doanh thu bán hàng và cung cấp dịch vụ', parent: null, foreign: false, debt: false, cost: false, ledger: true, bank: false, long_term: false, side: 'credit' },
      { code: '512', name: 'Giảm trừ doanh thu', parent: null, foreign: false, debt: false, cost: false, ledger: true, bank: false, long_term: false, side: 'credit' },
      { code: '5121', name: 'Các khoản giảm trừ doanh thu hàng hóa', parent: '512', foreign: false, debt: false, cost: false, ledger: true, bank: false, long_term: false, side: 'credit' },
      { code: '5122', name: 'Các khoản giảm trừ doanh thu dịch vụ', parent: '512', foreign: false, debt: false, cost: false, ledger: true, bank: false, long_term: false, side: 'credit' },

      { code: '513', name: 'Doanh thu hoạt động tài chính', parent: null, foreign: false, debt: false, cost: false, ledger: true, bank: false, long_term: false, side: 'credit' },
      { code: '515', name: 'Doanh thu tài chính', parent: null, foreign: false, debt: false, cost: false, ledger: true, bank: false, long_term: false, side: 'credit' },
      { code: '5151', name: 'Thu lãi tiền gửi, cho vay', parent: '515', foreign: false, debt: false, cost: false, ledger: true, bank: false, long_term: false, side: 'credit' },
      { code: '5152', name: 'Thu lãi cho thuê tài sản', parent: '515', foreign: false, debt: false, cost: false, ledger: true, bank: false, long_term: false, side: 'credit' },
      { code: '5153', name: 'Thu cổ tức, lợi nhuận được chia', parent: '515', foreign: false, debt: false, cost: false, ledger: true, bank: false, long_term: false, side: 'credit' },



      { code: '641', name: 'Chi phí bán hàng', parent: null, foreign: false, debt: false, cost: false, ledger: true, bank: false, long_term: false, side: 'debit' },
      { code: '642', name: 'Chi phí quản lý doanh nghiệp', parent: null, foreign: false, debt: false, cost: false, ledger: true, bank: false, long_term: false, side: 'debit' },
      { code: '632', name: 'Giá vốn hàng bán', parent: null, foreign: false, debt: false, cost: false, ledger: true, bank: false, long_term: false, side: 'debit' },
      { code: '621', name: 'Chi phí nguyên vật liêu', parent: null, foreign: false, debt: false, cost: false, ledger: true, bank: false, long_term: false, side: 'debit' },
      { code: '622', name: 'Chi phí nhân công trực tiếp', parent: null, foreign: false, debt: false, cost: false, ledger: true, bank: false, long_term: false, side: 'debit' },
      { code: '627', name: 'Chi phí sản xuất chung', parent: null, foreign: false, debt: false, cost: false, ledger: true, bank: false, long_term: false, side: 'debit' },

      { code: '711', name: 'Thu nhập khác', parent: null, foreign: false, debt: false, cost: false, ledger: true, bank: false, long_term: false, side: 'debit' },
      { code: '811', name: 'Chi phí khác', parent: null, foreign: false, debt: false, cost: false, ledger: true, bank: false, long_term: false, side: 'debit' },
      { code: '8211', name: 'Chi phí khác', parent: null, foreign: false, debt: false, cost: false, ledger: true, bank: false, long_term: false, side: 'debit' },
      { code: '8212', name: 'Chi phí khác', parent: null, foreign: false, debt: false, cost: false, ledger: true, bank: false, long_term: false, side: 'debit' },

      { code: '911', name: 'Xác định kết quả kinh doanh', parent: null, foreign: false, debt: false, cost: false, ledger: true, bank: false, long_term: false, side: 'debit' },


    ];

    // Đầu tiên chèn các tài khoản cha (không có parent)
    for (const acc of seedAccounts.filter(a => !a.parent)) {
      await pool.query(`
        INSERT INTO accounts 
          (account_code, account_name, parent_code, track_foreign_currency, track_object_debt, track_project_cost, is_ledger, is_bank, is_long_term, debt_increase_side)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (account_code) DO UPDATE SET
          account_name = EXCLUDED.account_name,
          parent_code = EXCLUDED.parent_code,
          track_foreign_currency = EXCLUDED.track_foreign_currency,
          track_object_debt = EXCLUDED.track_object_debt,
          track_project_cost = EXCLUDED.track_project_cost,
          is_ledger = EXCLUDED.is_ledger,
          is_bank = EXCLUDED.is_bank,
          is_long_term = EXCLUDED.is_long_term,
          debt_increase_side = EXCLUDED.debt_increase_side
      `, [acc.code, acc.name, acc.parent, acc.foreign, acc.debt, acc.cost, acc.ledger, acc.bank, acc.long_term, acc.side]);
    }

    // Tiếp theo chèn các tài khoản có parent
    for (const acc of seedAccounts.filter(a => a.parent)) {
      await pool.query(`
        INSERT INTO accounts 
          (account_code, account_name, parent_code, track_foreign_currency, track_object_debt, track_project_cost, is_ledger, is_bank, is_long_term, debt_increase_side)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (account_code) DO UPDATE SET
          account_name = EXCLUDED.account_name,
          parent_code = EXCLUDED.parent_code,
          track_foreign_currency = EXCLUDED.track_foreign_currency,
          track_object_debt = EXCLUDED.track_object_debt,
          track_project_cost = EXCLUDED.track_project_cost,
          is_ledger = EXCLUDED.is_ledger,
          is_bank = EXCLUDED.is_bank,
          is_long_term = EXCLUDED.is_long_term,
          debt_increase_side = EXCLUDED.debt_increase_side
      `, [acc.code, acc.name, acc.parent, acc.foreign, acc.debt, acc.cost, acc.ledger, acc.bank, acc.long_term, acc.side]);
    }

    // Tạo bảng account_initial_balances và index unique
    await pool.query(`
      CREATE TABLE IF NOT EXISTS account_initial_balances (
          id SERIAL PRIMARY KEY,
          account_code VARCHAR(50) REFERENCES accounts(account_code) ON DELETE CASCADE,
          customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
          project_item_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
          debit_balance NUMERIC DEFAULT 0,
          credit_balance NUMERIC DEFAULT 0,
          debit_balance_ytd NUMERIC DEFAULT 0,
          credit_balance_ytd NUMERIC DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_acct_bal_uniq 
      ON account_initial_balances (account_code, COALESCE(customer_id, 0), COALESCE(project_item_id, 0));
    `);

    // Tạo bảng transactions nếu chưa có
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
          id SERIAL PRIMARY KEY,
          transaction_code VARCHAR(50) UNIQUE NOT NULL,
          transaction_name VARCHAR(255) NOT NULL,
          debit_account VARCHAR(50) REFERENCES accounts(account_code) ON DELETE SET NULL,
          credit_account VARCHAR(50) REFERENCES accounts(account_code) ON DELETE SET NULL,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed transaction mẫu
    await pool.query(`
      INSERT INTO transactions (transaction_code, transaction_name, debit_account, credit_account, is_active)
      VALUES ('131', 'Bán hàng công nợ', '131', '511', TRUE)
      ON CONFLICT (transaction_code) DO NOTHING;
    `);

    // Tạo bảng financial_documents và financial_details
    await pool.query(`
      CREATE TABLE IF NOT EXISTS financial_documents (
          id SERIAL PRIMARY KEY,
          document_no VARCHAR(100) UNIQUE NOT NULL,
          type VARCHAR(50) NOT NULL, -- 'receipt', 'payment', 'debit_advice', 'credit_advice'
          document_date DATE DEFAULT CURRENT_DATE,
          customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
          partner_name VARCHAR(255),
          partner_address TEXT,
          description TEXT,
          total_amount NUMERIC DEFAULT 0,
          total_tax NUMERIC DEFAULT 0,
          grand_total NUMERIC DEFAULT 0,
          transaction_code VARCHAR(50) REFERENCES transactions(transaction_code) ON DELETE SET NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS financial_details (
          id SERIAL PRIMARY KEY,
          document_id INTEGER REFERENCES financial_documents(id) ON DELETE CASCADE,
          material_id INTEGER REFERENCES materials(id) ON DELETE SET NULL,
          description TEXT,
          debit_account VARCHAR(50) REFERENCES accounts(account_code) ON DELETE SET NULL,
          credit_account VARCHAR(50) REFERENCES accounts(account_code) ON DELETE SET NULL,
          amount NUMERIC DEFAULT 0,
          tax_percent NUMERIC DEFAULT 0,
          tax_amount NUMERIC DEFAULT 0,
          total_amount NUMERIC DEFAULT 0,
          transaction_code VARCHAR(50) REFERENCES transactions(transaction_code) ON DELETE SET NULL
      );
    `);

    console.log('Khởi tạo thành công!');

    // Tạo hàm get_material_requirements trong PostgreSQL
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

    // Tạo user mặc định (admin / 123456)
    const checkUser = await pool.query("SELECT * FROM users WHERE username = 'admin'");
    if (checkUser.rowCount === 0) {
      await pool.query("INSERT INTO users (username, password_hash, role) VALUES ('admin', '123456', 'admin')");
      console.log('Đã tạo tài khoản mặc định: admin / 123456 (Lưu ý: mật khẩu chưa mã hóa để test)');
    }

  } catch (error) {
    console.error('Lỗi khi khởi tạo CSDL:', error);
  } finally {
    await pool.end();
  }
}

initializeDatabase();
