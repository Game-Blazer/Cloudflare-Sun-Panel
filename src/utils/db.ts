import type { D1Database } from '@cloudflare/workers-types'

/**
 * D1 泛型查询包装器 - 查询多条记录
 */
export async function queryAll<T>(db: D1Database, sql: string, ...params: unknown[]): Promise<T[]> {
  try {
    const result = await db.prepare(sql).bind(...params).all()
    return result.results as unknown as T[]
  } catch (err: unknown) {
    throw new Error(`数据库查询失败: ${err instanceof Error ? err.message : '未知错误'}`, { cause: err })
  }
}

/**
 * D1 泛型查询包装器 - 查询单条记录
 */
export async function queryFirst<T>(db: D1Database, sql: string, ...params: unknown[]): Promise<T | null> {
  try {
    const result = await db.prepare(sql).bind(...params).first()
    return result as unknown as T | null
  } catch (err: unknown) {
    throw new Error(`数据库查询失败: ${err instanceof Error ? err.message : '未知错误'}`, { cause: err })
  }
}
