import type { Context, Next } from 'hono'

export function createRateLimiter(options?: { maxRequests?: number; windowMs?: number }) {
  const maxRequests = options?.maxRequests ?? 10
  const windowMs = options?.windowMs ?? 60000

  const store = new Map<string, { count: number; resetTime: number }>()

  const cleanup = () => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (entry.resetTime <= now) {
        store.delete(key)
      }
    }
  }

  const interval = setInterval(cleanup, windowMs)
  // Allow garbage collection by not keeping a strong reference to the interval in closures
  // (it's captured in a local variable that persists for the module lifetime, which is fine)

  return async (c: Context, next: Next) => {
    const ip =
      c.req.header('CF-Connecting-IP') ||
      c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ||
      c.req.header('X-Real-IP') ||
      'unknown'

    const now = Date.now()
    let entry = store.get(ip)

    if (!entry || entry.resetTime <= now) {
      entry = { count: 0, resetTime: now + windowMs }
      store.set(ip, entry)
    }

    entry.count++

    if (entry.count > maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000)
      c.header('Retry-After', String(retryAfter))
      c.status(429)
      return c.json({ code: 429, msg: 'Too many requests, please try again later', data: null })
    }

    await next()
  }
}