import type { D1Database } from '@cloudflare/workers-types'
import type { UserRow } from '../models/types'
import { hashPassword, verifyPassword } from '../utils/password'
import { signToken } from '../utils/jwt'
import { queryAll, queryFirst } from '../utils/db'
import { AppError } from '../utils/errors'

export class UserService {
  constructor(private db: D1Database) {}

  async findByUsername(username: string): Promise<UserRow | null> {
    return queryFirst<UserRow>(
      this.db,
      'SELECT id, username, password, name, head_image, status, role, mail, created_at, updated_at FROM users WHERE username = ?',
      username,
    )
  }

  async findById(id: number): Promise<UserRow | null> {
    return queryFirst<UserRow>(
      this.db,
      'SELECT id, username, password, name, head_image, status, role, mail, created_at, updated_at FROM users WHERE id = ?',
      id,
    )
  }

  async authenticate(username: string, password: string) {
    const user = await this.findByUsername(username)
    if (!user) throw AppError.unauthorized('用户名或密码错误')

    const valid = await verifyPassword(password, user.password)
    if (!valid) throw AppError.unauthorized('用户名或密码错误')

    if (user.status !== 1) throw AppError.forbidden('账号已被禁用')

    const token = await signToken({ userId: user.id, username: user.username, role: user.role })

    return {
      token,
      userInfo: {
        id: user.id,
        username: user.username,
        name: user.name || '',
        headImage: user.head_image || '',
        status: user.status,
        role: user.role,
        mail: user.mail || '',
        created_at: user.created_at,
      },
    }
  }

  async createUser(username: string, password: string, name: string, role = 2) {
    const hashed = await hashPassword(password)
    const result = await this.db
      .prepare('INSERT INTO users (username, password, name, role, status) VALUES (?, ?, ?, ?, 1)')
      .bind(username, hashed, name, role)
      .run()

    const userId = Number(result.meta.last_row_id)
    await this.db.prepare('INSERT OR IGNORE INTO user_configs (user_id) VALUES (?)').bind(userId).run()

    return userId
  }

  async getUserInfo(id: number) {
    const row = await this.findById(id)
    if (!row) return null
    return {
      id: row.id,
      username: row.username,
      name: row.name || '',
      headImage: row.head_image || '',
      status: row.status,
      role: row.role,
      mail: row.mail || '',
      created_at: row.created_at,
    }
  }

  async updateName(userId: number, name: string) {
    await this.db
      .prepare("UPDATE users SET name = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(name, userId)
      .run()
  }

  async updatePassword(userId: number, oldPassword: string, newPassword: string) {
    const row = await queryFirst<UserRow>(this.db, 'SELECT password FROM users WHERE id = ?', userId)

    if (!row) throw AppError.notFound('用户不存在')

    const valid = await verifyPassword(oldPassword, row.password)
    if (!valid) throw AppError.badRequest('原密码错误')

    const newHash = await hashPassword(newPassword)
    await this.db
      .prepare("UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(newHash, userId)
      .run()

    return { success: true }
  }

  async getList(page: number, pageSize: number) {
    const offset = (page - 1) * pageSize
    const [list, countResult] = await Promise.all([
      queryAll<UserRow>(this.db, 'SELECT * FROM users ORDER BY id DESC LIMIT ? OFFSET ?', pageSize, offset),
      this.db.prepare('SELECT COUNT(*) as total FROM users').first() as Promise<{ total: number }>,
    ])

    const mapped = list.map((r) => ({
      id: r.id,
      username: r.username,
      name: r.name,
      headImage: r.head_image,
      status: r.status,
      role: r.role,
      mail: r.mail,
      createTime: r.created_at,
      updateTime: r.updated_at,
    }))

    return { list: mapped, total: countResult.total, page, pageSize }
  }

  async adminCreate(username: string, password: string, name: string, role = 2, status = 1) {
    const existing = await this.db.prepare('SELECT id FROM users WHERE username = ?').bind(username).first()
    if (existing) throw AppError.conflict('该用户名已被注册')

    const hashedPwd = await hashPassword(password)
    await this.db
      .prepare('INSERT INTO users (username, password, name, role, status) VALUES (?, ?, ?, ?, ?)')
      .bind(username, hashedPwd, name || username, role, status)
      .run()

    return { success: true }
  }

  async adminUpdate(
    id: number,
    data: {
      username?: string
      password?: string
      name?: string
      role?: number
      status?: number
    },
  ) {
    const updates: string[] = []
    const params: unknown[] = []

    if (data.username) {
      const existing = await this.db
        .prepare('SELECT id FROM users WHERE username = ? AND id != ?')
        .bind(data.username, id)
        .first()
      if (existing) throw AppError.conflict('该用户名已被注册')
      updates.push('username = ?')
      params.push(data.username)
    }
    if (data.name) {
      updates.push('name = ?')
      params.push(data.name)
    }
    if (data.password) {
      updates.push('password = ?')
      params.push(await hashPassword(data.password))
    }
    if (data.role !== undefined) {
      updates.push('role = ?')
      params.push(data.role)
    }
    if (data.status !== undefined) {
      updates.push('status = ?')
      params.push(data.status)
    }

    if (updates.length === 0) throw AppError.badRequest('无更新数据')

    updates.push("updated_at = datetime('now')")
    params.push(id)

    await this.db
      .prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...params)
      .run()
    return { success: true }
  }

  async adminDelete(userIds: number[], selfUserId: number) {
    const filteredIds = userIds.filter((id) => id !== selfUserId)
    if (filteredIds.length === 0) throw AppError.badRequest('不能删除自己')

    const placeholders = filteredIds.map(() => '?').join(',')
    await Promise.all([
      this.db
        .prepare(`DELETE FROM item_icons WHERE user_id IN (${placeholders})`)
        .bind(...filteredIds)
        .run(),
      this.db
        .prepare(`DELETE FROM item_icon_groups WHERE user_id IN (${placeholders})`)
        .bind(...filteredIds)
        .run(),
      this.db
        .prepare(`DELETE FROM user_configs WHERE user_id IN (${placeholders})`)
        .bind(...filteredIds)
        .run(),
      this.db
        .prepare(`DELETE FROM users WHERE id IN (${placeholders})`)
        .bind(...filteredIds)
        .run(),
    ])

    return { success: true }
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

  async register(username: string, password: string, name?: string, mail?: string) {
    // Check if username already exists
    const existing = await this.db.prepare('SELECT id FROM users WHERE username = ?').bind(username).first()
    if (existing) {
      throw AppError.conflict('该用户名已被注册')
    }

    // Create user
    const hashed = await hashPassword(password)
    const result = await this.db
      .prepare('INSERT INTO users (username, password, name, role, status) VALUES (?, ?, ?, ?, 1)')
      .bind(username, hashed, name || username, 2)
      .run()

    const userId = Number(result.meta.last_row_id)
    await this.db.prepare('INSERT OR IGNORE INTO user_configs (user_id) VALUES (?)').bind(userId).run()

    // Sign JWT token
    const token = await signToken({ userId, username, role: 2 })

    // Build user info
    const userInfo = {
      id: userId,
      username,
      name: name || username,
      headImage: '',
      status: 1,
      role: 2,
      mail: mail || '',
      created_at: new Date().toISOString(),
    }

    return { token, userInfo }
  }
}
