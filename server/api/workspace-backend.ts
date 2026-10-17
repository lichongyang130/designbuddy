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
   CREATE TABLE IF NOT EXISTS template_snapshots(owner_id TEXT NOT NULL,sample TEXT NOT NULL,draft TEXT NOT NULL,state_json TEXT NOT NULL,revision INTEGER NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(owner_id,sample,draft));
   CREATE TABLE IF NOT EXISTS workspace_account_audit(id TEXT PRIMARY KEY,account_id TEXT NOT NULL,actor TEXT NOT NULL,action TEXT NOT NULL,detail TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL);
   CREATE INDEX IF NOT EXISTS workspace_account_audit_account ON workspace_account_audit(account_id,created_at);`);
    // Older databases have the account table without the profile columns.
    const accountColumns = this.db.prepare("PRAGMA table_info(workspace_accounts)").all() as Array<{ name: string }>;
    if (!accountColumns.some((column) => column.name === "display_name"))
      this.db.exec("ALTER TABLE workspace_accounts ADD COLUMN display_name TEXT NOT NULL DEFAULT ''");
    if (!accountColumns.some((column) => column.name === "email"))
      this.db.exec("ALTER TABLE workspace_accounts ADD COLUMN email TEXT NOT NULL DEFAULT ''");
    // An operator can turn an account off; the sessions of a disabled account end.
    if (!accountColumns.some((column) => column.name === "disabled"))
      this.db.exec("ALTER TABLE workspace_accounts ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0");
  }
  /** Record what happened to an account. The detail never holds the content itself. */
  private auditAccount(accountId: string, action: string, detail = "") {
    this.db
      .prepare("INSERT INTO workspace_account_audit(id,account_id,actor,action,detail,created_at) VALUES(?,?,?,?,?,?)")
      .run(randomUUID(), accountId, accountId, action, detail.slice(0, 300), Date.now());
  }
  private listAccountAudit(accountId: string) {
    return this.db
      .prepare("SELECT id,actor,action,detail,created_at FROM workspace_account_audit WHERE account_id=? ORDER BY created_at DESC LIMIT 100")
      .all(accountId)
      .map((row) => ({
        id: String((row as { id: string }).id),
        actor: String((row as { actor: string }).actor),
        action: String((row as { action: string }).action),
        detail: String((row as { detail: string }).detail || ""),
        createdAt: Number((row as { created_at: number }).created_at),
      }));
  }
  /** The accounts on this server. Password material never leaves the database. */
  adminAccounts() {
    const rows = this.db
      .prepare(
        "SELECT id,username,display_name,email,created_at,disabled FROM workspace_accounts ORDER BY created_at ASC",
      )
      .all() as Array<{
      id: string;
      username: string;
      display_name: string;
      email: string;
      created_at: string;
      disabled: number;
    }>;
    return rows.map((row) => ({
      id: row.id,
      username: row.username,
      displayName: row.display_name || "",
      email: row.email || "",
      createdAt: row.created_at,
      disabled: Boolean(row.disabled),
    }));
  }

  /**
   * Turn an account on or off. A disabled account cannot sign in any more and
   * every session it had ends immediately.
   */
  adminSetAccountEnabled(id: string, enabled: boolean) {
    const account = this.db
      .prepare("SELECT id,username FROM workspace_accounts WHERE id=?")
      .get(id) as { id: string; username: string } | undefined;
    if (!account) return null;
    this.db.prepare("UPDATE workspace_accounts SET disabled=? WHERE id=?").run(enabled ? 0 : 1, id);
    if (!enabled) this.db.prepare("DELETE FROM browser_sessions WHERE user_id=?").run(id);
    this.auditAccount(
      id,
      enabled ? "account.enable" : "account.disable",
      enabled ? "管理员恢复账号" : "管理员停用账号，已有会话已失效",
    );
    return { id, username: account.username, enabled };
  }

  /** The account audit across every account, newest first. */
  adminAccountAudit(limit = 100) {
    const rows = this.db
      .prepare(
        "SELECT a.id,a.account_id,a.action,a.detail,a.created_at,coalesce(c.username,'') AS username FROM workspace_account_audit a LEFT JOIN workspace_accounts c ON c.id=a.account_id ORDER BY a.created_at DESC LIMIT ?",
      )
      .all(Math.max(1, Math.min(500, limit))) as Array<{
      id: string;
      account_id: string;
      action: string;
      detail: string;
      created_at: number;
      username: string;
    }>;
    return rows.map((row) => ({
      id: row.id,
      accountId: row.account_id,
      username: row.username,
      action: row.action,
      detail: row.detail || "",
      createdAt: Number(row.created_at),
    }));
  }

  private cookieToken(request: Request) {
    return request.headers
      .get("cookie")
      ?.split(";")
      .map((p) => p.trim())
      .find((p) => p.startsWith("designbuddy_session="))
      ?.slice("designbuddy_session=".length);
  }
  principal(request: Request): { id: string; username?: string } | null {
    const token = this.cookieToken(request);
    if (!token || !/^[a-zA-Z0-9_-]{40,60}$/.test(token)) return null;
    const row = this.db
      .prepare(
        "SELECT s.user_id AS user_id,coalesce(a.username,'') AS username FROM browser_sessions s LEFT JOIN workspace_accounts a ON a.id=s.user_id WHERE s.token_hash=? AND s.expires>?",
      )
      .get(hash(token), Date.now()) as { user_id: string; username: string } | undefined;
    return row ? { id: row.user_id, ...(row.username ? { username: row.username } : {}) } : null;
  }
  private identity(id: string) {
    const a = this.db
      .prepare("SELECT username,display_name,email,created_at FROM workspace_accounts WHERE id=?")
      .get(id) as { username: string; display_name: string; email: string; created_at: string } | undefined;
    return {
      id,
      username: a?.username ?? null,
      displayName: a?.display_name ?? "",
      email: a?.email ?? "",
      createdAt: a?.created_at ?? "",
      kind: a ? "account" : "guest",
    };
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
      if (path === "/api/auth/audit" && method === "GET")
        return responseJSON(this.listAccountAudit(principal.id));
      if (path === "/api/auth/profile" && method === "PATCH") {
        const account = this.db
          .prepare("SELECT id FROM workspace_accounts WHERE id=?")
          .get(principal.id) as { id: string } | undefined;
        if (!account)
          return responseJSON(
            { error: "游客会话没有可编辑的账号资料。", code: "ACCOUNT_REQUIRED" },
            403,
          );
        try {
          const body = await this.body(request, 4096);
          const displayName =
            typeof body.displayName === "string" ? body.displayName.trim() : "";
          const email = typeof body.email === "string" ? body.email.trim() : "";
          if (displayName.length > 40)
            return responseJSON({ error: "显示名最多 40 个字符。" }, 400);
          if (email.length > 120 || (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)))
            return responseJSON(
              { error: "邮箱格式不正确，或超过 120 个字符。" },
              400,
            );
          this.db
            .prepare("UPDATE workspace_accounts SET display_name=?,email=? WHERE id=?")
            .run(displayName, email, principal.id);
          this.auditAccount(
            principal.id,
            "account.profile.update",
            `更新显示名/邮箱（显示名 ${displayName ? "已填" : "留空"}）`,
          );
          return responseJSON({ user: this.identity(principal.id) });
        } catch {
          return responseJSON({ error: "账号资料请求无效，请重试。" }, 400);
        }
      }
      if (path === "/api/auth/password" && method === "POST") {
        // Password checks are rate limited so a stolen session cannot brute force the password.
        if (this.limited(request))
          return responseJSON({ error: "操作过于频繁，请一分钟后重试。" }, 429);
        const account = this.db
          .prepare("SELECT id,salt,password_hash FROM workspace_accounts WHERE id=?")
          .get(principal.id) as
          | { id: string; salt: string; password_hash: string }
          | undefined;
        if (!account)
          return responseJSON(
            { error: "游客会话没有可修改的密码。", code: "ACCOUNT_REQUIRED" },
            403,
          );
        try {
          const body = await this.body(request, 4096);
          const currentPassword =
            typeof body.currentPassword === "string" ? body.currentPassword : "";
          const newPassword =
            typeof body.newPassword === "string" ? body.newPassword : "";
          const candidate = scryptSync(
            currentPassword,
            account.salt,
            64,
          );
          if (
            !timingSafeEqual(
              candidate,
              Buffer.from(account.password_hash, "hex"),
            )
          )
            return responseJSON({ error: "当前密码不正确。" }, 401);
          if (newPassword.length < 10 || newPassword.length > 128)
            return responseJSON(
              { error: "新密码需 10–128 位。" },
              400,
            );
          const salt = randomBytes(16).toString("hex");
          this.db
            .prepare("UPDATE workspace_accounts SET salt=?,password_hash=? WHERE id=?")
            .run(salt, scryptSync(newPassword, salt, 64).toString("hex"), principal.id);
          // Other sessions of this account are dropped; the current one stays valid.
          const token = this.cookieToken(request);
          this.db
            .prepare("DELETE FROM browser_sessions WHERE user_id=? AND token_hash<>?")
            .run(principal.id, token ? hash(token) : "");
          this.auditAccount(principal.id, "account.password.change", "修改登录密码");
          return responseJSON({ ok: true, user: this.identity(principal.id) });
        } catch {
          return responseJSON({ error: "密码请求无效，请重试。" }, 400);
        }
      }
      if (path === "/api/auth/account" && method === "DELETE") {
        if (this.limited(request))
          return responseJSON({ error: "操作过于频繁，请一分钟后重试。" }, 429);
        const account = this.db
          .prepare("SELECT id,salt,password_hash FROM workspace_accounts WHERE id=?")
          .get(principal.id) as
          | { id: string; salt: string; password_hash: string }
          | undefined;
        if (!account)
          return responseJSON(
            { error: "游客会话没有可删除的账号。", code: "ACCOUNT_REQUIRED" },
            403,
          );
        try {
          const body = await this.body(request, 4096);
          if (body.confirm !== true)
            return responseJSON(
              { error: "删除账号需要显式确认（confirm=true）。" },
              400,
            );
          const currentPassword =
            typeof body.currentPassword === "string" ? body.currentPassword : "";
          const candidate = scryptSync(currentPassword, account.salt, 64);
          if (
            !timingSafeEqual(
              candidate,
              Buffer.from(account.password_hash, "hex"),
            )
          )
            return responseJSON({ error: "当前密码不正确。" }, 401);
          this.db
            .prepare("DELETE FROM browser_sessions WHERE user_id=?")
            .run(principal.id);
          this.db
            .prepare("DELETE FROM workspace_accounts WHERE id=?")
            .run(principal.id);
          this.auditAccount(principal.id, "account.delete", "注销账号并删除账号行");
          return responseJSON(
            { ok: true, audit: this.listAccountAudit(principal.id) },
            200,
            { "Set-Cookie": this.sessionCookie(request, "", true) },
          );
        } catch {
          return responseJSON({ error: "账号删除请求无效，请重试。" }, 400);
        }
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
              .prepare(
                "INSERT INTO workspace_accounts(id,username,salt,password_hash,created_at) VALUES(?,?,?,?,?)",
              )
              .run(
                principal.id,
                username,
                salt,
                digest,
                new Date().toISOString(),
              );
            this.revoke(request);
            this.auditAccount(principal.id, "account.register", "创建账号");
            return responseJSON({ user: this.identity(principal.id) }, 201, {
              "Set-Cookie": this.issue(request, principal.id),
            });
          }
          const account = this.db
            .prepare(
              "SELECT id,salt,password_hash,disabled FROM workspace_accounts WHERE username=?",
            )
            .get(username) as
            | { id: string; salt: string; password_hash: string; disabled: number }
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
          if (account.disabled)
            return responseJSON(
              { error: "该账号已被管理员停用，请联系管理员。" },
              403,
            );
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
