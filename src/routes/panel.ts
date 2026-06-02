import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import { publicModeMiddleware, getAuthUser } from '../middleware/auth';
import { validate, iconEditSchema, iconAddMultipleSchema, idsSchema, sortSchema, getListByGroupIdSchema } from '../utils/validate';
import { PanelService } from '../services/PanelService';
import { ok, fail } from '../utils/response';

type Variables = {
  validatedBody: unknown;
};

const panelApp = new Hono<{ Bindings: { DB: D1Database }; Variables: Variables }>();

panelApp.use('*', publicModeMiddleware);

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return '服务器错误';
}

function isValidUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr)
    if (!['http:', 'https:'].includes(url.protocol)) return false
    const hostname = url.hostname.toLowerCase()
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') return false

    // Check private/reserved IP ranges
    const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
    const match = hostname.match(ipv4Pattern)
    if (match) {
      const [, a, b, c, d] = match.map(Number)
      // 10.0.0.0/8
      if (a === 10) return false
      // 172.16.0.0/12
      if (a === 172 && b >= 16 && b <= 31) return false
      // 192.168.0.0/16
      if (a === 192 && b === 168) return false
      // 127.0.0.0/8
      if (a === 127) return false
      // 169.254.0.0/16 (link-local)
      if (a === 169 && b === 254) return false
      // 0.0.0.0/8
      if (a === 0) return false
    }
    return true
  } catch {
    return false
  }
}

/**
 * 统一获取全部数据（分组 + 所有图标 + 用户配置）
 * POST /api/panel/getAllData
 */
panelApp.post('/getAllData', async (c) => {
  try {
    const user = getAuthUser(c);
    const userId = user!.userId;
    const service = new PanelService(c.env.DB);
    const result = await service.getAllData(userId);

    c.header('Cache-Control', 'public, max-age=30');
    return ok(c, result);
  } catch (e: unknown) {
    return fail(c, getErrorMessage(e), 500);
  }
});

/**
 * 批量添加图标
 * POST /api/panel/itemIcon/addMultiple
 */
panelApp.post('/itemIcon/addMultiple', validate(iconAddMultipleSchema), async (c) => {
  try {
    const user = getAuthUser(c);
    if (user!.visitMode === 1) return fail(c, '访客模式下不允许修改', 403);
    const items = c.var.validatedBody as Array<{
      icon?: { itemType: number; src?: string; text?: string; backgroundColor?: string };
      title: string; url: string; description?: string;
      openMethod?: number; sort?: number; itemIconGroupId: number;
    }>;

    const service = new PanelService(c.env.DB);
    await service.addMultipleIcons(items, user!.userId);
    return ok(c, null);
  } catch (e: unknown) {
    return fail(c, getErrorMessage(e), 500);
  }
});

/**
 * 编辑图标
 * POST /api/panel/itemIcon/edit
 */
panelApp.post('/itemIcon/edit', validate(iconEditSchema), async (c) => {
  try {
    const user = getAuthUser(c);
    if (user!.visitMode === 1) return fail(c, '访客模式下不允许修改', 403);
    const body = c.var.validatedBody as {
      id?: number; icon?: { itemType: number; src?: string; text?: string; backgroundColor?: string };
      title: string; url: string; description?: string;
      openMethod?: number; sort?: number; itemIconGroupId: number;
    };

    const service = new PanelService(c.env.DB);
    const result = await service.editIcon(body, user!.userId);
    return ok(c, result);
  } catch (e: unknown) {
    return fail(c, getErrorMessage(e), 500);
  }
});

/**
 * 根据分组 ID 获取图标列表
 * POST /api/panel/itemIcon/getListByGroupId
 */
panelApp.post('/itemIcon/getListByGroupId', validate(getListByGroupIdSchema), async (c) => {
  try {
    const user = getAuthUser(c);
    const { itemIconGroupId } = c.var.validatedBody as { itemIconGroupId?: number };

    const service = new PanelService(c.env.DB);
    const list = await service.getIconsByGroupId(itemIconGroupId || 0, user!.userId);
    return ok(c, list);
  } catch (e: unknown) {
    return fail(c, getErrorMessage(e), 500);
  }
});

/**
 * 批量删除图标
 * POST /api/panel/itemIcon/deletes
 */
panelApp.post('/itemIcon/deletes', validate(idsSchema), async (c) => {
  try {
    const user = getAuthUser(c);
    if (user!.visitMode === 1) return fail(c, '访客模式下不允许修改', 403);
    const { ids } = c.var.validatedBody as { ids: number[] };

    const service = new PanelService(c.env.DB);
    await service.deleteIcons(ids, user!.userId);
    return ok(c, null);
  } catch (e: unknown) {
    return fail(c, getErrorMessage(e), 500);
  }
});

/**
 * 保存图标排序
 * POST /api/panel/itemIcon/saveSort
 */
panelApp.post('/itemIcon/saveSort', validate(sortSchema), async (c) => {
  try {
    const user = getAuthUser(c);
    if (user!.visitMode === 1) return fail(c, '访客模式下不允许修改', 403);
    const { sortItems } = c.var.validatedBody as { sortItems: Array<{ id: number; sort: number }> };

    if (sortItems.length === 0) {
      return ok(c, null);
    }

    const service = new PanelService(c.env.DB);
    await service.saveIconSort(sortItems, user!.userId);
    return ok(c, null);
  } catch (e: unknown) {
    return fail(c, getErrorMessage(e), 500);
  }
});

export default panelApp;