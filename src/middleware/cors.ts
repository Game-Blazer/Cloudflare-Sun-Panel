import { type Context, type Next } from 'hono'

/**
 * CORS 中间件 - 手动处理 preflight OPTIONS 请求
 */
export async function corsMiddleware(c: Context, next: Next) {
  // 处理 OPTIONS preflight
  if (c.req.method === 'OPTIONS') {
    c.header('Access-Control-Allow-Origin', '*')
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    c.header('Access-Control-Max-Age', '86400')
    return c.body(null, 204)
  }

  await next()

  // 为所有响应添加 CORS 头
  c.header('Access-Control-Allow-Origin', '*')
}