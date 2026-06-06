import type { Context, Next } from 'hono'
import { z, type ZodSchema } from 'zod'
import { fail } from './response'

type Variables = {
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

export const loginSchema = z.object({
  username: z.string().min(1, '用户名不能为空').max(100),
  password: z.string().min(1, '密码不能为空').max(128),
})

export const registerSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(6, '密码至少6位').max(128),
  name: z.string().max(50).optional(),
  mail: z.string().email('邮箱格式错误').max(200).optional().or(z.literal('')),
})

export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
})

export const iconGroupSchema = z.object({
  id: z.number().int().positive().optional(),
  icon: z.string().optional(),
  title: z.string().min(1, '标题不能为空'),
  description: z.string().optional(),
  sort: z.number().int().optional(),
  publicVisible: z.number().int().min(0).max(1).optional(),
})

export const iconEditSchema = z.object({
  id: z.number().int().positive().optional(),
  icon: z
    .object({
      itemType: z.number().int(),
      src: z.string().optional(),
      text: z.string().optional(),
      backgroundColor: z.string().optional(),
    })
    .optional(),
  title: z.string().min(1, '标题不能为空'),
  url: z.string(),
  description: z.string().optional(),
  openMethod: z.number().int().optional(),
  sort: z.number().int().optional(),
  itemIconGroupId: z.number().int(),
})

export const iconAddMultipleSchema = z.array(
  z.object({
    icon: z
      .object({
        itemType: z.number().int(),
        src: z.string().optional(),
        text: z.string().optional(),
        backgroundColor: z.string().optional(),
      })
      .optional(),
    title: z.string(),
    url: z.string(),
    description: z.string().optional(),
    openMethod: z.number().int().optional(),
    sort: z.number().int().optional(),
    itemIconGroupId: z.number().int(),
  }),
)

export const idsSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'ids 不能为空'),
})

export const userConfigSchema = z.object({
  panel: z.record(z.unknown()).optional(),
  searchEngine: z.record(z.unknown()).optional(),
})

export const userUpdateSchema = z.object({
  name: z.string().min(1, '名称不能为空'),
})

export const userPasswordSchema = z.object({
  oldPassword: z.string().min(1, '密码不能为空'),
  newPassword: z.string().min(6, '新密码至少6位').max(128),
})

export const userAdminCreateSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(6, '密码至少6位').max(128),
  name: z.string().max(50).optional(),
  role: z.number().int().min(1).max(2).optional(),
  status: z.number().int().min(0).max(1).optional(),
})

export const userAdminUpdateSchema = z.object({
  id: z.number().int().positive(),
  username: z.string().min(1).max(100).optional(),
  password: z.string().max(128).optional().default(''),
  name: z.string().max(50).optional(),
  role: z.number().int().min(1).max(2).optional(),
  status: z.number().int().min(0).max(1).optional(),
})

export const userDeleteSchema = z.object({
  userIds: z.array(z.number().int().positive()).min(1, 'userIds 不能为空'),
})

export const settingGetSchema = z.object({
  configName: z.string().min(1, 'configName 不能为空'),
})

export const settingSetSchema = z.object({
  configName: z.string().min(1, 'configName 不能为空'),
  configValue: z.string().optional(),
})

export const publicVisitUserSchema = z.object({
  userId: z.number().int().positive().nullable(),
})

export const getListByGroupIdSchema = z.object({
  itemIconGroupId: z.number().int().optional(),
})

export const faviconSchema = z.object({
  url: z.string().min(1, 'url 不能为空'),
})

export const saveAllSchema = z.record(z.string(), z.string())

export const sortSchema = z.object({
  sortItems: z
    .array(
      z.object({
        id: z.number().int().positive(),
        sort: z.number().int(),
      }),
    )
    .min(1),
})
