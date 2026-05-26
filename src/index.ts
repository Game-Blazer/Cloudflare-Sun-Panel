import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import { corsMiddleware } from './middleware/cors';
import authRoutes from './routes/auth';
import panelRoutes from './routes/panel';
import groupsRoutes from './routes/groups';
import usersRoutes from './routes/users';
import settingsRoutes from './routes/settings';

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS 中间件
app.use('*', corsMiddleware);

// 健康检查
app.get('/api/health', (c) => {
  return c.json({ code: 0, msg: 'ok', data: { status: 'running', time: new Date().toISOString() } });
});

// 路由挂载（与前端 API 路径匹配）
app.route('/', authRoutes);          // /login, /register
app.route('/panel', panelRoutes);   // /panel/itemIcon/*
app.route('/panel', groupsRoutes);  // /panel/itemIconGroup/*
app.route('/panel', usersRoutes);   // /panel/userConfig/*, /panel/users/*
app.route('/', usersRoutes);         // /user/*
app.route('/', settingsRoutes);      // /system/*, /about

export default app;