import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import { publicModeMiddleware, getAuthUser } from '../middleware/auth';
import { validate, iconEditSchema, iconAddMultipleSchema, idsSchema, sortSchema, faviconSchema, getListByGroupIdSchema } from '../utils/validate';
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
    if (hostname.startsWith('10.') ||
        hostname.startsWith('172.') && hostname.split('.')[1] >= '16' && hostname.split('.')[1] <= '31' ||
        hostname.startsWith('192.168.')) return false
    return true
  } catch {
    return false
  }
}

const FETCH_TIMEOUT_MS = 8000

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    return response
  } finally {
    clearTimeout(timer)
  }
}

function isHttpUrl(url: string): boolean {
  return /^(https?:\/\/|\/\/)/i.test(url);
}

async function getFaviconUrl(urlStr: string): Promise<string | null> {
  if (!isValidUrl(urlStr)) return null

  try {
    const domain = new URL(urlStr)
    const resp = await fetchWithTimeout(urlStr, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      redirect: 'follow',
    })

    if (!resp.ok) {
      const resp2 = await fetchWithTimeout(`https://${domain.hostname}/favicon.ico`, { method: 'HEAD' })
      if (resp2.ok) return `https://${domain.hostname}/favicon.ico`
      return null
    }

    const html = await resp.text();
    const linkRegex = /<link[^>]+rel=["']([^"']*\bicon\b[^"']*)["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
    const hrefRegex = /<link[^>]+href=["']([^"']+)["'][^>]*rel=["']([^"']*\bicon\b[^"']*)["'][^>]*>/gi;

    let match;
    const icons: string[] = [];

    for (const re of [linkRegex, hrefRegex]) {
      while ((match = re.exec(html)) !== null) {
        const href = re === linkRegex ? match[2] : match[1];
        if (href.match(/\.(ico|png|svg|jpg|jpeg|gif|webp)/i) || match[1]?.includes('icon')) {
          icons.push(href);
        }
      }
    }

    for (const v of icons) {
      if (isHttpUrl(v)) return v;
      const urlInfo = new URL(urlStr);
      const fullUrl = `${urlInfo.protocol}//${urlInfo.host}/${v.replace(/^\//, '')}`;
      return fullUrl;
    }

    const defaultFavicon = `${domain.protocol}//${domain.hostname}/favicon.ico`
    const checkResp = await fetchWithTimeout(defaultFavicon, { method: 'HEAD' })
    if (checkResp.ok) return defaultFavicon

    return null;
  } catch {
    return null;
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

/**
 * 获取网站 favicon 图标 URL
 * POST /api/panel/itemIcon/getSiteFavicon
 */
panelApp.post('/itemIcon/getSiteFavicon', validate(faviconSchema), async (c) => {
  try {
    const { url } = c.var.validatedBody as { url: string };

    const iconUrl = await getFaviconUrl(url);

    if (!iconUrl) {
      return fail(c, '获取图标失败', 1);
    }

    return ok(c, { iconUrl });
  } catch (e: unknown) {
    return fail(c, getErrorMessage(e), 500);
  }
});

export default panelApp;