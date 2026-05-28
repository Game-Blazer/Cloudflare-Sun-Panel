import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import type { ApiResponse, SystemSettingRow } from '../models/types';

const settingsApp = new Hono<{ Bindings: { DB: D1Database } }>();

/**
 * 获取系统设置 (通过 configName) - 公开可访问
 * POST /api/system/setting/get
 */
settingsApp.post('/system/setting/get', async (c) => {
  const db = c.env.DB;
  const { configName } = await c.req.json<{ configName: string }>();

  if (!configName) {
    return c.json({ code: 400, msg: 'configName 不能为空', data: null } satisfies ApiResponse);
  }

  const row = await db.prepare('SELECT config_value FROM system_settings WHERE config_name = ?').bind(configName).first() as unknown as SystemSettingRow | null;

  if (!row) {
    return c.json({ code: 0, msg: 'ok', data: '' } satisfies ApiResponse);
  }

  return c.json({ code: 0, msg: 'ok', data: row.config_value } satisfies ApiResponse);
});

/**
 * 保存系统设置 (管理员)
 * POST /api/system/setting/set
 */
settingsApp.post('/system/setting/set', authMiddleware, adminMiddleware, async (c) => {
  const db = c.env.DB;
  const { configName, configValue } = await c.req.json<{ configName: string; configValue: string }>();

  if (!configName) {
    return c.json({ code: 400, msg: 'configName 不能为空', data: null } satisfies ApiResponse);
  }

  const existing = await db.prepare('SELECT id FROM system_settings WHERE config_name = ?').bind(configName).first();

  if (existing) {
    await db.prepare(
      "UPDATE system_settings SET config_value = ?, updated_at = datetime('now') WHERE config_name = ?"
    ).bind(configValue ?? '', configName).run();
  } else {
    await db.prepare(
      'INSERT INTO system_settings (config_name, config_value) VALUES (?, ?)'
    ).bind(configName, configValue ?? '').run();
  }

  return c.json({ code: 0, msg: 'ok', data: null } satisfies ApiResponse);
});

/**
 * 批量保存系统设置 (管理员)
 * POST /api/system/settings/saveAll
 */
settingsApp.post('/system/settings/saveAll', authMiddleware, adminMiddleware, async (c) => {
  const db = c.env.DB;
  const body = await c.req.json<Record<string, string>>();

  if (!body || Object.keys(body).length === 0) {
    return c.json({ code: 400, msg: '数据不能为空', data: null } satisfies ApiResponse);
  }

  // 并行检查所有配置是否存在，再批量保存
  const entries = Object.entries(body);
  const checks = await Promise.all(
    entries.map(([configName]) =>
      db.prepare('SELECT id FROM system_settings WHERE config_name = ?').bind(configName).first()
    )
  );
  await Promise.all(
    entries.map(([configName, configValue], i) => {
      if (checks[i]) {
        return db.prepare("UPDATE system_settings SET config_value = ?, updated_at = datetime('now') WHERE config_name = ?").bind(configValue ?? '', configName).run();
      } else {
        return db.prepare('INSERT INTO system_settings (config_name, config_value) VALUES (?, ?)').bind(configName, configValue ?? '').run();
      }
    })
  );

  return c.json({ code: 0, msg: 'ok', data: null } satisfies ApiResponse);
});

/**
 * 获取所有设置 (公开)
 * POST /api/about
 */
settingsApp.post('/about', async (c) => {
  const db = c.env.DB;

  const rows = await db.prepare('SELECT * FROM system_settings').all();
  const settings: Record<string, string> = {};
  rows.results.forEach(row => {
    const r = row as unknown as SystemSettingRow;
    settings[r.config_name] = r.config_value;
  });

  return c.json({ code: 0, msg: 'ok', data: settings } satisfies ApiResponse);
});

export default settingsApp;