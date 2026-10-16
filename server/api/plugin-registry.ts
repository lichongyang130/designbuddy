import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { responseJSON, sameOrigin } from "./workspace-backend";
import { runtimeCatalog } from "../skills/runtime-catalog";

/**
 * Plugin lifecycle on the server.
 *
 * A plugin here is a *bundle of already registered skills* plus the permissions
 * and requirements it declares. Installing a bundle records it for the signed
 * in identity; enabling, disabling and uninstalling are real state changes
 * that are persisted and logged.
 *
 * What this deliberately does not do: it does not run third-party code, and it
 * does not grant any permission beyond what the bundled skills already enforce
 * on the server. A disabled bundle only disappears from the plugin panel — its
 * skills stay in the skill catalogue, because the skill registry is the place
 * where execution rights are decided.
 */
export type PluginBundle = {
  id: string;
  name: string;
  version: string;
  description: string;
  skills: string[];
  permissions: string[];
  requires: string[];
};

export type InstalledPlugin = {
  id: string;
  ownerId: string;
  name: string;
  version: string;
  description: string;
  skills: string[];
  permissions: string[];
  requires: string[];
  status: "enabled" | "disabled";
  installedAt: number;
  updatedAt: number;
};

export type PluginEvent = {
  id: string;
  ownerId: string;
  pluginId: string;
  action: "installed" | "enabled" | "disabled" | "uninstalled";
  detail: string;
  createdAt: number;
};

const MAX_SKILLS = 12;
const MAX_PERMISSIONS = 8;

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function list(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === "string" && item.trim())
    .map((item) => item.trim())
    .slice(0, max);
}

/** Read the bundles that the server is willing to install. */
export function loadBundles(file = resolve(process.cwd(), "server/plugins/bundles.json")): PluginBundle[] {
  const raw = JSON.parse(readFileSync(file, "utf8")) as { bundles?: unknown };
  const bundles: PluginBundle[] = [];
  for (const entry of Array.isArray(raw.bundles) ? raw.bundles : []) {
    const value = entry as Record<string, unknown>;
    const id = text(value.id, 60);
    const name = text(value.name, 80);
    const version = text(value.version, 20);
    const skills = list(value.skills, MAX_SKILLS);
    if (!/^[a-z0-9][a-z0-9-]{2,59}$/.test(id) || !name || !/^\d+\.\d+\.\d+$/.test(version) || !skills.length) continue;
    bundles.push({
      id,
      name,
      version,
      description: text(value.description, 400),
      skills,
      permissions: list(value.permissions, MAX_PERMISSIONS),
      requires: list(value.requires, MAX_PERMISSIONS),
    });
  }
  return bundles;
}

export class PluginRegistry {
  private db: DatabaseSync;
  private bundles: PluginBundle[];

