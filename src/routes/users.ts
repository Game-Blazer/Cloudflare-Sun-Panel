import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import { authMiddleware, adminMiddleware, publicModeMiddleware, getAuthUser } from '../middleware/auth';
import { hashPassword, verifyPassword } from '../utils/password';
import type { ApiResponse, UserConfigRequest, UserConfigRow, UserRow, UserInfo, RegisterRequest } from '../models/types';

const usersApp = new Hono<{ Bindings: { DB: D1Database } }>();

// ========== 用户配置 (不需要管理员权限) ==========

/**
 * 获取用户配置
 * POST /api/panel/userConfig/get
 */
usersApp.post('/userConfig/get', publicModeMiddleware, async (c) => {
  const db = c.env.DB;
  const user = getAuthUser(c);

  let row = await db.prepare('SELECT * FROM user_configs WHERE user_id = ?').bind(user!.userId).first() as unknown as UserConfigRow | null;

  if (!row) {
    // 不存在则创建
    await db.prepare('INSERT INTO user_configs (user_id) VALUES (?)').bind(user!.userId).run();
    return c.json({
      code: 0, msg: 'ok', data: { panel: {}, searchEngine: {} }
    } satisfies ApiResponse);
  }

  return c.json({
    code: 0, msg: 'ok',
    data: {
      panel: JSON.parse(row.panel_json || '{}'),
      searchEngine: JSON.parse(row.search_engine_json || '{}'),
    }
  } satisfies ApiResponse);
});

/**
 * 保存用户配置
 * POST /api/panel/userConfig/set
 */
usersApp.post('/userConfig/set', publicModeMiddleware, async (c) => {
  const db = c.env.DB;
  const user = getAuthUser(c);
  const body = await c.req.json<UserConfigRequest>();

  // 访客模式不允许修改配置
  if (user!.visitMode === 1) {
    return c.json({ code: 403, msg: '访客模式下不允许修改配置', data: null } satisfies ApiResponse);
  }

  const panelJson = JSON.stringify(body.panel || {});
  const searchEngineJson = JSON.stringify(body.searchEngine || {});

  const existing = await db.prepare('SELECT user_id FROM user_configs WHERE user_id = ?').bind(user!.userId).first();

  if (existing) {
    await db.prepare(
      "UPDATE user_configs SET panel_json = ?, search_engine_json = ?, updated_at = datetime('now') WHERE user_id = ?"
    ).bind(panelJson, searchEngineJson, user!.userId).run();
  } else {
    await db.prepare(
      'INSERT INTO user_configs (user_id, panel_json, search_engine_json) VALUES (?, ?, ?)'
    ).bind(user!.userId, panelJson, searchEngineJson).run();
  }

  return c.json({ code: 0, msg: 'ok', data: null } satisfies ApiResponse);
});

// ========== 当前用户信息 ==========

/**
 * 获取当前认证信息（含访客模式）- 参照原项目 PublicModeInterceptor
 * POST /api/user/getAuthInfo
 * 返回 { user, visitMode }，其中 visitMode: 0=登录模式, 1=访客/公开模式
 */
usersApp.post('/user/getAuthInfo', publicModeMiddleware, async (c) => {
  const db = c.env.DB;
  const user = getAuthUser(c);

  const row = await db.prepare('SELECT * FROM users WHERE id = ?').bind(user!.userId).first() as unknown as UserRow | null;

  if (!row) {
    return c.json({ code: 400, msg: '用户不存在', data: null } satisfies ApiResponse);
  }

  const info: UserInfo = {
    id: row.id,
    username: row.username,
    name: row.name || '',
    headImage: row.head_image || '',
    status: row.status,
    role: row.role,
    mail: row.mail || '',
    created_at: row.created_at,
  };

  return c.json({
    code: 0, msg: 'ok',
    data: { user: info, visitMode: user!.visitMode },
  } satisfies ApiResponse);
});

/**
 * 更新个人信息
 * POST /api/user/updateInfo
 */
usersApp.post('/user/updateInfo', authMiddleware, async (c) => {
  const db = c.env.DB;
  const user = getAuthUser(c);
  const { name } = await c.req.json<{ name: string }>();

  if (!name) {
    return c.json({ code: 400, msg: '名称不能为空', data: null } satisfies ApiResponse);
  }

  await db.prepare("UPDATE users SET name = ?, updated_at = datetime('now') WHERE id = ?").bind(name, user!.userId).run();

  return c.json({ code: 0, msg: 'ok', data: null } satisfies ApiResponse);
});

