import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import { publicModeMiddleware, getAuthUser } from '../middleware/auth';
import type { AuthUser } from '../middleware/auth';
import type { ApiResponse, ItemIconGroupRequest, ItemIconGroupRow } from '../models/types';

const groupsApp = new Hono<{ Bindings: { DB: D1Database } }>();

groupsApp.use('*', publicModeMiddleware);

// 将 row 转为前端格式
function formatGroup(row: ItemIconGroupRow) {
  return {
    id: row.id,
    icon: row.icon,
    title: row.title,
    description: row.description,
    sort: row.sort,
    publicVisible: row.public_visible,
    userId: row.user_id,
    createTime: row.created_at,
    updateTime: row.updated_at,
  };
}

/**
 * 获取分组列表
 * POST /api/panel/itemIconGroup/getList
 */
groupsApp.post('/itemIconGroup/getList', async (c) => {
  const db = c.env.DB;
  const user = getAuthUser(c);

  const rows = await db.prepare(
    'SELECT * FROM item_icon_groups WHERE user_id = ? ORDER BY sort ASC, id ASC'
  ).bind(user!.userId).all();

  const list = rows.results.map(row => formatGroup(row as unknown as ItemIconGroupRow));

  return c.json({ code: 0, msg: 'ok', data: list } satisfies ApiResponse);
});

/**
 * 新增或编辑分组
 * POST /api/panel/itemIconGroup/edit
 */
groupsApp.post('/itemIconGroup/edit', async (c) => {
  const db = c.env.DB;
  const user = getAuthUser(c);
  const body = await c.req.json<ItemIconGroupRequest>();

  // 访客模式不允许修改
  if (user!.visitMode === 1) {
    return c.json({ code: 403, msg: '访客模式下不允许修改', data: null } satisfies ApiResponse);
  }

  if (!body.title) {
    return c.json({ code: 400, msg: '标题不能为空', data: null } satisfies ApiResponse);
  }

  if (body.id) {
    // 编辑
    await db.prepare(
      'UPDATE item_icon_groups SET icon = ?, title = ?, description = ?, sort = ?, public_visible = ?, updated_at = datetime(\'now\') WHERE id = ? AND user_id = ?'
    ).bind(
      body.icon || '',
      body.title,
      body.description || '',
      body.sort || 0,
      body.publicVisible ?? 1,
      body.id,
      user!.userId
    ).run();

    const row = await db.prepare('SELECT * FROM item_icon_groups WHERE id = ?').bind(body.id).first();
    return c.json({ code: 0, msg: 'ok', data: formatGroup(row as unknown as ItemIconGroupRow) } satisfies ApiResponse);
  } else {
    // 新增
    const result = await db.prepare(
      'INSERT INTO item_icon_groups (icon, title, description, sort, public_visible, user_id) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
      body.icon || '',
      body.title,
      body.description || '',
      body.sort || 0,
      body.publicVisible ?? 1,
      user!.userId
    ).run();

    const row = await db.prepare('SELECT * FROM item_icon_groups WHERE id = ?').bind(result.meta.last_row_id).first();
    return c.json({ code: 0, msg: 'ok', data: formatGroup(row as unknown as ItemIconGroupRow) } satisfies ApiResponse);
  }
});

/**
 * 删除分组 (同时删除其下所有图标)
 * POST /api/panel/itemIconGroup/deletes
 */
groupsApp.post('/itemIconGroup/deletes', async (c) => {
  const db = c.env.DB;
  const user = getAuthUser(c);
  const { ids } = await c.req.json<{ ids: number[] }>();

  if (!ids || ids.length === 0) {
    return c.json({ code: 400, msg: 'ids 不能为空', data: null } satisfies ApiResponse);
  }

  const placeholders = ids.map(() => '?').join(',');

  // 并行删除图标和分组
  await Promise.all([
    db.prepare(
      `DELETE FROM item_icons WHERE item_icon_group_id IN (${placeholders}) AND user_id = ?`
    ).bind(...ids, user!.userId).run(),
    db.prepare(
      `DELETE FROM item_icon_groups WHERE id IN (${placeholders}) AND user_id = ?`
    ).bind(...ids, user!.userId).run(),
  ]);

  return c.json({ code: 0, msg: 'ok', data: null } satisfies ApiResponse);
});

/**
 * 保存排序
 * POST /api/panel/itemIconGroup/saveSort
 */
groupsApp.post('/itemIconGroup/saveSort', async (c) => {
  const db = c.env.DB;
  const user = getAuthUser(c);
  const { sortItems } = await c.req.json<{ sortItems: { id: number; sort: number }[] }>();

  if (!sortItems || sortItems.length === 0) {
    return c.json({ code: 0, msg: 'ok', data: null } satisfies ApiResponse);
  }

  const stmt = db.prepare('UPDATE item_icon_groups SET sort = ?, updated_at = datetime(\'now\') WHERE id = ? AND user_id = ?');
  const batch = sortItems.map(item => stmt.bind(item.sort, item.id, user!.userId));
  await db.batch(batch);

  return c.json({ code: 0, msg: 'ok', data: null } satisfies ApiResponse);
});

export default groupsApp;