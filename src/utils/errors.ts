/**
 * 结构化错误类型
 * 用于替代散落的 `{ error: '...' }` 返回和 `return fail(c, ...)` 模式，
 * 由全局错误处理器统一捕获并返回 JSON 响应。
 */
export class AppError extends Error {
  /** 业务错误码（与 ApiResponse.code 对应） */
  code: number
  /** HTTP 状态码 */
  httpStatus: number

  constructor(code: number, message: string, httpStatus: number) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.httpStatus = httpStatus
  }

  // ========== 静态工厂方法 ==========

  /** 400 - 请求参数错误 */
  static badRequest(message: string): AppError {
    return new AppError(400, message, 400)
  }

  /** 401 - 未认证 */
  static unauthorized(message = '未登录或 token 已失效'): AppError {
    return new AppError(401, message, 401)
  }

  /** 403 - 无权限 */
  static forbidden(message = '无权限'): AppError {
    return new AppError(403, message, 403)
  }

  /** 404 - 资源不存在 */
  static notFound(message = '资源不存在'): AppError {
    return new AppError(404, message, 404)
  }

  /** 409 - 资源冲突（如重复用户名） */
  static conflict(message: string): AppError {
    return new AppError(409, message, 409)
  }

  /** 500 - 服务器内部错误 */
  static internal(message = '服务器内部错误'): AppError {
    return new AppError(500, message, 500)
  }
}