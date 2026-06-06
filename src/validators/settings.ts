import { z } from 'zod'

export const settingGetSchema = z.object({
  configName: z.string().min(1, 'configName 不能为空'),
})

export const settingSetSchema = z.object({
  configName: z.string().min(1, 'configName 不能为空'),
  configValue: z.string().optional(),
})

export const saveAllSchema = z.record(z.string(), z.string())