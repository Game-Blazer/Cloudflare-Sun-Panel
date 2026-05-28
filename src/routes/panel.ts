import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import { publicModeMiddleware, getAuthUser } from '../middleware/auth';
import type { ApiResponse, ItemIconRequest, ItemIconRow, ItemIconSortRequest } from '../models/types';

const panelApp = new Hono<{ Bindings: { DB: D1Database } }>();

panelApp.use('*', publicModeMiddleware);

/** 图标行转前端格式 */
function formatIcon(row: ItemIconRow) {
  return {
    id: row.id,
    icon: JSON.parse(row.icon_json || '{}'),
    title: row.title,
    url: row.url,
    description: row.description,
    openMethod: row.open_method,
    sort: row.sort,
    itemIconGroupId: row.item_icon_group_id,
    userId: row.user_id,
    createTime: row.created_at,
    updateTime: row.updated_at,
  };
}

const ICON_INSERT_SQL = 'INSERT INTO item_icons (icon_json, title, url, description, open_method, sort, item_icon_group_id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';

/** 构建图标 bind 参数数组 */
function iconBindParams(item: { icon?: unknown; title: string; url: string; description?: string; openMethod?: number; sort?: number; itemIconGroupId: number }, userId: number) {
  return [JSON.stringify(item.icon || {}), item.title, item.url, item.description || '', item.openMethod || 0, item.sort || 0, item.itemIconGroupId, userId];
}

/**
 * 批量添加图标
 * POST /api/panel/itemIcon/addMultiple
 */
panelApp.post('/itemIcon/addMultiple', async (c) => {
  const db = c.env.DB;
  const user = getAuthUser(c);
  const items = await c.req.json<ItemIconRequest[]>();

  if (!items || items.length === 0) {
    return c.json({ code: 400, msg: '数据不能为空', data: null } satisfies ApiResponse);
  }

  const stmt = db.prepare(ICON_INSERT_SQL);
  const inserts = items.map(item => stmt.bind(...iconBindParams(item, user!.userId) as [unknown, ...unknown[]]));
  await db.batch(inserts);

  return c.json({ code: 0, msg: 'ok', data: null } satisfies ApiResponse);
});

/**
 * 编辑图标
 * POST /api/panel/itemIcon/edit
 */
panelApp.post('/itemIcon/edit', async (c) => {
  const db = c.env.DB;
  const user = getAuthUser(c);
  const body = await c.req.json<ItemIconRequest>();

  if (!body.title) {
    return c.json({ code: 400, msg: '标题不能为空', data: null } satisfies ApiResponse);
  }

  if (body.id) {
    await db.prepare(
      `UPDATE item_icons SET icon_json = ?, title = ?, url = ?, description = ?, 
       open_method = ?, sort = ?, item_icon_group_id = ?, updated_at = datetime('now') 
       WHERE id = ? AND user_id = ?`
    ).bind(
      JSON.stringify(body.icon || {}),
      body.title,
      body.url,
      body.description || '',
      body.openMethod || 0,
      body.sort || 0,
      body.itemIconGroupId,
      body.id,
      user!.userId
    ).run();

    const row = await db.prepare('SELECT * FROM item_icons WHERE id = ?').bind(body.id).first();
    return c.json({ code: 0, msg: 'ok', data: formatIcon(row as unknown as ItemIconRow) } satisfies ApiResponse);
  } else {
    const result = await db.prepare(ICON_INSERT_SQL).bind(...iconBindParams(body, user!.userId) as [unknown, ...unknown[]]).run();

    const row = await db.prepare('SELECT * FROM item_icons WHERE id = ?').bind(result.meta.last_row_id).first();
    return c.json({ code: 0, msg: 'ok', data: formatIcon(row as unknown as ItemIconRow) } satisfies ApiResponse);
  }
});

/**
 * 根据分组 ID 获取图标列表
 * POST /api/panel/itemIcon/getListByGroupId
 */
panelApp.post('/itemIcon/getListByGroupId', async (c) => {
  const db = c.env.DB;
  const user = getAuthUser(c);
  const { itemIconGroupId } = await c.req.json<{ itemIconGroupId?: number }>();

  const rows = await db.prepare(
    'SELECT * FROM item_icons WHERE item_icon_group_id = ? AND user_id = ? ORDER BY sort ASC, id ASC'
  ).bind(itemIconGroupId || 0, user!.userId).all();

  const list = rows.results.map(row => formatIcon(row as unknown as ItemIconRow));

  return c.json({ code: 0, msg: 'ok', data: list } satisfies ApiResponse);
});

/**
 * 批量删除图标
 * POST /api/panel/itemIcon/deletes
 */
panelApp.post('/itemIcon/deletes', async (c) => {
  const db = c.env.DB;
  const user = getAuthUser(c);
  const { ids } = await c.req.json<{ ids: number[] }>();

  if (!ids || ids.length === 0) {
    return c.json({ code: 400, msg: 'ids 不能为空', data: null } satisfies ApiResponse);
  }

  const placeholders = ids.map(() => '?').join(',');
  await db.prepare(
    `DELETE FROM item_icons WHERE id IN (${placeholders}) AND user_id = ?`
  ).bind(...ids, user!.userId).run();

  return c.json({ code: 0, msg: 'ok', data: null } satisfies ApiResponse);
});

/**
 * 保存图标排序
 * POST /api/panel/itemIcon/saveSort
 */
panelApp.post('/itemIcon/saveSort', async (c) => {
  const db = c.env.DB;
  const user = getAuthUser(c);
  const { sortItems } = await c.req.json<ItemIconSortRequest>();

  if (!sortItems || sortItems.length === 0) {
    return c.json({ code: 0, msg: 'ok', data: null } satisfies ApiResponse);
  }

  const stmt = db.prepare("UPDATE item_icons SET sort = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?");
  const batch = sortItems.map(item => stmt.bind(item.sort, item.id, user!.userId));
  await db.batch(batch);

  return c.json({ code: 0, msg: 'ok', data: null } satisfies ApiResponse);
});

export default panelApp;