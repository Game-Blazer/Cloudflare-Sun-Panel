import { Hono } from 'hono'
import type { D1Database } from '@cloudflare/workers-types'
import { publicModeMiddleware, getAuthUser } from '../middleware/auth'
import { PanelService } from '../services/PanelService'
import { SettingsService } from '../services/SettingsService'
import { ok, fail, getErrorMessage } from '../utils/response'
import { AppError } from '../utils/errors'

const initApp = new Hono<{ Bindings: { DB: D1Database } }>()

initApp.use('*', publicModeMiddleware)

initApp.post('/init', async (c) => {
  try {
    const user = getAuthUser(c)
    const db = c.env.DB
    const panelService = new PanelService(db)
    const settingsService = new SettingsService(db)

    const [panelData, aboutData, authInfo] = await Promise.all([
      panelService.getAllData(user?.userId || 0),
      settingsService.getAll(),
      (async () => {
        if (user) {
          return {
            user: {
              id: user.userId,
              username: user.username,
              name: user.name || '',
              role: user.role,
            },
            visitMode: user.visitMode,
          }
        }
        return { user: null, visitMode: 1 }
      })(),
    ])

    c.header('Cache-Control', 'public, max-age=30')
    return ok(c, {
      ...panelData,
      about: aboutData,
      authInfo,
    })
  } catch (e: unknown) {
    if (e instanceof AppError) {
      return fail(c, e.message, e.code, e.httpStatus)
    }
    return fail(c, getErrorMessage(e), 500)
  }
})

export default initApp
