import { cors } from 'hono/cors'

/**
 * CORS 中间件 - 使用 Hono 内置的 cors
 */
export const corsMiddleware = cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
})