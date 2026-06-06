import { z } from 'zod'

const envSchema = z.object({
  JWT_SECRET: z.string().optional(),
  ALLOWED_ORIGINS: z.string().optional(),
})

export function validateEnv(env: Record<string, unknown>) {
  const result = envSchema.safeParse(env)
  if (!result.success) {
    console.warn('[Env] Environment variable validation warnings:', result.error.format())
  }
  return result.data
}
