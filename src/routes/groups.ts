import { Hono } from 'hono'
import type { D1Database } from '@cloudflare/workers-types'
import type { z } from 'zod'
import { publicModeMiddleware, getAuthUser } from '../middleware/auth'
import { PanelService } from '../services/PanelService'
import { ok, fail, getErrorMessage } from '../utils/response'
import { validate, iconGroupSchema, idsSchema, sortSchema } from '../utils/validate'

type Variables = {
  validatedBody: unknown
}

const groupsApp = new Hono<{ Bindings: { DB: D1Database }; Variables: Variables }>()

groupsApp.use('*', publicModeMiddleware)

groupsApp.post('/itemIconGroup/getList', async (c) => {
  try {
    const svc = new PanelService(c.env.DB)
    const user = getAuthUser(c)!

    const list = await svc.getGroups(user.userId)
    c.header('Cache-Control', 'public, max-age=60')
    return ok(c, list)
  } catch (e: unknown) {
    return fail(c, getErrorMessage(e), 500)
  }
})

groupsApp.post('/itemIconGroup/edit', validate(iconGroupSchema), async (c) => {
  try {
    const svc = new PanelService(c.env.DB)
    const user = getAuthUser(c)!

    if (user.visitMode === 1) return fail(c, '访客模式下不允许修改', 403)

    const body = c.get('validatedBody') as z.infer<typeof iconGroupSchema>
    const result = await svc.editGroup(body, user.userId)
    return ok(c, result)
  } catch (e: unknown) {
    return fail(c, getErrorMessage(e), 500)
  }
})

groupsApp.post('/itemIconGroup/deletes', validate(idsSchema), async (c) => {
  try {
    const svc = new PanelService(c.env.DB)
    const user = getAuthUser(c)!
    if (user.visitMode === 1) return fail(c, '访客模式下不允许修改', 403)
    const { ids } = c.get('validatedBody') as z.infer<typeof idsSchema>

    await svc.deleteGroups(ids, user.userId)
    return ok(c, null)
  } catch (e: unknown) {
    return fail(c, getErrorMessage(e), 500)
  }
})

groupsApp.post('/itemIconGroup/saveSort', validate(sortSchema), async (c) => {
  try {
    const svc = new PanelService(c.env.DB)
    const user = getAuthUser(c)!
    if (user.visitMode === 1) return fail(c, '访客模式下不允许修改', 403)
    const { sortItems } = c.get('validatedBody') as z.infer<typeof sortSchema>

    await svc.saveGroupSort(sortItems, user.userId)
    return ok(c, null)
  } catch (e: unknown) {
    return fail(c, getErrorMessage(e), 500)
  }
})

export default groupsApp
