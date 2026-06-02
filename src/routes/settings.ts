import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import { validate, settingGetSchema, settingSetSchema } from '../utils/validate';
import { SettingsService } from '../services/SettingsService';
import { ok, fail } from '../utils/response';

type Variables = {
  validatedBody: unknown;
};

const settingsApp = new Hono<{ Bindings: { DB: D1Database }; Variables: Variables }>();

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return '服务器错误';
}

/**
 * 获取系统设置 (通过 configName) - 公开可访问
 * POST /api/system/setting/get
 */
settingsApp.post('/system/setting/get', validate(settingGetSchema), async (c) => {
  try {
    const { configName } = c.var.validatedBody as { configName: string };
    const service = new SettingsService(c.env.DB);
    const value = await service.get(configName);
    return ok(c, value);
  } catch (e: unknown) {
    return fail(c, getErrorMessage(e), 500);
  }
});

/**
 * 保存系统设置 (管理员)
 * POST /api/system/setting/set
 */
settingsApp.post('/system/setting/set', authMiddleware, adminMiddleware, validate(settingSetSchema), async (c) => {
  try {
    const { configName, configValue } = c.var.validatedBody as { configName: string; configValue?: string };
    const service = new SettingsService(c.env.DB);
    await service.set(configName, configValue ?? '');
    return ok(c, null);
  } catch (e: unknown) {
    return fail(c, getErrorMessage(e), 500);
  }
});

/**
 * 批量保存系统设置 (管理员)
 * POST /api/system/settings/saveAll
 */
settingsApp.post('/system/settings/saveAll', authMiddleware, adminMiddleware, async (c) => {
  try {
    const body = await c.req.json<Record<string, string>>();

    if (!body || Object.keys(body).length === 0) {
      return fail(c, '数据不能为空', 400);
    }

    const service = new SettingsService(c.env.DB);
    await service.saveAll(body);
    return ok(c, null);
  } catch (e: unknown) {
    return fail(c, getErrorMessage(e), 500);
  }
});

/**
 * 获取所有设置 (公开)
 * POST /api/about
 */
settingsApp.post('/about', async (c) => {
  try {
    const service = new SettingsService(c.env.DB);
    const settings = await service.getAll();
    return ok(c, settings);
  } catch (e: unknown) {
    return fail(c, getErrorMessage(e), 500);
  }
});

export default settingsApp;