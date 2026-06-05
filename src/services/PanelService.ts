import type { D1Database } from '@cloudflare/workers-types'
import type { ItemIconRow, ItemIconGroupRow } from '../models/types'
import { queryAll, queryFirst } from '../utils/db'

export class PanelService {
  constructor(private db: D1Database) {}

  formatIcon(row: ItemIconRow) {
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
    }
  }

  formatGroup(row: ItemIconGroupRow) {
    return {
      id: row.id, icon: row.icon, title: row.title, description: row.description,
      sort: row.sort, publicVisible: row.public_visible, userId: row.user_id,
      createTime: row.created_at, updateTime: row.updated_at,
    }
  }

  async getAllData(userId: number) {
    const groups = await queryAll<ItemIconGroupRow>(this.db,
      'SELECT id, icon, title, description, sort, public_visible, user_id, created_at, updated_at FROM item_icon_groups WHERE user_id = ? ORDER BY sort ASC, id ASC', userId)

    const groupIds = groups.map(g => g.id)
    const itemsMap: Record<number, ReturnType<typeof this.formatIcon>[]> = {}

    if (groupIds.length > 0) {
      const placeholders = groupIds.map(() => '?').join(',')
      const iconRows = await queryAll<ItemIconRow>(this.db,
        `SELECT id, icon_json, title, url, description, open_method, sort, item_icon_group_id, user_id, created_at, updated_at FROM item_icons WHERE item_icon_group_id IN (${placeholders}) AND user_id = ? ORDER BY sort ASC, id ASC`,
        ...groupIds, userId)

      for (const row of iconRows) {
        const gid = row.item_icon_group_id
        if (!itemsMap[gid]) itemsMap[gid] = []
        itemsMap[gid].push(this.formatIcon(row))
      }
    }

    const configRow = await queryFirst<{ panel_json: string }>(this.db,
      'SELECT panel_json FROM user_configs WHERE user_id = ?', userId)

    return {
      groups: groups.map(g => this.formatGroup(g)),
      itemsMap,
      panelConfig: configRow?.panel_json ? JSON.parse(configRow.panel_json) : {},
    }
  }

  async addMultipleIcons(items: Array<{
    icon?: unknown; title: string; url: string; description?: string;
    openMethod?: number; sort?: number; itemIconGroupId: number
  }>, userId: number) {
    const stmt = this.db.prepare(
      'INSERT INTO item_icons (icon_json, title, url, description, open_method, sort, item_icon_group_id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    const inserts = items.map(item =>
      stmt.bind(
        JSON.stringify(item.icon || {}), item.title, item.url,
        item.description || '', item.openMethod || 0, item.sort || 0,
        item.itemIconGroupId, userId
      )
    )
    await this.db.batch(inserts)
  }

  async editIcon(body: {
    id?: number; icon?: unknown; title: string; url: string;
    description?: string; openMethod?: number; sort?: number; itemIconGroupId: number
  }, userId: number) {
    if (body.id) {
      await this.db.prepare(
        `UPDATE item_icons SET icon_json = ?, title = ?, url = ?, description = ?,
         open_method = ?, sort = ?, item_icon_group_id = ?, updated_at = datetime('now')
         WHERE id = ? AND user_id = ?`
      ).bind(
        JSON.stringify(body.icon || {}), body.title, body.url,
        body.description || '', body.openMethod || 0, body.sort || 0,
        body.itemIconGroupId, body.id, userId
      ).run()

      const row = await queryFirst<ItemIconRow>(this.db, 'SELECT * FROM item_icons WHERE id = ?', body.id)
      return this.formatIcon(row as ItemIconRow)
    } else {
      const result = await this.db.prepare(
        'INSERT INTO item_icons (icon_json, title, url, description, open_method, sort, item_icon_group_id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        JSON.stringify(body.icon || {}), body.title, body.url,
        body.description || '', body.openMethod || 0, body.sort || 0,
        body.itemIconGroupId, userId
      ).run()

      const row = await queryFirst<ItemIconRow>(this.db,
        'SELECT * FROM item_icons WHERE id = ?', result.meta.last_row_id)
      return this.formatIcon(row as ItemIconRow)
    }
  }

  async getIconsByGroupId(itemIconGroupId: number, userId: number) {
    return (await queryAll<ItemIconRow>(this.db,
      'SELECT * FROM item_icons WHERE item_icon_group_id = ? AND user_id = ? ORDER BY sort ASC, id ASC',
      itemIconGroupId, userId)).map(row => this.formatIcon(row))
  }

  async deleteIcons(ids: number[], userId: number) {
    const placeholders = ids.map(() => '?').join(',')
    await this.db.prepare(
      `DELETE FROM item_icons WHERE id IN (${placeholders}) AND user_id = ?`
    ).bind(...ids, userId).run()
  }

  async saveIconSort(sortItems: Array<{ id: number; sort: number }>, userId: number) {
    const stmt = this.db.prepare(
      "UPDATE item_icons SET sort = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?"
    )
    const batch = sortItems.map(item => stmt.bind(item.sort, item.id, userId))
    await this.db.batch(batch)
  }

  async getGroups(userId: number) {
    const rows = await queryAll<ItemIconGroupRow>(this.db,
      'SELECT * FROM item_icon_groups WHERE user_id = ? ORDER BY sort ASC, id ASC', userId)

    return rows.map(row => this.formatGroup(row))
  }

  async editGroup(body: {
    id?: number; icon?: string; title: string; description?: string;
    sort?: number; publicVisible?: number
  }, userId: number) {
    if (body.id) {
      await this.db.prepare(
        `UPDATE item_icon_groups SET icon = ?, title = ?, description = ?, sort = ?,
         public_visible = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`
      ).bind(
        body.icon || '', body.title, body.description || '',
        body.sort || 0, body.publicVisible ?? 1, body.id, userId
      ).run()

      const row = await queryFirst<ItemIconGroupRow>(this.db, 'SELECT * FROM item_icon_groups WHERE id = ?', body.id)
      return this.formatGroup(row as ItemIconGroupRow)
    } else {
      const result = await this.db.prepare(
        'INSERT INTO item_icon_groups (icon, title, description, sort, public_visible, user_id) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(
        body.icon || '', body.title, body.description || '',
        body.sort || 0, body.publicVisible ?? 1, userId
      ).run()

      const row = await queryFirst<ItemIconGroupRow>(this.db,
        'SELECT * FROM item_icon_groups WHERE id = ?', result.meta.last_row_id)
      return this.formatGroup(row as ItemIconGroupRow)
    }
  }

  async deleteGroups(ids: number[], userId: number) {
    const placeholders = ids.map(() => '?').join(',')
    await Promise.all([
      this.db.prepare(`DELETE FROM item_icons WHERE item_icon_group_id IN (${placeholders}) AND user_id = ?`)
        .bind(...ids, userId).run(),
      this.db.prepare(`DELETE FROM item_icon_groups WHERE id IN (${placeholders}) AND user_id = ?`)
        .bind(...ids, userId).run(),
    ])
  }

  async saveGroupSort(sortItems: Array<{ id: number; sort: number }>, userId: number) {
    const stmt = this.db.prepare(
      "UPDATE item_icon_groups SET sort = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?"
    )
    const batch = sortItems.map(item => stmt.bind(item.sort, item.id, userId))
    await this.db.batch(batch)
  }
}