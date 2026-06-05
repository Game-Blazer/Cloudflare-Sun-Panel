import { Hono } from "hono";
import type { D1Database } from "@cloudflare/workers-types";
import type { UserInfo } from "../models/types";
import { UserService } from "../services/UserService";
import { validate, loginSchema, registerSchema } from "../utils/validate";
import { ok, fail, getErrorMessage } from "../utils/response";
import { createRateLimiter } from "../middleware/rateLimiter";

type Variables = {
  validatedBody: unknown
}

const authApp = new Hono<{ Bindings: { DB: D1Database }; Variables: Variables }>();

const loginLimiter = createRateLimiter({ maxRequests: 10, windowMs: 60000 });

/**
 * 登录
 * POST /api/login
 */
authApp.post("/login", loginLimiter, validate(loginSchema), async (c) => {
  try {
    const body = c.get("validatedBody") as { username: string; password: string };
    const userService = new UserService(c.env.DB);

    const result = await userService.authenticate(body.username, body.password);

    if ("error" in result) {
      return fail(c, result.error!);
    }

    return ok(c, { token: result.token, userInfo: result.userInfo });
  } catch (e: unknown) {
    return fail(c, getErrorMessage(e), 500);
  }
});

/**
 * 注册
 * POST /api/register
 */
authApp.post("/register", validate(registerSchema), async (c) => {
  try {
    const body = c.get("validatedBody") as { username: string; password: string; name?: string; mail?: string };
    const userService = new UserService(c.env.DB);

    const db = c.env.DB;
    const existing = await db.prepare("SELECT id FROM users WHERE username = ?").bind(body.username).first();
    if (existing) {
      return fail(c, "该用户名已被注册");
    }

    const userId = await userService.createUser(body.username, body.password, body.name || body.username);

    const { signToken } = await import("../utils/jwt");
    const token = await signToken({ userId, username: body.username, role: 2 });

    const userInfo: UserInfo = {
      id: userId,
      username: body.username,
      name: body.name || body.username,
      headImage: "",
      status: 1,
      role: 2,
      mail: body.mail || "",
      created_at: new Date().toISOString(),
    };

    return ok(c, { token, userInfo });
  } catch (e: unknown) {
    return fail(c, getErrorMessage(e), 500);
  }
});

export default authApp;