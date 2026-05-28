/**
 * 密码工具 - 使用 Web Crypto API (SHA-256)
 */

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 对密码进行 SHA-256 哈希处理
 */
export async function hashPassword(password: string): Promise<string> {
  return sha256(password);
}

/**
 * 验证密码
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const hashed = await sha256(password);
  return hashed === hash;
}