/**
 * 修改密码
 * POST /api/user/updatePassword
 */
usersApp.post('/user/updatePassword', authMiddleware, async (c) => {
  const db = c.env.DB;
  const user = getAuthUser(c);
  const { oldPassword, newPassword } = await c.req.json<{ oldPassword: string; newPassword: string }>();

  if (!oldPassword || !newPassword) {
    return c.json({ code: 400, msg: '密码不能为空', data: null } satisfies ApiResponse);
  }

  const row = await db.prepare('SELECT password FROM users WHERE id = ?').bind(user!.userId).first() as unknown as UserRow | null;

  if (!row) {
    return c.json({ code: 400, msg: '用户不存在', data: null } satisfies ApiResponse);
  }

  const valid = await verifyPassword(oldPassword, row.password);
  if (!valid) {
    return c.json({ code: 400, msg: '原密码错误', data: null } satisfies ApiResponse);
  }

  const newHash = await hashPassword(newPassword);
  await db.prepare("UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?").bind(newHash, user!.userId).run();

  return c.json({ code: 0, msg: 'ok', data: null } satisfies ApiResponse);
});

// ========== 管理员用户管理 ==========

/**
 * 获取用户列表 (管理员)
 * POST /api/panel/users/getList
 */
usersApp.post('/users/getList', authMiddleware, adminMiddleware, async (c) => {
  const db = c.env.DB;
  const { page = 1, pageSize = 20 } = await c.req.json<{ page?: number; pageSize?: number }>();

  const offset = (page - 1) * pageSize;

  const [rows, countResult] = await Promise.all([
    db.prepare('SELECT * FROM users ORDER BY id DESC LIMIT ? OFFSET ?').bind(pageSize, offset).all(),
    db.prepare('SELECT COUNT(*) as total FROM users').first() as Promise<{ total: number }>,
  ]);

  const list = rows.results.map(row => {
    const r = row as unknown as UserRow;
    return {
      id: r.id,
      username: r.username,
      name: r.name,
      headImage: r.head_image,
      status: r.status,
      role: r.role,
      mail: r.mail,
      createTime: r.created_at,
      updateTime: r.updated_at,
    };
  });

  return c.json({
    code: 0, msg: 'ok',
    data: { list, total: countResult.total, page, pageSize }
  } satisfies ApiResponse);
});

/**
 * 新增/编辑用户 (管理员)
 * POST /api/panel/users/create 或 /api/panel/users/update
 */
usersApp.post('/users/create', authMiddleware, adminMiddleware, async (c) => {
  const db = c.env.DB;
  const body = await c.req.json<RegisterRequest & { id?: number; role?: number; status?: number }>();

  if (!body.username || !body.password) {
    return c.json({ code: 400, msg: '用户名和密码不能为空', data: null } satisfies ApiResponse);
  }

  const existingUsername = await db.prepare('SELECT id FROM users WHERE username = ?').bind(body.username).first();
  if (existingUsername) {
    return c.json({ code: 400, msg: '该用户名已被注册', data: null } satisfies ApiResponse);
  }

  const hashedPwd = await hashPassword(body.password);

  await db.prepare(
    'INSERT INTO users (username, password, name, role, status) VALUES (?, ?, ?, ?, ?)'
  ).bind(body.username, hashedPwd, body.name || body.username, body.role || 2, body.status ?? 1).run();

  return c.json({ code: 0, msg: 'ok', data: null } satisfies ApiResponse);
});

