import { Hono } from 'hono'
import type { D1Database } from '@cloudflare/workers-types'
import type { z } from 'zod'
import { authMiddleware, publicModeMiddleware, getAuthUser } from '../middleware/auth'
import { UserService } from '../services/UserService'
import { AppError } from '../utils/errors'
import { ok, fail, getErrorMessage } from '../utils/response'
import {
  validate,
  userUpdateSchema,
  userPasswordSchema,
} from '../utils/validate'

type Variables = {
  validatedBody: unknown
}

const usersApp = new Hono<{ Bindings: { DB: D1Database }; Variables: Variables }>()

usersApp.post('/user/getAuthInfo', publicModeMiddleware, async (c) => {
  try {
    const svc = new UserService(c.env.DB)
    const user = getAuthUser(c)!

    const info = await svc.getUserInfo(user.userId)
    if (!info) return fail(c, '用户不存在')

    return ok(c, { user: info, visitMode: user.visitMode })
  } catch (e: unknown) {
    if (e instanceof AppError) {
      return fail(c, e.message, e.code, e.httpStatus)
    }
    return fail(c, getErrorMessage(e), 500)
  }
})

usersApp.post('/user/updateInfo', authMiddleware, validate(userUpdateSchema), async (c) => {
  try {
    const svc = new UserService(c.env.DB)
    const user = getAuthUser(c)!
    const { name } = c.get('validatedBody') as z.infer<typeof userUpdateSchema>

    await svc.updateName(user.userId, name)
    return ok(c, null)
  } catch (e: unknown) {
    if (e instanceof AppError) {
      return fail(c, e.message, e.code, e.httpStatus)
    }
    return fail(c, getErrorMessage(e), 500)
  }
})

usersApp.post('/user/updatePassword', authMiddleware, validate(userPasswordSchema), async (c) => {
  try {
    const svc = new UserService(c.env.DB)
    const user = getAuthUser(c)!
    const { oldPassword, newPassword } = c.get('validatedBody') as z.infer<typeof userPasswordSchema>

    await svc.updatePassword(user.userId, oldPassword, newPassword)

    return ok(c, null)
  } catch (e: unknown) {
    if (e instanceof AppError) {
      return fail(c, e.message, e.code, e.httpStatus)
    }
    return fail(c, getErrorMessage(e), 500)
  }
})

export default usersApp