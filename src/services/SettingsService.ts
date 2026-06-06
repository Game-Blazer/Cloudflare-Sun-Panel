import type { D1Database } from '@cloudflare/workers-types'
import type { SystemSettingRow, UserRow } from '../models/types'
import { queryAll, queryFirst } from '../utils/db'

export class SettingsService {
  constructor(private db: D1Database) {}

  async get(configName: string): Promise<string> {
    const row = await queryFirst<SystemSettingRow>(
      this.db,
      'SELECT config_value FROM system_settings WHERE config_name = ?',
      configName,
    )

    return row?.config_value ?? ''
  }

  async set(configName: string, configValue: string) {
    const existing = await this.db
      .prepare('SELECT id FROM system_settings WHERE config_name = ?')
      .bind(configName)
      .first()

    if (existing) {
      await this.db
        .prepare("UPDATE system_settings SET config_value = ?, updated_at = datetime('now') WHERE config_name = ?")
        .bind(configValue ?? '', configName)
        .run()
    } else {
      await this.db
        .prepare('INSERT INTO system_settings (config_name, config_value) VALUES (?, ?)')
        .bind(configName, configValue ?? '')
        .run()
    }
  }

  async saveAll(entries: Record<string, string>) {
    const kvList = Object.entries(entries)
    const checks = await Promise.all(
      kvList.map(([configName]) =>
        this.db.prepare('SELECT id FROM system_settings WHERE config_name = ?').bind(configName).first(),
      ),
    )

    await Promise.all(
      kvList.map(([configName, configValue], i) => {
        if (checks[i]) {
          return this.db
            .prepare("UPDATE system_settings SET config_value = ?, updated_at = datetime('now') WHERE config_name = ?")
            .bind(configValue ?? '', configName)
            .run()
        } else {
          return this.db
            .prepare('INSERT INTO system_settings (config_name, config_value) VALUES (?, ?)')
            .bind(configName, configValue ?? '')
            .run()
        }
      }),
    )
  }

  async getAll(): Promise<Record<string, string>> {
    const rows = await queryAll<SystemSettingRow>(this.db, 'SELECT config_name, config_value FROM system_settings')
    const settings: Record<string, string> = {}
    for (const row of rows) {
      settings[row.config_name] = row.config_value
    }
    return settings
  }

  async getPublicVisitUser() {
    const setting = (await this.db
      .prepare("SELECT config_value FROM system_settings WHERE config_name = 'panel_public_user_id'")
      .first()) as { config_value: string } | null

    const userId = setting?.config_value ? parseInt(setting.config_value, 10) : null
    if (!userId) return null

    const user = await queryFirst<UserRow>(
      this.db,
      'SELECT id, username, name, head_image, role, status, mail, created_at FROM users WHERE id = ?',
      userId,
    )

    if (!user) return null
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      headImage: user.head_image,
      status: user.status,
      role: user.role,
      mail: user.mail,
      created_at: user.created_at,
    }
  }

  async setPublicVisitUser(userId: number | null) {
    if (userId === null || userId === undefined) {
      await this.db.prepare("DELETE FROM system_settings WHERE config_name = 'panel_public_user_id'").run()
      return
    }

    const user = await this.db.prepare('SELECT id FROM users WHERE id = ?').bind(userId).first()
    if (!user) throw new Error('用户不存在')

    const existing = await this.db
      .prepare("SELECT id FROM system_settings WHERE config_name = 'panel_public_user_id'")
      .first()

    if (existing) {
      await this.db
        .prepare(
          "UPDATE system_settings SET config_value = ?, updated_at = datetime('now') WHERE config_name = 'panel_public_user_id'",
        )
        .bind(String(userId))
        .run()
    } else {
      await this.db
        .prepare("INSERT INTO system_settings (config_name, config_value) VALUES ('panel_public_user_id', ?)")
        .bind(String(userId))
        .run()
    }
  }
}
