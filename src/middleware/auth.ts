import type { Context, Next } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import { verifyToken } from '../utils/jwt';

export interface AuthUser {
  userId: number;
  username: string;
  name: string;
  role: number;
  visitMode: number; // 0=登录, 1=公开/访客
}

// ========== 设置缓存（减少 D1 查询） ==========
let settingsCache: { publicUserId: string | null; guestMode: string | null; timestamp: number } | null = null
const SETTINGS_CACHE_TTL = 60_000 // 60 秒

let userInfoCache: { user: Record<string, unknown> | null; timestamp: number } | null = null

// ========== 辅助函数 ==========

/** 获取 D1 数据库实例 */
function getDB(c: Context): D1Database {
  return (c.env as { DB: D1Database }).DB;
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
    name: (payload.name as string) || '',
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
  const authHeader = c.req.header('Authorization')
  const db = getDB(c)

  if (authHeader) {
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
    const payload = await verifyToken(token)
    if (payload) {
      c.set('authUser', {
        userId: payload.userId as number,
        username: payload.username as string,
        name: (payload.name as string) || '',
        role: payload.role as number,
        visitMode: 0,
      } as AuthUser)
      await next()
      return
    }
  }

  // 查询公开模式设置（使用缓存减少 D1 请求）
  const now = Date.now()
  if (!settingsCache || (now - settingsCache.timestamp) > SETTINGS_CACHE_TTL) {
    const settings = await db.batch([
      db.prepare("SELECT config_value FROM system_settings WHERE config_name = 'panel_public_user_id'"),
      db.prepare("SELECT config_value FROM system_settings WHERE config_name = 'default_guest_mode'"),
    ])
    settingsCache = {
      publicUserId: (settings[0].results[0] as { config_value: string } | undefined)?.config_value ?? null,
      guestMode: (settings[1].results[0] as { config_value: string } | undefined)?.config_value ?? null,
      timestamp: now,
    }
  }

  const publicUserIdValue = settingsCache.publicUserId
  const guestModeValue = settingsCache.guestMode

  let targetUser: Record<string, unknown> | null = null
  const cacheValid = userInfoCache && (now - userInfoCache.timestamp) < SETTINGS_CACHE_TTL

  if (cacheValid) {
    targetUser = userInfoCache!.user
  } else {
    if (publicUserIdValue) {
      const userId = parseInt(publicUserIdValue, 10)
      if (!isNaN(userId)) {
        targetUser = await db.prepare(
          'SELECT id, username, name, head_image, role, status FROM users WHERE id = ?'
        ).bind(userId).first() as Record<string, unknown> | null
      }
    } else if (guestModeValue === '1') {
      targetUser = await db.prepare(
        'SELECT id, username, name, head_image, role, status FROM users WHERE role = 1 LIMIT 1'
      ).first() as Record<string, unknown> | null
    }
    userInfoCache = { user: targetUser, timestamp: now }
  }

  if (targetUser) {
    c.set('authUser', {
      userId: targetUser.id as number,
      username: targetUser.username as string,
      name: (targetUser.name as string) || '',
      role: targetUser.role as number,
      visitMode: 1,
    } as AuthUser)
    await next()
    return
  }

  c.status(401)
  return c.json({ code: 401, msg: '未登录且未启用公开模式', data: null })
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