  constructor(file = process.env.DESIGNBUDDY_PLUGINS_SQLITE_PATH || "./data/plugins.sqlite", bundles?: PluginBundle[]) {
    const path = resolve(file);
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
   CREATE TABLE IF NOT EXISTS installed_plugins(id TEXT NOT NULL,owner_id TEXT NOT NULL,name TEXT NOT NULL,version TEXT NOT NULL,description TEXT NOT NULL,skills TEXT NOT NULL,permissions TEXT NOT NULL,requires TEXT NOT NULL,status TEXT NOT NULL,installed_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,PRIMARY KEY(id,owner_id));
   CREATE TABLE IF NOT EXISTS plugin_events(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,plugin_id TEXT NOT NULL,action TEXT NOT NULL,detail TEXT NOT NULL,created_at INTEGER NOT NULL);`);
    this.bundles = bundles ?? loadBundles();
  }

  close() {
    this.db.close();
  }

  /** Bundles the server offers, with the install state of this identity. */
  list(ownerId: string): { bundles: (PluginBundle & { installed: boolean; status: string })[]; installed: InstalledPlugin[] } {
    const installed = this.listInstalled(ownerId);
    const state = new Map(installed.map((item) => [item.id, item.status]));
    return {
      bundles: this.bundles.map((bundle) => ({ ...bundle, installed: state.has(bundle.id), status: state.get(bundle.id) || "" })),
      installed,
    };
  }

  private row(value: Record<string, unknown>): InstalledPlugin {
    const parse = (raw: unknown) => {
      try {
        const parsed = JSON.parse(String(raw || "[]"));
        return Array.isArray(parsed) ? parsed.map(String) : [];
      } catch {
        return [];
      }
    };
    return {
      id: String(value.id),
      ownerId: String(value.owner_id),
      name: String(value.name),
      version: String(value.version),
      description: String(value.description),
      skills: parse(value.skills),
      permissions: parse(value.permissions),
      requires: parse(value.requires),
      status: value.status === "disabled" ? "disabled" : "enabled",
      installedAt: Number(value.installed_at),
      updatedAt: Number(value.updated_at),
    };
  }

  listInstalled(ownerId: string): InstalledPlugin[] {
    const rows = this.db.prepare("SELECT * FROM installed_plugins WHERE owner_id=? ORDER BY installed_at DESC").all(ownerId) as Record<string, unknown>[];
    return rows.map((row) => this.row(row));
  }

  listEvents(ownerId: string, limit = 50): PluginEvent[] {
    const rows = this.db.prepare("SELECT * FROM plugin_events WHERE owner_id=? ORDER BY created_at DESC LIMIT ?").all(ownerId, limit) as Record<string, unknown>[];
    return rows.map((row) => ({
      id: String(row.id),
      ownerId: String(row.owner_id),
      pluginId: String(row.plugin_id),
      action: row.action as PluginEvent["action"],
      detail: String(row.detail),
      createdAt: Number(row.created_at),
    }));
  }

  private log(ownerId: string, pluginId: string, action: PluginEvent["action"], detail: string) {
    this.db
      .prepare("INSERT INTO plugin_events(id,owner_id,plugin_id,action,detail,created_at) VALUES(?,?,?,?,?,?)")
      .run(randomUUID(), ownerId, pluginId, action, detail, Date.now());
  }

  /**
   * Install a bundle. Every skill the bundle names must exist in the real
   * skill registry, otherwise the install is refused with the reason.
   */
  install(ownerId: string, bundleId: string): { ok: true; plugin: InstalledPlugin } | { ok: false; error: string } {
    const bundle = this.bundles.find((item) => item.id === bundleId);
    if (!bundle) return { ok: false, error: "没有这个插件包，服务端未登记该清单。" };
    const catalogue = runtimeCatalog();
    const known = new Set(catalogue.filter((skill) => skill.status === "ready").map((skill) => skill.id));
    const missing = bundle.skills.filter((skill) => !known.has(skill));
    if (missing.length) return { ok: false, error: `插件包引用了服务端不存在的技能：${missing.join("、")}。` };
    const now = Date.now();
    this.db
      .prepare(`INSERT INTO installed_plugins(id,owner_id,name,version,description,skills,permissions,requires,status,installed_at,updated_at)
       VALUES(?,?,?,?,?,?,?,?,'enabled',?,?)
       ON CONFLICT(id,owner_id) DO UPDATE SET name=excluded.name,version=excluded.version,description=excluded.description,skills=excluded.skills,permissions=excluded.permissions,requires=excluded.requires,status='enabled',updated_at=excluded.updated_at`)
      .run(bundle.id, ownerId, bundle.name, bundle.version, bundle.description, JSON.stringify(bundle.skills), JSON.stringify(bundle.permissions), JSON.stringify(bundle.requires), now, now);
    this.log(ownerId, bundle.id, "installed", `已安装 ${bundle.name} ${bundle.version}，包含 ${bundle.skills.length} 个已注册技能。`);
    const plugin = this.listInstalled(ownerId).find((item) => item.id === bundle.id);
    return plugin ? { ok: true, plugin } : { ok: false, error: "安装后没有读到记录。" };
  }

  setStatus(ownerId: string, pluginId: string, status: "enabled" | "disabled"): { ok: true; plugin: InstalledPlugin } | { ok: false; error: string } {
    const existing = this.listInstalled(ownerId).find((item) => item.id === pluginId);
    if (!existing) return { ok: false, error: "这个插件包没有安装，或不属于当前身份。" };
    const now = Date.now();
    this.db.prepare("UPDATE installed_plugins SET status=?,updated_at=? WHERE id=? AND owner_id=?").run(status, now, pluginId, ownerId);
    this.log(ownerId, pluginId, status === "enabled" ? "enabled" : "disabled", status === "enabled" ? "已重新启用。" : "已停用：不再出现在插件面板，技能目录不受影响。");
    const plugin = this.listInstalled(ownerId).find((item) => item.id === pluginId);
    return plugin ? { ok: true, plugin } : { ok: false, error: "更新后没有读到记录。" };
  }

  uninstall(ownerId: string, pluginId: string): { ok: true } | { ok: false; error: string } {
    const existing = this.listInstalled(ownerId).find((item) => item.id === pluginId);
    if (!existing) return { ok: false, error: "这个插件包没有安装，或不属于当前身份。" };
    this.db.prepare("DELETE FROM installed_plugins WHERE id=? AND owner_id=?").run(pluginId, ownerId);
    this.log(ownerId, pluginId, "uninstalled", "已卸载。技能目录中的技能不受影响。");
    return { ok: true };
  }

  async handle(request: Request, ownerId: string): Promise<Response | null> {
    const url = new URL(request.url);
    const path = url.pathname;
    if (!path.startsWith("/api/plugins")) return null;
    if (!["GET", "HEAD"].includes(request.method) && !sameOrigin(request))
      return responseJSON({ error: "跨站修改请求已拒绝。" }, 403);
    try {
      if (path === "/api/plugins" && request.method === "GET")
        return responseJSON(this.list(ownerId));
      if (path === "/api/plugins/events" && request.method === "GET")
        return responseJSON({ events: this.listEvents(ownerId) });
      if (path === "/api/plugins/install" && request.method === "POST") {
        const body = (await request.json()) as Record<string, unknown>;
        const result = this.install(ownerId, text(body.id, 60));
        return result.ok ? responseJSON({ plugin: result.plugin }) : responseJSON({ error: result.error }, 400);
      }
      const statusMatch = /^\/api\/plugins\/([A-Za-z0-9-]{1,60})\/status$/.exec(path);
      if (statusMatch && request.method === "POST") {
        const body = (await request.json()) as Record<string, unknown>;
        const status = body.status === "disabled" ? "disabled" : "enabled";
        const result = this.setStatus(ownerId, statusMatch[1], status);
        return result.ok ? responseJSON({ plugin: result.plugin }) : responseJSON({ error: result.error }, 400);
      }
      const pluginMatch = /^\/api\/plugins\/([A-Za-z0-9-]{1,60})$/.exec(path);
      if (pluginMatch && request.method === "DELETE") {
        const result = this.uninstall(ownerId, pluginMatch[1]);
        return result.ok ? responseJSON({ ok: true }) : responseJSON({ error: result.error }, 400);
      }
      return responseJSON({ error: "未找到该接口。" }, 404);
    } catch (error) {
      return responseJSON({ error: error instanceof Error ? error.message.slice(0, 300) : "插件接口出错。" }, 500);
    }
  }
}
