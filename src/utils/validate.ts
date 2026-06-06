import type { Context, Next } from 'hono'
import type { ZodSchema } from 'zod'
import { fail } from './response'

export type Variables = {
  validatedBody: unknown
}

export function validate(schema: ZodSchema) {
  return async (c: Context<{ Variables: Variables }>, next: Next) => {
    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      body = {}
    }
    const result = schema.safeParse(body)
    if (!result.success) {
      const firstError = result.error.errors[0]
      return fail(c, `${firstError.path.join('.')}: ${firstError.message}`)
    }
    c.set('validatedBody', result.data)
    await next()
  }
}

export { loginSchema, registerSchema } from '../validators/auth'
export {
  iconGroupSchema,
  iconEditSchema,
  iconAddMultipleSchema,
  idsSchema,
  sortSchema,
  getListByGroupIdSchema,
  faviconSchema,
  proxyIconSchema,
} from '../validators/panel'
export {
  userConfigSchema,
  userUpdateSchema,
  userPasswordSchema,
  userAdminCreateSchema,
  userAdminUpdateSchema,
  userDeleteSchema,
  paginationSchema,
  publicVisitUserSchema,
} from '../validators/user'
export { settingGetSchema, settingSetSchema, saveAllSchema } from '../validators/settings'