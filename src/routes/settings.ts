import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import { validate, settingGetSchema, settingSetSchema, saveAllSchema } from '../utils/validate';
import { SettingsService } from '../services/SettingsService';
import { ok, fail, getErrorMessage } from '../utils/response';

type Variables = {
  validatedBody: unknown;
};

const settingsApp = new Hono<{ Bindings: { DB: D1Database }; Variables: Variables }>();

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
settingsApp.post('/system/settings/saveAll', authMiddleware, adminMiddleware, validate(saveAllSchema), async (c) => {
  try {
    const body = c.var.validatedBody as Record<string, string>;

    const service = new SettingsService(c.env.DB);
    await service.saveAll(body);
    return ok(c, null);
  } catch (e: unknown) {
    return fail(c, getErrorMessage(e), 500);
  }
});

/**
 * 获取所有设置 + 用户自定义壁纸 (公开)
 * POST /api/about
 */
settingsApp.post('/about', async (c) => {
  try {
    const db = c.env.DB;
    const service = new SettingsService(db);
    const settings = await service.getAll();

    // 检查公开模式：如果启用了公开模式，获取公开用户的自定义壁纸
    const publicUserId = settings['panel_public_user_id'];
    const guestMode = settings['default_guest_mode'];
    if (publicUserId || guestMode === '1') {
      let targetUserId: number | null = null;
      if (publicUserId) {
        targetUserId = parseInt(publicUserId, 10);
      } else {
        // 查找第一个管理员作为公开用户
        const admin = await db.prepare(
          'SELECT id FROM users WHERE role = 1 LIMIT 1'
        ).first() as { id: number } | null;
        targetUserId = admin?.id ?? null;
      }
      if (targetUserId) {
        const row = await db.prepare(
          'SELECT config_json FROM user_config WHERE user_id = ?'
        ).bind(targetUserId).first() as { config_json: string } | null;
        if (row?.config_json) {
          try {
            const config = JSON.parse(row.config_json);
            if (config.panel?.backgroundImageSrc) {
              settings['backgroundImageSrc'] = config.panel.backgroundImageSrc;
            }
          } catch { /* JSON 解析失败，忽略 */ }
        }
      }
    }

    return ok(c, settings);
  } catch (e: unknown) {
    return fail(c, getErrorMessage(e), 500);
  }
});

export default settingsApp;