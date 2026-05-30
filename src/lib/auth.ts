import crypto from 'crypto';

/**
 * Băm mật khẩu bằng thuật toán PBKDF2 với muối (salt) ngẫu nhiên
 * Định dạng đầu ra: salt:iterations:keylen:digest:hash
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const iterations = 10000; // Tăng số vòng lặp lên 10000 để tăng tính an toàn
  const keylen = 64;
  const digest = 'sha512';
  const hash = crypto.pbkdf2Sync(password, salt, iterations, keylen, digest).toString('hex');
  return `${salt}:${iterations}:${keylen}:${digest}:${hash}`;
}

/**
 * Kiểm tra mật khẩu nhập vào có khớp với mã băm lưu trong DB hay không.
 * Hỗ trợ tương thích ngược với mật khẩu dạng text thô.
 */
export function verifyPassword(password: string, hashedPassword: string): boolean {
  if (!hashedPassword) return false;

  // Nếu mật khẩu trong DB không chứa ký tự phân tách ':' (dữ liệu cũ dạng text thô)
  const parts = hashedPassword.split(':');
  if (parts.length !== 5) {
    return password === hashedPassword;
  }

  const [salt, iterationsStr, keylenStr, digest, hash] = parts;
  const iterations = parseInt(iterationsStr, 10);
  const keylen = parseInt(keylenStr, 10);
  
  if (isNaN(iterations) || isNaN(keylen)) {
    // Trường hợp chuỗi bị lỗi định dạng
    return password === hashedPassword;
  }

  const verifyHash = crypto.pbkdf2Sync(password, salt, iterations, keylen, digest).toString('hex');
  return hash === verifyHash;
}
