import { Hono } from 'hono';
import type { D1Database, Fetcher } from '@cloudflare/workers-types';
import { corsMiddleware } from './middleware/cors';
import { csrfMiddleware } from './middleware/csrf';
import { securityHeadersMiddleware } from './middleware/securityHeaders';
import authRoutes from './routes/auth';
import panelRoutes from './routes/panel';
import groupsRoutes from './routes/groups';
import usersRoutes from './routes/users';
import settingsRoutes from './routes/settings';

type Bindings = {
  DB: D1Database;
  ASSETS: Fetcher;
};

const app = new Hono<{ Bindings: Bindings }>();

// ========== 全局错误处理 ==========
app.onError((err, c) => {
  console.error('[Global Error]', err);
  return c.json({ code: 500, msg: '服务器内部错误', data: null }, 500);
});

// ========== 数据库自动初始化 ==========
let dbInitPromise: Promise<void> | null = null;
let dbInitialized = false;

async function initDatabase(db: D1Database): Promise<void> {
  const tableCheck = await db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
  ).first();

  if (tableCheck) {
    dbInitialized = true;
    return;
  }

  const schemaSQL = [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      name TEXT DEFAULT '',
      head_image TEXT DEFAULT '',
      status INTEGER DEFAULT 1,
      role INTEGER DEFAULT 2,
      mail TEXT DEFAULT '',
      token TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS item_icon_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      icon TEXT DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      description TEXT DEFAULT '',
      sort INTEGER DEFAULT 0,
      public_visible INTEGER DEFAULT 1,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS item_icons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      icon_json TEXT DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      url TEXT DEFAULT '',
      description TEXT DEFAULT '',
      open_method INTEGER DEFAULT 0,
      sort INTEGER DEFAULT 0,
      item_icon_group_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (item_icon_group_id) REFERENCES item_icon_groups(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS user_configs (
      user_id INTEGER PRIMARY KEY,
      panel_json TEXT DEFAULT '{}',
      search_engine_json TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS system_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      config_name TEXT NOT NULL UNIQUE,
      config_value TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`,
    `CREATE INDEX IF NOT EXISTS idx_users_token ON users(token)`,
    `CREATE INDEX IF NOT EXISTS idx_item_icons_group_id ON item_icons(item_icon_group_id)`,
    `CREATE INDEX IF NOT EXISTS idx_item_icons_user_id ON item_icons(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_item_icon_groups_user_id ON item_icon_groups(user_id)`,
  ];

  await db.batch(schemaSQL.map(sql => db.prepare(sql)));

  const userCount = await db.prepare('SELECT COUNT(*) as count FROM users').first() as { count: number } | null;
  if (!userCount || userCount.count === 0) {
    await db.prepare(
      `INSERT OR IGNORE INTO users (id, username, password, name, role, status)
       VALUES (1, 'admin@sun.com', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'Admin', 1, 1)`
    ).run();
  }

  dbInitialized = true;
  console.log('[DB] Database schema initialized successfully');
}

app.use('*', async (c, next) => {
  if (!dbInitialized) {
    if (!dbInitPromise) {
      dbInitPromise = initDatabase(c.env.DB).catch((err) => {
        console.error('[DB] Init failed:', err);
        dbInitPromise = null;
        throw err;
      });
    }
    await dbInitPromise;
  }
  await next();
});

// CORS 中间件
app.use('*', corsMiddleware);

// CSRF 防护中间件
app.use('*', csrfMiddleware);

// 安全响应头中间件
app.use('*', securityHeadersMiddleware);

// 健康检查
app.get('/api/health', (c) => {
  return c.json({ code: 0, msg: 'ok', data: { status: 'running', time: new Date().toISOString() } });
});

// API 路由（与前端 API 路径匹配）
app.route('/', authRoutes);          // /login, /register
app.route('/panel', panelRoutes);   // /panel/itemIcon/*
app.route('/panel', groupsRoutes);  // /panel/itemIconGroup/*
app.route('/panel', usersRoutes);   // /panel/userConfig/*, /panel/users/*
app.route('/', usersRoutes);         // /user/*
app.route('/', settingsRoutes);      // /system/*, /about

// SPA 前端回退：未匹配的 GET 请求返回 index.html（Vue Router hash 模式兜底）
app.get('*', async (c) => {
  try {
    const assetReq = new Request(new URL('/index.html', c.req.url), c.req.raw);
    const response = await c.env.ASSETS.fetch(assetReq);
    if (response.ok) return response;
  } catch {
    console.error('Failed to serve index.html fallback');
  }
  return c.json({ code: 404, msg: 'Not Found' }, 404);
});

export default app;