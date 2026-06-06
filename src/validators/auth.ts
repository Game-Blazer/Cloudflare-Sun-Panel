import { z } from 'zod'

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