usersApp.post('/users/update', authMiddleware, adminMiddleware, async (c) => {
  const db = c.env.DB;
  const body = await c.req.json<RegisterRequest & { id: number; role?: number; status?: number }>();

  if (!body.id) {
    return c.json({ code: 400, msg: '用户ID不能为空', data: null } satisfies ApiResponse);
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (body.username) {
    // 检查用户名是否被其他用户占用
    const existing = await db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').bind(body.username, body.id).first();
    if (existing) {
      return c.json({ code: 400, msg: '该用户名已被注册', data: null } satisfies ApiResponse);
    }
    updates.push('username = ?');
    params.push(body.username);
  }
  if (body.name) {
    updates.push('name = ?');
    params.push(body.name);
  }
  if (body.password) {
    updates.push('password = ?');
    params.push(await hashPassword(body.password));
  }
  if (body.role !== undefined) {
    updates.push('role = ?');
    params.push(body.role);
  }
  if (body.status !== undefined) {
    updates.push('status = ?');
    params.push(body.status);
  }

  if (updates.length === 0) {
    return c.json({ code: 400, msg: '无更新数据', data: null } satisfies ApiResponse);
  }

  updates.push("updated_at = datetime('now')");
  params.push(body.id);

  await db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();

  return c.json({ code: 0, msg: 'ok', data: null } satisfies ApiResponse);
});

/**
 * 删除用户 (管理员)
 * POST /api/panel/users/deletes
 */
usersApp.post('/users/deletes', authMiddleware, adminMiddleware, async (c) => {
  const db = c.env.DB;
  const { userIds } = await c.req.json<{ userIds: number[] }>();

  if (!userIds || userIds.length === 0) {
    return c.json({ code: 400, msg: 'userIds 不能为空', data: null } satisfies ApiResponse);
  }

  // 不允许删除自己
  const authUser = getAuthUser(c);
  const filteredIds = userIds.filter(id => id !== authUser!.userId);
  if (filteredIds.length === 0) {
    return c.json({ code: 400, msg: '不能删除自己', data: null } satisfies ApiResponse);
  }

  const placeholders = filteredIds.map(() => '?').join(',');

  // 并行删除关联数据
  await Promise.all([
    db.prepare(`DELETE FROM item_icons WHERE user_id IN (${placeholders})`).bind(...filteredIds).run(),
    db.prepare(`DELETE FROM item_icon_groups WHERE user_id IN (${placeholders})`).bind(...filteredIds).run(),
    db.prepare(`DELETE FROM user_configs WHERE user_id IN (${placeholders})`).bind(...filteredIds).run(),
    db.prepare(`DELETE FROM users WHERE id IN (${placeholders})`).bind(...filteredIds).run(),
  ]);

  return c.json({ code: 0, msg: 'ok', data: null } satisfies ApiResponse);
});

// ========== 公开访问用户管理 (管理员) ==========

/**
 * 获取公开访问用户
 * POST /api/panel/users/getPublicVisitUser
 */
usersApp.post('/users/getPublicVisitUser', authMiddleware, adminMiddleware, async (c) => {
  const db = c.env.DB;

  const setting = await db.prepare("SELECT config_value FROM system_settings WHERE config_name = 'panel_public_user_id'").first() as { config_value: string } | null;

  const userId = setting?.config_value ? parseInt(setting.config_value, 10) : null;
  if (!userId) {
    return c.json({ code: 0, msg: 'ok', data: null } satisfies ApiResponse);
  }

  const user = await db.prepare('SELECT id, username, name, head_image, role, status, mail, created_at FROM users WHERE id = ?').bind(userId).first() as unknown as UserRow | null;

  if (!user) {
    return c.json({ code: 0, msg: 'ok', data: null } satisfies ApiResponse);
  }

  return c.json({
    code: 0, msg: 'ok',
    data: {
      id: user.id,
      username: user.username,
      name: user.name,
      headImage: user.head_image,
      status: user.status,
      role: user.role,
      mail: user.mail,
      created_at: user.created_at,
    }
  } satisfies ApiResponse);
});

/**
 * 设置公开访问用户 (管理员)
 * POST /api/panel/users/setPublicVisitUser
 */
usersApp.post('/users/setPublicVisitUser', authMiddleware, adminMiddleware, async (c) => {
  const db = c.env.DB;
  const { userId } = await c.req.json<{ userId: number | null }>();

  if (userId === null || userId === undefined) {
    // 取消公开访问
    await db.prepare("DELETE FROM system_settings WHERE config_name = 'panel_public_user_id'").run();
    return c.json({ code: 0, msg: 'ok', data: null } satisfies ApiResponse);
  }

  // 并行检查用户是否存在 + 已有设置
  const [user, existing] = await Promise.all([
    db.prepare('SELECT id FROM users WHERE id = ?').bind(userId).first(),
    db.prepare("SELECT id FROM system_settings WHERE config_name = 'panel_public_user_id'").first(),
  ]);
  if (!user) {
    return c.json({ code: 400, msg: '用户不存在', data: null } satisfies ApiResponse);
  }

  if (existing) {
    await db.prepare("UPDATE system_settings SET config_value = ?, updated_at = datetime('now') WHERE config_name = 'panel_public_user_id'").bind(String(userId)).run();
  } else {
    await db.prepare("INSERT INTO system_settings (config_name, config_value) VALUES ('panel_public_user_id', ?)").bind(String(userId)).run();
  }

  return c.json({ code: 0, msg: 'ok', data: null } satisfies ApiResponse);
});

export default usersApp;