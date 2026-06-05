import { Hono } from "hono";
import type { D1Database } from "@cloudflare/workers-types";
import type { z } from "zod";
import { authMiddleware, adminMiddleware, publicModeMiddleware, getAuthUser } from "../middleware/auth";
import { UserService } from "../services/UserService";
import { ok, fail, getErrorMessage } from "../utils/response";
import {
  validate, userConfigSchema, userUpdateSchema, userPasswordSchema,
  userAdminCreateSchema, userAdminUpdateSchema, userDeleteSchema,
  paginationSchema, publicVisitUserSchema,
} from "../utils/validate";

type Variables = {
  validatedBody: unknown;
};

const usersApp = new Hono<{ Bindings: { DB: D1Database }; Variables: Variables }>();

usersApp.post("/userConfig/get", publicModeMiddleware, async (c) => {
  try {
    const svc = new UserService(c.env.DB);
    const user = getAuthUser(c)!;

    const info = await svc.getUserInfo(user.userId);
    if (!info) return fail(c, "用户不存在");

    const row = await c.env.DB.prepare("SELECT * FROM user_configs WHERE user_id = ?")
      .bind(user.userId).first() as unknown as { panel_json: string; search_engine_json: string } | null;

    if (!row) {
      await c.env.DB.prepare("INSERT INTO user_configs (user_id) VALUES (?)").bind(user.userId).run();
      return ok(c, { panel: {}, searchEngine: {} });
    }

    return ok(c, {
      panel: JSON.parse(row.panel_json || "{}"),
      searchEngine: JSON.parse(row.search_engine_json || "{}"),
    });
  } catch (e: unknown) {
    return fail(c, getErrorMessage(e), 500);
  }
});

usersApp.post("/userConfig/set", publicModeMiddleware, validate(userConfigSchema), async (c) => {
  try {
    const user = getAuthUser(c)!;

    if (user.visitMode === 1) return fail(c, "访客模式下不允许修改", 403);

    const { panel, searchEngine } = c.get("validatedBody") as z.infer<typeof userConfigSchema>;
    const panelJson = JSON.stringify(panel || {});
    const searchEngineJson = JSON.stringify(searchEngine || {});

    const existing = await c.env.DB.prepare("SELECT user_id FROM user_configs WHERE user_id = ?")
      .bind(user.userId).first();

    if (existing) {
      await c.env.DB.prepare(
        "UPDATE user_configs SET panel_json = ?, search_engine_json = ?, updated_at = datetime('now') WHERE user_id = ?"
      ).bind(panelJson, searchEngineJson, user.userId).run();
    } else {
      await c.env.DB.prepare(
        "INSERT INTO user_configs (user_id, panel_json, search_engine_json) VALUES (?, ?, ?)"
      ).bind(user.userId, panelJson, searchEngineJson).run();
    }

    return ok(c, null);
  } catch (e: unknown) {
    return fail(c, getErrorMessage(e), 500);
  }
});

usersApp.post("/user/getAuthInfo", publicModeMiddleware, async (c) => {
  try {
    const svc = new UserService(c.env.DB);
    const user = getAuthUser(c)!;

    const info = await svc.getUserInfo(user.userId);
    if (!info) return fail(c, "用户不存在");

    return ok(c, { user: info, visitMode: user.visitMode });
  } catch (e: unknown) {
    return fail(c, getErrorMessage(e), 500);
  }
});

usersApp.post("/user/updateInfo", authMiddleware, validate(userUpdateSchema), async (c) => {
  try {
    const svc = new UserService(c.env.DB);
    const user = getAuthUser(c)!;
    const { name } = c.get("validatedBody") as z.infer<typeof userUpdateSchema>;

    await svc.updateName(user.userId, name);
    return ok(c, null);
  } catch (e: unknown) {
    return fail(c, getErrorMessage(e), 500);
  }
});

usersApp.post("/user/updatePassword", authMiddleware, validate(userPasswordSchema), async (c) => {
  try {
    const svc = new UserService(c.env.DB);
    const user = getAuthUser(c)!;
    const { oldPassword, newPassword } = c.get("validatedBody") as z.infer<typeof userPasswordSchema>;

    const result = await svc.updatePassword(user.userId, oldPassword, newPassword);
    if ("error" in result) return fail(c, result.error as string);

    return ok(c, null);
  } catch (e: unknown) {
    return fail(c, getErrorMessage(e), 500);
  }
});

usersApp.post("/users/getList", authMiddleware, adminMiddleware, validate(paginationSchema), async (c) => {
  try {
    const svc = new UserService(c.env.DB);
    const { page, pageSize } = c.get("validatedBody") as z.infer<typeof paginationSchema>;

    const data = await svc.getList(page, pageSize);
    return ok(c, data);
  } catch (e: unknown) {
    return fail(c, getErrorMessage(e), 500);
  }
});

usersApp.post("/users/create", authMiddleware, adminMiddleware, validate(userAdminCreateSchema), async (c) => {
  try {
    const svc = new UserService(c.env.DB);
    const { username, password, name, role, status } = c.get("validatedBody") as z.infer<typeof userAdminCreateSchema>;

    const result = await svc.adminCreate(username, password, name || username, role, status);
    if ("error" in result) return fail(c, result.error as string);

    return ok(c, null);
  } catch (e: unknown) {
    return fail(c, getErrorMessage(e), 500);
  }
});

usersApp.post("/users/update", authMiddleware, adminMiddleware, validate(userAdminUpdateSchema), async (c) => {
  try {
    const svc = new UserService(c.env.DB);
    const { id, ...data } = c.get("validatedBody") as z.infer<typeof userAdminUpdateSchema>;

    const result = await svc.adminUpdate(id, data);
    if ("error" in result) return fail(c, result.error as string);

    return ok(c, null);
  } catch (e: unknown) {
    return fail(c, getErrorMessage(e), 500);
  }
});

usersApp.post("/users/deletes", authMiddleware, adminMiddleware, validate(userDeleteSchema), async (c) => {
  try {
    const svc = new UserService(c.env.DB);
    const authUser = getAuthUser(c)!;
    const { userIds } = c.get("validatedBody") as z.infer<typeof userDeleteSchema>;

    const result = await svc.adminDelete(userIds, authUser.userId);
    if ("error" in result) return fail(c, result.error as string);

    return ok(c, null);
  } catch (e: unknown) {
    return fail(c, getErrorMessage(e), 500);
  }
});

usersApp.post("/users/getPublicVisitUser", authMiddleware, adminMiddleware, async (c) => {
  try {
    const svc = new UserService(c.env.DB);
    const data = await svc.getPublicVisitUser();
    return ok(c, data);
  } catch (e: unknown) {
    return fail(c, getErrorMessage(e), 500);
  }
});

usersApp.post("/users/setPublicVisitUser", authMiddleware, adminMiddleware, validate(publicVisitUserSchema), async (c) => {
  try {
    const svc = new UserService(c.env.DB);
    const { userId } = c.get("validatedBody") as z.infer<typeof publicVisitUserSchema>;

    if (userId === null || userId === undefined) {
      await svc.setPublicVisitUser(null);
      return ok(c, null);
    }

    await svc.setPublicVisitUser(userId);
    return ok(c, null);
  } catch (e: unknown) {
    return fail(c, getErrorMessage(e), 500);
  }
});

export default usersApp;