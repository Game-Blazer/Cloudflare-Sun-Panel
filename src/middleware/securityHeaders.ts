import type { Context, Next } from 'hono'

/**
 * 安全响应头中间件 - 为所有响应添加安全相关的 HTTP 头
 */
export async function securityHeadersMiddleware(c: Context, next: Next) {
  await next()

  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-Frame-Options', 'DENY')
  c.header('X-XSS-Protection', '1; mode=block')
  c.header('Referrer-Policy', 'no-referrer-when-downgrade')
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
}
