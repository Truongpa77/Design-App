const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5433', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function main() {
  const sql = `
    INSERT INTO lookup_configs 
      (lookup_key, table_name, value_field, display_field, sublabel_field, search_fields, additional_filter, parent_field)
    VALUES (
      'leaf_account', 
      'accounts', 
      'account_code', 
      'account_name', 
      'account_code', 
      ARRAY['account_code', 'account_name'], 
      'is_active = true AND NOT EXISTS (SELECT 1 FROM accounts sub WHERE sub.parent_code = accounts.account_code)', 
      NULL
    )
    ON CONFLICT (lookup_key) DO UPDATE SET
      table_name = EXCLUDED.table_name,
      value_field = EXCLUDED.value_field,
      display_field = EXCLUDED.display_field,
      sublabel_field = EXCLUDED.sublabel_field,
      search_fields = EXCLUDED.search_fields,
      additional_filter = EXCLUDED.additional_filter,
      parent_field = EXCLUDED.parent_field;
  `;
  try {
    await pool.query(sql);
    console.log('Successfully inserted/updated leaf_account lookup configuration');
    process.exit(0);
  } catch (err) {
    console.error('Error inserting config:', err);
    process.exit(1);
  }
}

main();
