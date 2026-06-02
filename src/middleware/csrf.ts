import type { Context, Next } from 'hono'

function isAllowedOrigin(origin: string, host: string): boolean {
  if (!origin) return false

  try {
    const originUrl = new URL(origin)
    const originHost = originUrl.hostname

    // Allow localhost with any port (development)
    if (originHost === 'localhost' || originHost === '127.0.0.1') {
      return true
    }

    // Allow same origin (production)
    if (originHost === host) {
      return true
    }

    return false
  } catch {
    return false
  }
}

/**
 * CSRF 防护中间件 - 对写操作验证 Origin/Referer 头
 * GET/OPTIONS/HEAD 请求直接放行
 * 无 Origin/Referer 的请求视为同源请求，予以放行
 */
export async function csrfMiddleware(c: Context, next: Next) {
  const method = c.req.method.toUpperCase()

  // 安全方法（GET, OPTIONS, HEAD）直接放行
  if (method === 'GET' || method === 'OPTIONS' || method === 'HEAD') {
    await next()
    return
  }

  // 对写操作（POST, PUT, DELETE 等）检查 Origin/Referer
  const origin = c.req.header('Origin')
  const referer = c.req.header('Referer')

  // 无 Origin 且无 Referer：视为同源请求（浏览器对同源 POST 不一定发送 Origin），直接放行
  if (!origin && !referer) {
    await next()
    return
  }

  // 获取请求来源域名
  let requestOrigin = origin
  if (!requestOrigin && referer) {
    try {
      const refUrl = new URL(referer)
      requestOrigin = refUrl.origin
    } catch {
      // referer 解析失败，忽略
    }
  }

  if (!requestOrigin) {
    await next()
    return
  }

  const url = new URL(c.req.url)
  const host = url.hostname

  if (!isAllowedOrigin(requestOrigin, host)) {
    return c.json({ code: 403, msg: 'CSRF validation failed', data: null }, 403)
  }

  await next()
}