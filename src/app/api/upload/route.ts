import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'Không tìm thấy file' }, { status: 400 });
    }

    // Lấy mã công trình nếu có (dùng để tổ chức thư mục bmp/{project_code})
    const projectCode = formData.get('project_code') as string | null;

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let uploadDir: string;
    let relativePath: string;

    if (projectCode && projectCode.trim()) {
      // Lưu vào thư mục Design/bmp/{Mã công trình}
      const cleanProjectCode = projectCode.trim().replace(/[^a-zA-Z0-9_\-. ]/g, '_');
      uploadDir = path.join(process.cwd(), 'bmp', cleanProjectCode);
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Làm sạch tên file nhưng giữ phần mở rộng
      const ext = path.extname(file.name);
      const baseName = path.basename(file.name, ext).replace(/[^a-zA-Z0-9.-]/g, '_');
      const filename = `${Date.now()}-${baseName}${ext}`;
      const filePath = path.join(uploadDir, filename);
      fs.writeFileSync(filePath, buffer);

      relativePath = `/bmp/${cleanProjectCode}/${filename}`;

      return NextResponse.json({
        success: true,
        relativePath,
        absolutePath: filePath
      });
    } else {
      // Fallback: Lưu vào thư mục public/uploads
      uploadDir = path.join(process.cwd(), 'public', 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filename = `${Date.now()}-${cleanFileName}`;
      const filePath = path.join(uploadDir, filename);
      fs.writeFileSync(filePath, buffer);

      return NextResponse.json({
        success: true,
        relativePath: `/uploads/${filename}`,
        absolutePath: filePath
      });
    }
  } catch (error: any) {
    console.error('Lỗi khi upload file:', error);
    return NextResponse.json({ error: 'Lỗi server khi tải lên: ' + error.message }, { status: 500 });
  }
}
