import { Hono } from 'hono';
import type { D1Database, Fetcher } from '@cloudflare/workers-types';
import { corsMiddleware } from './middleware/cors';
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

// CORS 中间件
app.use('*', corsMiddleware);

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