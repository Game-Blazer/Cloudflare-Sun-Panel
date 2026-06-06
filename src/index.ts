import { Hono } from 'hono'
import type { D1Database, Fetcher } from '@cloudflare/workers-types'
import { corsMiddleware } from './middleware/cors'
import { csrfMiddleware } from './middleware/csrf'
import { securityHeadersMiddleware } from './middleware/securityHeaders'
import { bodyLimitMiddleware } from './middleware/bodyLimit'
import { validateEnv } from './utils/env'
import { AppError } from './utils/errors'
import authRoutes from './routes/auth'
import panelRoutes from './routes/panel'
import groupsRoutes from './routes/groups'
import usersRoutes from './routes/users'
import userConfigRoutes from './routes/userConfig'
import settingsRoutes from './routes/settings'
import initRoutes from './routes/init'

type Bindings = {
  DB: D1Database
  ASSETS: Fetcher
}

const app = new Hono<{ Bindings: Bindings }>()

// ========== 全局错误处理 ==========
app.onError((err, c) => {
  if (err instanceof AppError) {
    console.error(`[${err.name}] ${err.code} ${err.message}`)
    return c.json({ code: err.code, msg: err.message, data: null }, err.httpStatus as any)
  }
  console.error('[Global Error]', err)
  return c.json({ code: 500, msg: '服务器内部错误', data: null }, 500)
})

// ========== 数据库自动初始化 ==========
let dbInitPromise: Promise<void> | null = null
let dbInitialized = false

async function initDatabase(db: D1Database): Promise<void> {
  const tableCheck = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").first()

  if (tableCheck) {
    dbInitialized = true
    return
  }

  // Schema should be initialized via `wrangler d1 execute --file=./schema.sql`
  console.error('[DB] Database tables not found. Please run: wrangler d1 execute sun-panel-db --file=./schema.sql')
  throw new Error('Database not initialized. Run `npm run db:init` to initialize.')
}

app.use('*', async (c, next) => {
  if (!dbInitialized) {
    // Validate environment on first request
    validateEnv(c.env as unknown as Record<string, unknown>)
    if (!dbInitPromise) {
      dbInitPromise = initDatabase(c.env.DB).catch((err) => {
        console.error('[DB] Init failed:', err)
        dbInitPromise = null
        throw err
      })
    }
    await dbInitPromise
  }
  await next()
})

// CORS 中间件
app.use('*', corsMiddleware)

// CSRF 防护中间件
app.use('*', csrfMiddleware)

// 安全响应头中间件
app.use('*', securityHeadersMiddleware)

// 请求体大小限制中间件
app.use('*', bodyLimitMiddleware)

// 健康检查
app.get('/api/health', (c) => {
  return c.json({ code: 0, msg: 'ok', data: { status: 'running', time: new Date().toISOString() } })
})

// API 路由
app.route('/', authRoutes)            // /login, /register
app.route('/', initRoutes)            // /init
app.route('/panel', panelRoutes)      // /panel/getAllData, /panel/itemIcon/*
app.route('/panel', groupsRoutes)     // /panel/itemIconGroup/*
app.route('/panel', userConfigRoutes) // /panel/userConfig/*, /panel/users/*
app.route('/', usersRoutes)           // /user/*
app.route('/', settingsRoutes)        // /system/*, /about

// SPA 前端回退：未匹配的 GET 请求返回 index.html（Vue Router hash 模式兜底）
app.get('*', async (c) => {
  try {
    const assetReq = new Request(new URL('/index.html', c.req.url), c.req.raw)
    const response = await c.env.ASSETS.fetch(assetReq)
    if (response.ok) return response
  } catch {
    console.error('Failed to serve index.html fallback')
  }
  return c.json({ code: 404, msg: 'Not Found' }, 404)
})

export default app
