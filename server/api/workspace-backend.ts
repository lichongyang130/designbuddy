import { ffmpegAvailable } from "./video-transcode";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

const samples = new Set([
  "travel",
  "museum",
  "luma",
  "city",
  "research",
  "handbook",
  "chishan",
  "nature",
  "hyperframes",
  "film",
  "sound",
  "live",
  "webgl",
  "forme",
  "atelier",
  "roots",
  "daylight",
  "tide",
  "morrow",
]);
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
export const responseJSON = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  // Chromium omits Origin on some same-origin fetch POSTs. Fetch Metadata is a
  // browser-controlled signal; accept only the exact same-origin value when the
  // stricter Origin header is absent. Non-browser clients without either stay blocked.
  if (!origin) return request.headers.get("sec-fetch-site") === "same-origin";
  try {
    const u = new URL(origin),
      target = new URL(request.url);
    const configured = process.env.DESIGNBUDDY_PUBLIC_ORIGIN
      ? new URL(process.env.DESIGNBUDDY_PUBLIC_ORIGIN)
      : null;
    return (
      ["http:", "https:"].includes(u.protocol) &&
      u.host === target.host &&
      u.protocol ===
        (configured?.host === target.host
          ? configured.protocol
          : target.hostname.endsWith(".e2b.app")
            ? "https:"
            : target.protocol) &&
      u.username === "" &&
      u.password === ""
    );
  } catch {
    return false;
  }
}
export class WorkspaceBackend {
  private db: DatabaseSync;
  private attempts = new Map<string, { count: number; until: number }>();
  constructor(
    file = process.env.DESIGNBUDDY_SQLITE_PATH || "./data/designbuddy.sqlite",
  ) {
    const path = resolve(file);
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
   CREATE TABLE IF NOT EXISTS browser_sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS workspace_accounts(id TEXT PRIMARY KEY,username TEXT UNIQUE NOT NULL,salt TEXT NOT NULL,password_hash TEXT NOT NULL,created_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS template_snapshots(owner_id TEXT NOT NULL,sample TEXT NOT NULL,draft TEXT NOT NULL,state_json TEXT NOT NULL,revision INTEGER NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(owner_id,sample,draft));`);
  }
  private cookieToken(request: Request) {
    return request.headers
      .get("cookie")
      ?.split(";")
      .map((p) => p.trim())
      .find((p) => p.startsWith("designbuddy_session="))
      ?.slice("designbuddy_session=".length);
  }
  principal(request: Request): { id: string } | null {
    const token = this.cookieToken(request);
    if (!token || !/^[a-zA-Z0-9_-]{40,60}$/.test(token)) return null;
    const row = this.db
      .prepare(
        "SELECT user_id FROM browser_sessions WHERE token_hash=? AND expires>?",
      )
      .get(hash(token), Date.now()) as { user_id: string } | undefined;
    return row ? { id: row.user_id } : null;
  }
  private identity(id: string) {
    const a = this.db
      .prepare("SELECT username FROM workspace_accounts WHERE id=?")
      .get(id) as { username: string } | undefined;
    return { id, username: a?.username ?? null, kind: a ? "account" : "guest" };
  }
  private sessionCookie(request: Request, token: string, clear = false) {
    const secure =
      request.headers.get("origin")?.startsWith("https://") ||
      new URL(request.url).protocol === "https:";
    return `designbuddy_session=${token}; HttpOnly; Path=/; Max-Age=${clear ? 0 : 30 * 86400}; ${secure ? "Secure; SameSite=None; Partitioned" : "SameSite=Lax"}`;
  }
  private issue(request: Request, id: string) {
    const token = randomBytes(32).toString("base64url");
    this.db
      .prepare("DELETE FROM browser_sessions WHERE expires<=?")
      .run(Date.now());
    this.db
      .prepare("INSERT INTO browser_sessions VALUES(?,?,?)")
      .run(hash(token), id, Date.now() + 30 * 86400_000);
    return this.sessionCookie(request, token);
  }
  private revoke(request: Request) {
    const t = this.cookieToken(request);
    if (t)
      this.db
        .prepare("DELETE FROM browser_sessions WHERE token_hash=?")
        .run(hash(t));
  }
  private async body(
    request: Request,
    max = 600000,
  ): Promise<Record<string, unknown>> {
    if (
      !request.headers
        .get("content-type")
        ?.toLowerCase()
        .startsWith("application/json")
    )
      throw Error("需要 application/json 请求。");
    const text = await request.text();
    if (Buffer.byteLength(text) > max) throw Error("请求内容超出大小限制。");
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw Error("请求必须为 JSON 对象。");
    return value;
  }
  private limited(request: Request) {
    const key = request.headers.get("x-workspace-rate-key") || "local";
    const now = Date.now();
    if (this.attempts.size > 1000) this.attempts.clear();
    let entry = this.attempts.get(key);
    if (!entry || entry.until < now) {
      entry = { count: 0, until: now + 60000 };
      this.attempts.set(key, entry);
    }
    return ++entry.count > 30;
  }
  async handle(request: Request): Promise<Response | null> {
    const url = new URL(request.url),
      path = url.pathname,
      method = request.method;
    if (path === "/api/local/session" && method === "POST") {
      if (!sameOrigin(request))
        return responseJSON({ error: "仅接受同源会话请求。" }, 403);
      try {
        await this.body(request, 1024);
      } catch {
        return responseJSON({ error: "会话请求必须为有效 JSON。" }, 400);
      }
      const existing = this.principal(request);
      if (existing)
        return responseJSON({
          authenticated: true,
          user: this.identity(existing.id),
        });
      const id = "guest-" + randomUUID();
      return responseJSON(
        { authenticated: true, user: this.identity(id) },
        200,
        { "Set-Cookie": this.issue(request, id) },
      );
    }
    if (path === "/api/health" && method === "GET") {
      this.db.prepare("SELECT 1").get();
      return responseJSON({
        ok: true,
        service: "designbuddy-api",
        storage: "sqlite",
        capabilities: {
          projects: true,
          templateSnapshots: true,
          accounts: true,
          collaboration: true,
          aiConfigured: !!(
            process.env.AI_API_KEY || process.env.OPENAI_API_KEY
          ),
          videoTranscodeConfigured: ffmpegAvailable(),
          connectors: false,
          payments: false,
          businessOrders: false,
        },
      });
    }
    const principal = this.principal(request);
    if (path.startsWith("/api/auth/") || path.startsWith("/api/templates")) {
      if (!principal)
        return responseJSON(
          { error: "服务器会话未建立或已过期。", code: "SESSION_REQUIRED" },
          401,
        );
      if (!["GET", "HEAD"].includes(method) && !sameOrigin(request))
        return responseJSON({ error: "跨站修改请求已拒绝。" }, 403);
      if (path === "/api/auth/me" && method === "GET")
        return responseJSON({ user: this.identity(principal.id) });
      if (path === "/api/auth/logout" && method === "POST") {
        this.revoke(request);
        return responseJSON({ ok: true }, 200, {
          "Set-Cookie": this.sessionCookie(request, "", true),
        });
      }
      if (
        (path === "/api/auth/register" || path === "/api/auth/login") &&
        method === "POST"
      ) {
        if (this.limited(request))
          return responseJSON({ error: "操作过于频繁，请一分钟后重试。" }, 429);
        try {
          const body = await this.body(request, 4096),
            username =
              typeof body.username === "string"
                ? body.username.trim().toLowerCase()
                : "";
          const password =
            typeof body.password === "string" ? body.password : "";
          if (
            !/^[a-z0-9_-]{3,40}$/.test(username) ||
            password.length < 10 ||
            password.length > 128
          )
            return responseJSON(
              {
                error:
                  "用户名需 3–40 位字母/数字/下划线/短横线，密码需 10–128 位。",
              },
              400,
            );
          if (path.endsWith("register")) {
            if (this.identity(principal.id).kind === "account")
              return responseJSON({ error: "请先退出当前账号。" }, 409);
            if (
              this.db
                .prepare("SELECT id FROM workspace_accounts WHERE username=?")
                .get(username)
            )
              return responseJSON({ error: "该用户名不可用。" }, 409);
            const salt = randomBytes(16).toString("hex"),
              digest = scryptSync(password, salt, 64).toString("hex");
            this.db
              .prepare("INSERT INTO workspace_accounts VALUES(?,?,?,?,?)")
              .run(
                principal.id,
                username,
                salt,
                digest,
                new Date().toISOString(),
              );
            this.revoke(request);
            return responseJSON({ user: this.identity(principal.id) }, 201, {
              "Set-Cookie": this.issue(request, principal.id),
            });
          }
          const account = this.db
            .prepare(
              "SELECT id,salt,password_hash FROM workspace_accounts WHERE username=?",
            )
            .get(username) as
            | { id: string; salt: string; password_hash: string }
            | undefined;
          const candidate = scryptSync(
            password,
            account?.salt || "unregistered-user",
            64,
          );
          if (
            !account ||
            !timingSafeEqual(
              candidate,
              Buffer.from(account.password_hash, "hex"),
            )
          )
            return responseJSON({ error: "用户名或密码不正确。" }, 401);
          this.revoke(request);
          return responseJSON({ user: this.identity(account.id) }, 200, {
            "Set-Cookie": this.issue(request, account.id),
          });
        } catch {
          return responseJSON({ error: "账号请求无效，请重试。" }, 400);
        }
      }
      if (path === "/api/templates" && method === "GET") {
        const rows = this.db
          .prepare(
            "SELECT sample,draft,revision,updated_at AS updatedAt FROM template_snapshots WHERE owner_id=? ORDER BY updated_at DESC LIMIT 200",
          )
          .all(principal.id);
        return responseJSON(rows);
      }
      const match = path.match(
        /^\/api\/templates\/([a-z]+)\/([a-zA-Z0-9-]{1,60})$/,
      );
      if (match && samples.has(match[1])) {
        const [, sample, draft] = match;
        const load = () =>
          this.db
            .prepare(
              "SELECT state_json,revision,updated_at FROM template_snapshots WHERE owner_id=? AND sample=? AND draft=?",
            )
            .get(principal.id, sample, draft) as
            | { state_json: string; revision: number; updated_at: string }
            | undefined;
        if (method === "GET") {
          const row = load();
          return row
            ? responseJSON({
                state: JSON.parse(row.state_json),
                revision: row.revision,
                updatedAt: row.updated_at,
              })
            : responseJSON(
                { error: "还没有服务器版本。", code: "NOT_FOUND" },
                404,
              );
        }
        if (method === "PUT") {
          try {
            const body = await this.body(request);
            if (
              !Number.isSafeInteger(body.revision) ||
              Number(body.revision) < 0 ||
              !body.state ||
              typeof body.state !== "object" ||
              Array.isArray(body.state)
            )
              return responseJSON({ error: "需要合法版本号与状态对象。" }, 400);
            const state = JSON.stringify(body.state);
            if (Buffer.byteLength(state) > 500000)
              return responseJSON({ error: "模板状态不能超过 500 KB。" }, 413);
            // Compare-and-swap in a write transaction protects multiple tabs/devices.
            this.db.exec("BEGIN IMMEDIATE");
            try {
              const current = load();
              if ((current?.revision ?? 0) !== body.revision) {
                this.db.exec("ROLLBACK");
                return responseJSON(
                  {
                    error:
                      "服务器已有更新版本，请先恢复或下载本地备份，不能覆盖新版本。",
                    code: "REVISION_CONFLICT",
                    revision: current?.revision ?? 0,
                  },
                  409,
                );
              }
              if (!current) {
                const count = this.db
                  .prepare(
                    "SELECT COUNT(*) AS n FROM template_snapshots WHERE owner_id=?",
                  )
                  .get(principal.id) as { n: number };
                if (count.n >= 200) {
                  this.db.exec("ROLLBACK");
                  return responseJSON(
                    { error: "已达到 200 个服务器快照上限。" },
                    409,
                  );
                }
              }
              const revision = Number(body.revision) + 1,
                updatedAt = new Date().toISOString();
              this.db
                .prepare(
                  "INSERT INTO template_snapshots VALUES(?,?,?,?,?,?) ON CONFLICT(owner_id,sample,draft) DO UPDATE SET state_json=excluded.state_json,revision=excluded.revision,updated_at=excluded.updated_at",
                )
                .run(principal.id, sample, draft, state, revision, updatedAt);
              this.db.exec("COMMIT");
              return responseJSON({ saved: true, revision, updatedAt });
            } catch (e) {
              this.db.exec("ROLLBACK");
              throw e;
            }
          } catch {
            return responseJSON({ error: "模板保存请求无效。" }, 400);
          }
        }
      }
      return responseJSON({ error: "接口不存在。" }, 404);
    }
    if (path === "/api/connectors" || path.startsWith("/api/connectors/"))
      return responseJSON(
        {
          error: "连接器授权服务尚未部署；没有进行外部授权或操作。",
          code: "NOT_CONFIGURED",
        },
        503,
      );
    return null;
  }
  close() {
    this.db.close();
  }
}
