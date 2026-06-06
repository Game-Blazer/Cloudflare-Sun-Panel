import { z } from 'zod'

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

export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
})

export const publicVisitUserSchema = z.object({
  userId: z.number().int().positive().nullable(),
})