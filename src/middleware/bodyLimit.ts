import type { Context, Next } from 'hono'

const MAX_BODY_SIZE = 1048576 // 1MB

/**
 * 请求体大小限制中间件
 * 检查 Content-Length 头，超过 1MB 返回 413
 * GET/HEAD/OPTIONS 请求跳过检查
 */
export async function bodyLimitMiddleware(c: Context, next: Next) {
  const method = c.req.method.toUpperCase()

  // Skip for safe methods
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    await next()
    return
  }

  const contentLength = c.req.header('Content-Length')
  if (contentLength) {
    const length = parseInt(contentLength, 10)
    if (!isNaN(length) && length > MAX_BODY_SIZE) {
      return c.json({ code: 413, msg: '请求体过大', data: null }, 413)
    }
  }

  await next()
}
