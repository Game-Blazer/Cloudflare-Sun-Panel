/**
 * 密码工具 - 使用 Web Crypto API (SHA-256) + 随机盐值
 *
 * 哈希格式: 无前缀 = 旧版纯 SHA-256（保持向后兼容）
 *          $2$<salt_hex>$<hash_hex> = 新版加盐哈希
 *
 * 旧版格式仍可验证，新密码自动使用加盐哈希
 */

function arrayBufferToHex(buffer: ArrayBuffer): string {
  const hashArray = Array.from(new Uint8Array(buffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return arrayBufferToHex(hashBuffer)
}

function generateSalt(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** 加盐哈希: $2$<salt_hex>$<sha256(salt + password)> */
async function hashWithSalt(password: string, salt: string): Promise<string> {
  const hashed = await sha256(salt + password)
  return `$2$${salt}$${hashed}`
}

/**
 * 对密码进行 SHA-256 加盐哈希处理
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = generateSalt()
  return hashWithSalt(password, salt)
}

/**
 * 验证密码（兼容旧版无盐格式和新版加盐格式）
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (hash.startsWith('$2$')) {
    const parts = hash.split('$')
    if (parts.length < 4) return false
    const salt = parts[2]
    const expected = await hashWithSalt(password, salt)
    return expected === hash
  }

  const hashed = await sha256(password)
  return hashed === hash
}
