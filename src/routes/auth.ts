import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import { hashPassword, verifyPassword } from '../utils/password';
import { signToken } from '../utils/jwt';
import type { LoginRequest, RegisterRequest, ApiResponse, UserInfo, UserRow } from '../models/types';

const authApp = new Hono<{ Bindings: { DB: D1Database } }>();

/**
 * 登录
 * POST /api/login
 */
authApp.post('/login', async (c) => {
  try {
    const body = await c.req.json<LoginRequest>();
    const db = c.env.DB;

    if (!body.username || !body.password) {
      return c.json({ code: 400, msg: '用户名和密码不能为空', data: null } satisfies ApiResponse);
    }

    const user = await db.prepare('SELECT * FROM users WHERE username = ?').bind(body.username).first() as unknown as UserRow | null;
    if (!user) {
      return c.json({ code: 400, msg: '用户名或密码错误', data: null } satisfies ApiResponse);
    }

    const pwdValid = await verifyPassword(body.password, user.password);
    if (!pwdValid) {
      return c.json({ code: 400, msg: '用户名或密码错误', data: null } satisfies ApiResponse);
    }

    if (user.status !== 1) {
      return c.json({ code: 400, msg: '账号已被禁用', data: null } satisfies ApiResponse);
    }

    const token = await signToken({ userId: user.id, username: user.username, role: user.role });

    // 更新 token 到数据库
    await db.prepare('UPDATE users SET token = ? WHERE id = ?').bind(token, user.id).run();

    const userInfo: UserInfo = {
      id: user.id,
      username: user.username,
      name: user.name || '',
      headImage: user.head_image || '',
      status: user.status,
      role: user.role,
      mail: user.mail || '',
      created_at: user.created_at,
    };

    return c.json({ code: 0, msg: 'ok', data: { token, userInfo } } satisfies ApiResponse);
  } catch (e: any) {
    return c.json({ code: 500, msg: e?.message || '服务器错误', data: null } satisfies ApiResponse);
  }
});

/**
 * 注册
 * POST /api/register
 */
authApp.post('/register', async (c) => {
  try {
    const body = await c.req.json<RegisterRequest>();
    const db = c.env.DB;

    if (!body.username || !body.password) {
      return c.json({ code: 400, msg: '用户名和密码不能为空', data: null } satisfies ApiResponse);
    }

    // 检查用户名是否已存在
    const existing = await db.prepare('SELECT id FROM users WHERE username = ?').bind(body.username).first();
    if (existing) {
      return c.json({ code: 400, msg: '该用户名已被注册', data: null } satisfies ApiResponse);
    }

    const hashedPwd = await hashPassword(body.password);
    const name = body.name || body.username;

    const result = await db.prepare(
      'INSERT INTO users (username, password, name, mail, role, status) VALUES (?, ?, ?, ?, 2, 1)'
    ).bind(body.username, hashedPwd, name, body.mail || '').run();

    const userId = Number(result.meta.last_row_id);
    const token = await signToken({ userId, username: body.username, role: 2 });

    await db.prepare('UPDATE users SET token = ? WHERE id = ?').bind(token, userId).run();

    // 创建默认用户配置
    await db.prepare('INSERT INTO user_configs (user_id) VALUES (?)').bind(userId).run();

    const userInfo: UserInfo = {
      id: userId,
      username: body.username,
      name,
      headImage: '',
      status: 1,
      role: 2,
      mail: body.mail || '',
      created_at: new Date().toISOString(),
    };

    return c.json({ code: 0, msg: 'ok', data: { token, userInfo } } satisfies ApiResponse);
  } catch (e: any) {
    return c.json({ code: 500, msg: e?.message || '服务器错误', data: null } satisfies ApiResponse);
  }
});

export default authApp;