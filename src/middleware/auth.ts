import type { Context, Next } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import { verifyToken } from '../utils/jwt';

export interface AuthUser {
  userId: number;
  username: string;
  role: number;
  visitMode: number; // 0=登录, 1=公开/访客
}

// ========== 登录鉴权中间件 ==========

/**
 * 登录鉴权中间件 - 从 Authorization header 解析 JWT token
 */
export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
  const authHeader = c.req.header('Authorization');

  if (!authHeader) {
    c.status(401);
    return c.json({ code: 401, msg: '未登录', data: null });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  const payload = await verifyToken(token);

  if (!payload) {
    c.status(401);
    return c.json({ code: 401, msg: 'token已失效，请重新登录', data: null });
  }

  c.set('authUser', {
    userId: payload.userId as number,
    username: payload.username as string,
    role: payload.role as number,
    visitMode: 0, // 登录模式
  } as AuthUser);

  await next();
}

// ========== 公开/访客模式中间件 ==========

/**
 * 公开模式中间件 - 优先使用登录 token，无 token 时使用公开访问账号
 */
export async function publicModeMiddleware(c: Context, next: Next): Promise<Response | void> {
  const authHeader = c.req.header('Authorization');
  const db = (c.env as unknown as { DB: D1Database }).DB;

  // 1. 优先尝试 JWT 登录
  if (authHeader) {
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const payload = await verifyToken(token);
    if (payload) {
      c.set('authUser', {
        userId: payload.userId as number,
        username: payload.username as string,
        role: payload.role as number,
        visitMode: 0, // 登录模式
      } as AuthUser);
      await next();
      return;
    }
  }

  // 2. 无有效 token，尝试公开访问
  // 先查 panel_public_user_id，如果没设置再查 default_guest_mode
  let setting = await db.prepare("SELECT config_value FROM system_settings WHERE config_name = 'panel_public_user_id'").first() as { config_value: string } | null;
  
  if (!setting || !setting.config_value) {
    // 查 default_guest_mode — 如果启用了默认访客模式，用第一个管理员账号
    const guestMode = await db.prepare("SELECT config_value FROM system_settings WHERE config_name = 'default_guest_mode'").first() as { config_value: string } | null;
    if (guestMode && guestMode.config_value === '1') {
      // 自动找第一个管理员作为公开用户
      const adminUser = await db.prepare('SELECT id, username, name, head_image, role, status FROM users WHERE role = 1 LIMIT 1').first() as Record<string, unknown> | null;
      if (adminUser) {
        c.set('authUser', {
          userId: adminUser.id as number,
          username: adminUser.username as string,
          role: adminUser.role as number,
          visitMode: 1,
        } as AuthUser);
        await next();
        return;
      }
    }
    c.status(401);
    return c.json({ code: 401, msg: '未登录且未启用公开模式', data: null });
  }

  const userId = parseInt(setting.config_value, 10);
  const user = await db.prepare('SELECT id, username, name, head_image, role, status FROM users WHERE id = ?').bind(userId).first() as Record<string, unknown> | null;
  if (!user) {
    c.status(401);
    return c.json({ code: 401, msg: '公开用户不存在', data: null });
  }

  c.set('authUser', {
    userId: user.id as number,
    username: user.username as string,
    role: user.role as number,
    visitMode: 1, // 公开/访客模式
  } as AuthUser);

  await next();
}

// ========== 管理员鉴权中间件 ==========

/**
 * 管理员鉴权中间件 - 需要先通过 authMiddleware 或 publicModeMiddleware
 */
export async function adminMiddleware(c: Context, next: Next): Promise<Response | void> {
  const user = c.get('authUser') as AuthUser | undefined;

  if (!user || user.role !== 1) {
    c.status(403);
    return c.json({ code: 403, msg: '无权限', data: null });
  }

  await next();
}

// ========== 工具函数 ==========

/**
 * 获取当前认证用户信息 (从中间件设置的 context)
 */
export function getAuthUser(c: Context): AuthUser | null {
  return c.get('authUser') as AuthUser | null;
}