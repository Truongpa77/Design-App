import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const filePath = searchParams.get('path');

  if (!filePath) {
    return NextResponse.json({ error: 'Thiếu đường dẫn file' }, { status: 400 });
  }

  try {
    // Resolve absolute path or use directly
    let resolvedPath = filePath;
    
    // Nếu là đường dẫn tương đối từ public/uploads
    if (filePath.startsWith('/uploads/') || filePath.startsWith('uploads/')) {
      resolvedPath = path.join(process.cwd(), 'public', filePath.startsWith('/') ? filePath : '/' + filePath);
    }
    // Nếu là đường dẫn từ bmp/{project_code}/
    else if (filePath.startsWith('/bmp/') || filePath.startsWith('bmp/')) {
      resolvedPath = path.join(process.cwd(), filePath.startsWith('/') ? filePath.substring(1) : filePath);
    }

    if (!fs.existsSync(resolvedPath)) {
      return NextResponse.json({ error: 'File không tồn tại' }, { status: 404 });
    }

    // Đọc file
    const fileBuffer = fs.readFileSync(resolvedPath);

    // Xác định mime-type
    const ext = path.extname(resolvedPath).toLowerCase();
    let contentType = 'image/jpeg';
    if (ext === '.png') contentType = 'image/png';
    else if (ext === '.gif') contentType = 'image/gif';
    else if (ext === '.webp') contentType = 'image/webp';
    else if (ext === '.svg') contentType = 'image/svg+xml';
    else if (ext === '.bmp') contentType = 'image/bmp';

    return new Response(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error: any) {
    console.error('Lỗi khi đọc file ảnh:', error);
    return NextResponse.json({ error: 'Không thể đọc file: ' + error.message }, { status: 500 });
  }
}
