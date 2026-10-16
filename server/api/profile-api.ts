import { sameOrigin, responseJSON } from "./workspace-backend";
import type { ProfileStore } from "./profile";

/**
 * The account data routes: preferences that follow the account, memories the
 * person allowed, the devices that used it, and export / forget.
 *
 * Every route is scoped to the account id of the current session; no route can
 * read or write another account's rows.
 */
export async function handleProfileRequest(request: Request, ownerId: string, store: ProfileStore): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "");
  const method = request.method;

  if (!["GET", "HEAD"].includes(method) && !sameOrigin(request)) {
    return responseJSON({ error: "跨站修改请求已拒绝。" }, 403);
  }

  // Every request refreshes the device record of the account.
  store.touchDevice(ownerId, request.headers.get("user-agent") || "");

  if (path === "/api/profile" && method === "GET") {
    return responseJSON({
      owner: ownerId,
      preferences: store.listPreferences(ownerId),
      memories: store.listMemories(ownerId),
      devices: store.listDevices(ownerId),
    });
  }

  if (path === "/api/profile/preferences") {
    if (method === "GET") return responseJSON({ preferences: store.listPreferences(ownerId) });
    if (method === "PUT" || method === "POST") {
      const body = await readJson(request);
      try {
        const saved = store.savePreference(ownerId, String(body.key || ""), body.value);
        return responseJSON({ preference: saved });
      } catch (error) {
        return responseJSON({ error: error instanceof Error ? error.message : "偏好保存失败。" }, 400);
      }
    }
    return responseJSON({ error: "不支持的请求方法。" }, 405);
  }

  if (path === "/api/profile/memories") {
    if (method === "GET") return responseJSON({ memories: store.listMemories(ownerId) });
    if (method === "POST") {
      const body = await readJson(request);
      try {
        const memory = store.addMemory(ownerId, {
          kind: typeof body.kind === "string" ? body.kind : "note",
          content: typeof body.content === "string" ? body.content : "",
          source: typeof body.source === "string" ? body.source : "",
          consent: body.consent === true,
        });
        return responseJSON({ memory });
      } catch (error) {
        return responseJSON({ error: error instanceof Error ? error.message : "记忆写入失败。" }, 400);
      }
    }
    if (method === "DELETE") {
      const removed = store.clearMemories(ownerId);
      return responseJSON({ removed });
    }
    return responseJSON({ error: "不支持的请求方法。" }, 405);
  }

  const memoryMatch = path.match(/^\/api\/profile\/memories\/([^/]+)$/);
  if (memoryMatch && method === "DELETE") {
    const removed = store.deleteMemory(ownerId, decodeURIComponent(memoryMatch[1]));
    if (!removed) return responseJSON({ error: "没有找到这条记忆，或它不属于当前账号。" }, 404);
    return responseJSON({ removed: true });
  }

  if (path === "/api/profile/devices" && method === "GET") {
    return responseJSON({ devices: store.listDevices(ownerId) });
  }

  if (path === "/api/profile/export" && method === "GET") {
    const payload = store.exportOwner(ownerId);
    return responseJSON(payload, 200, {
      "Content-Disposition": `attachment; filename="designbuddy-profile-${ownerId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40)}.json"`,
    });
  }

  if (path === "/api/profile/forget" && method === "POST") {
    const body = await readJson(request);
    if (body.confirm !== true) {
      return responseJSON({ error: "清除数据需要本人确认：请提交 confirm=true。" }, 400);
    }
    return responseJSON({ forgotten: store.forgetOwner(ownerId) });
  }

  return responseJSON({ error: "未找到该接口。" }, 404);
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const text = await request.text();
    if (!text.trim()) return {};
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
