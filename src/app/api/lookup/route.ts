import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    const q = searchParams.get('q');
    const id = searchParams.get('id');
    const parentVal = searchParams.get('parent_val');

    if (!key) {
      return NextResponse.json({ error: 'Thiếu key cấu hình lookup' }, { status: 400 });
    }

    // 1. Lấy cấu hình lookup từ DB
    const configRes = await pool.query('SELECT * FROM lookup_configs WHERE lookup_key = $1', [key]);
    if (configRes.rows.length === 0) {
      return NextResponse.json({ error: 'Không tìm thấy cấu hình cho key: ' + key }, { status: 404 });
    }
    const config = configRes.rows[0];

    // 2. Xây dựng câu truy vấn động
    const selectFields = [
      `${config.value_field} as value`,
      `${config.display_field} as label`
    ];
    if (config.sublabel_field) {
      selectFields.push(`${config.sublabel_field} as sublabel`);
    }

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    // Bộ lọc bổ sung mặc định (tĩnh)
    if (config.additional_filter) {
      conditions.push(config.additional_filter);
    }

    // Bộ lọc theo cha (dependent lọc ví dụ hạng mục thuộc công trình)
    if (config.parent_field && parentVal) {
      params.push(parentVal);
      conditions.push(`${config.parent_field} = $${paramIdx}`);
      paramIdx++;
    }

    // Nếu tìm kiếm bản ghi cụ thể theo ID (để hiển thị nhãn khi load trang)
    if (id) {
      params.push(id);
      conditions.push(`${config.value_field} = $${paramIdx}`);
      paramIdx++;
    } else if (q) {
      // Tìm kiếm theo từ khóa
      const searchOrs: string[] = [];
      for (const field of config.search_fields) {
        if (field.includes('code')) {
          params.push(`${q}%`); // Mã tìm kiếm khớp từ đầu (Prefix search)
        } else {
          params.push(`%${q}%`); // Tên hoặc các trường khác tìm kiếm chứa chuỗi (Contains search)
        }
        searchOrs.push(`${field} ILIKE $${paramIdx}`);
        paramIdx++;
      }
      conditions.push(`(${searchOrs.join(' OR ')})`);
    }


    let sql = `SELECT ${selectFields.join(', ')} FROM ${config.table_name}`;
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    // Nếu chỉ lấy một bản ghi theo ID
    if (id) {
      sql += ` LIMIT 1`;
    } else {
      sql += ` ORDER BY ${config.display_field} ASC LIMIT 50`;
    }

    const result = await pool.query(sql, params);
    
    if (id) {
      return NextResponse.json(result.rows[0] || null);
    }
    return NextResponse.json(result.rows);
  } catch (error: any) {
    console.error('Error in dynamic lookup API:', error);
    return NextResponse.json({ error: 'Lỗi server: ' + error.message }, { status: 500 });
  }
}
