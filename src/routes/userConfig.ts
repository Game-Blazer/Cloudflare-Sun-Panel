import { Hono } from 'hono'
import type { D1Database } from '@cloudflare/workers-types'
import type { z } from 'zod'
import { publicModeMiddleware, getAuthUser } from '../middleware/auth'
import { UserService } from '../services/UserService'
import { ok, fail } from '../utils/response'
import { validate, userConfigSchema } from '../utils/validate'

type Variables = {
  validatedBody: unknown
}

const userConfigApp = new Hono<{ Bindings: { DB: D1Database }; Variables: Variables }>()

userConfigApp.post('/userConfig/get', publicModeMiddleware, async (c) => {
  const svc = new UserService(c.env.DB)
  const user = getAuthUser(c)!

  const [info, row] = await Promise.all([
    svc.getUserInfo(user.userId),
    c.env.DB.prepare('SELECT * FROM user_configs WHERE user_id = ?').bind(user.userId).first()
  ])

  if (!info) return fail(c, '用户不存在')

  const configRow = row as unknown as { panel_json: string; search_engine_json: string } | null

  if (!configRow) {
    await c.env.DB.prepare('INSERT INTO user_configs (user_id) VALUES (?)').bind(user.userId).run()
    return ok(c, { panel: {}, searchEngine: {} })
  }

  return ok(c, {
    panel: JSON.parse(configRow.panel_json || '{}'),
    searchEngine: JSON.parse(configRow.search_engine_json || '{}'),
  })
})

userConfigApp.post('/userConfig/set', publicModeMiddleware, validate(userConfigSchema), async (c) => {
  const user = getAuthUser(c)!

  if (user.visitMode === 1) return fail(c, '访客模式下不允许修改', 403)

  const { panel, searchEngine } = c.get('validatedBody') as z.infer<typeof userConfigSchema>
  const panelJson = JSON.stringify(panel || {})
  const searchEngineJson = JSON.stringify(searchEngine || {})

  const existing = await c.env.DB.prepare('SELECT user_id FROM user_configs WHERE user_id = ?')
    .bind(user.userId)
    .first()

  if (existing) {
    await c.env.DB.prepare(
      "UPDATE user_configs SET panel_json = ?, search_engine_json = ?, updated_at = datetime('now') WHERE user_id = ?",
    )
      .bind(panelJson, searchEngineJson, user.userId)
      .run()
  } else {
    await c.env.DB.prepare('INSERT INTO user_configs (user_id, panel_json, search_engine_json) VALUES (?, ?, ?)')
      .bind(user.userId, panelJson, searchEngineJson)
      .run()
  }

  return ok(c, null)
})

export default userConfigApp