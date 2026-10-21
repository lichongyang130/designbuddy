import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { responseJSON, sameOrigin } from "./workspace-backend";
import { runtimeCatalog } from "../skills/runtime-catalog";
import { skillPermissions } from "../skills/skill-permissions";
import { skillPermissionLabels, type SkillPermission } from "../../shared/skillRuntime";

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
  /** The plugin interface version this bundle needs. */
  apiVersion: string;
  description: string;
  skills: string[];
  /** The tool permissions the bundle needs, in the same vocabulary as the skills. */
  permissions: SkillPermission[];
  requires: string[];
};

/** The plugin interface this server speaks. A bundle must ask for a compatible major. */
export const PLUGIN_API_VERSION = "1.0";
const permissionNames = Object.keys(skillPermissionLabels) as SkillPermission[];

export type InstalledPlugin = {
  id: string;
  ownerId: string;
  name: string;
  version: string;
  apiVersion: string;
  description: string;
  skills: string[];
  /** The skill versions that were resolved when the bundle was installed. */
  skillVersions: string[];
  permissions: SkillPermission[];
  requires: string[];
  status: "enabled" | "disabled";
  installedAt: number;
  updatedAt: number;
};

/** The tiny payload the homepage needs: enabled bundles, their first runnable skill, and what each skill still requires. */
export type HomePluginSkill = {
  id: string;
  name: string;
  status: "ready" | "unavailable";
  accepts: string[];
  outputs: string[];
  /** What the person must provide before this skill can run, with the server's own explanation. */
  requires: { kind: string; label: string; detail: string }[];
  permissions: SkillPermission[];
  /** The server's own words for why an unavailable skill is unavailable. */
  unavailableReason: string;
};

export type HomePluginBundle = {
  id: string;
  name: string;
  description: string;
  skills: HomePluginSkill[];
  requires: string[];
  enabled: boolean;
  /** Skills that can run right now, versus the ones the server would refuse. */
  readySkills: number;
  blockedSkills: number;
};

export type HomePlugins = {
  apiVersion: string;
  bundles: HomePluginBundle[];
  totals: { enabled: number; readySkills: number; blockedSkills: number };
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
    const apiVersion = text(value.apiVersion, 20) || PLUGIN_API_VERSION;
    if (!/^[a-z0-9][a-z0-9-]{2,59}$/.test(id) || !name || !/^\d+\.\d+\.\d+$/.test(version) || !skills.length) continue;
    if (!/^\d+\.\d+$/.test(apiVersion)) continue;
    const permissions = list(value.permissions, MAX_PERMISSIONS).filter(
      (permission): permission is SkillPermission =>
        permissionNames.includes(permission as SkillPermission),
    );
    bundles.push({
      id,
      name,
      version,
      apiVersion,
      description: text(value.description, 400),
      skills,
      permissions,
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
    // Older databases were created before the plugin interface version was tracked.
    const columns = this.db.prepare("PRAGMA table_info(installed_plugins)").all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === "api_version"))
      this.db.exec("ALTER TABLE installed_plugins ADD COLUMN api_version TEXT NOT NULL DEFAULT '1.0'");
    if (!columns.some((column) => column.name === "skill_versions"))
      this.db.exec("ALTER TABLE installed_plugins ADD COLUMN skill_versions TEXT NOT NULL DEFAULT '[]'");
    this.bundles = (bundles ?? loadBundles()).map((bundle) => ({
      ...bundle,
      apiVersion: bundle.apiVersion || PLUGIN_API_VERSION,
    }));
  }

  close() {
    this.db.close();
  }

  /** Bundles the server offers, with the install state of this identity. */
  list(ownerId: string): { bundles: (PluginBundle & { installed: boolean; status: string; compatible: boolean; compatibleReason: string })[]; installed: InstalledPlugin[]; apiVersion: string } {
    const installed = this.listInstalled(ownerId);
    const state = new Map(installed.map((item) => [item.id, item.status]));
    return {
      apiVersion: PLUGIN_API_VERSION,
      bundles: this.bundles.map((bundle) => {
        const compatibility = this.compatibility(bundle);
        return { ...bundle, installed: state.has(bundle.id), status: state.get(bundle.id) || "", ...compatibility };
      }),
      installed,
    };
  }

  /** Whether this server can run the bundle: the interface version and the declared rights. */
  compatibility(bundle: PluginBundle): { compatible: boolean; compatibleReason: string } {
    const wanted = (bundle.apiVersion || PLUGIN_API_VERSION).split(".")[0];
    const supported = PLUGIN_API_VERSION.split(".")[0];
    if (wanted !== supported)
      return { compatible: false, compatibleReason: `插件包要求插件接口 ${bundle.apiVersion}，当前服务端只支持 ${PLUGIN_API_VERSION}。` };
    const catalogue = runtimeCatalog();
    const known = new Map(catalogue.map((skill) => [skill.id, skill]));
    const missing = bundle.skills.filter((skill) => !known.has(skill));
    if (missing.length)
      return { compatible: false, compatibleReason: `插件包引用了服务端不存在的技能：${missing.join("、")}。` };
    const notReady = bundle.skills.filter((skill) => known.get(skill)!.status !== "ready");
    if (notReady.length)
      return { compatible: false, compatibleReason: `插件包引用了服务端尚未就绪的技能：${notReady.join("、")}。` };
    const needed = new Set<SkillPermission>();
    for (const skill of bundle.skills) for (const permission of skillPermissions(skill)) needed.add(permission);
    const declared = new Set(bundle.permissions);
    const notGranted = [...needed].filter((permission) => !declared.has(permission));
    if (notGranted.length)
      return { compatible: false, compatibleReason: `插件包没有声明它需要的权限：${notGranted.map((permission) => skillPermissionLabels[permission]).join("、")}。` };
    const extra = [...declared].filter((permission) => !needed.has(permission));
    if (extra.length)
      return { compatible: false, compatibleReason: `插件包声明了它的技能并不会使用的权限：${extra.map((permission) => skillPermissionLabels[permission]).join("、")}。` };
    return { compatible: true, compatibleReason: `插件接口 ${bundle.apiVersion} 与服务端一致，权限声明与实际技能一致。` };
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
      apiVersion: String(value.api_version || PLUGIN_API_VERSION),
      description: String(value.description),
      skills: parse(value.skills),
      skillVersions: parse(value.skill_versions),
      permissions: parse(value.permissions) as SkillPermission[],
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
    const compatibility = this.compatibility(bundle);
    if (!compatibility.compatible) return { ok: false, error: compatibility.compatibleReason };
    const catalogue = runtimeCatalog();
    const known = new Map(catalogue.map((skill) => [skill.id, skill]));
    const skillVersions = bundle.skills.map((skill) => `${skill}@${known.get(skill)?.version ?? "?"}`);
    const now = Date.now();
    this.db
      .prepare(`INSERT INTO installed_plugins(id,owner_id,name,version,api_version,description,skills,skill_versions,permissions,requires,status,installed_at,updated_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,'enabled',?,?)
       ON CONFLICT(id,owner_id) DO UPDATE SET name=excluded.name,version=excluded.version,api_version=excluded.api_version,description=excluded.description,skills=excluded.skills,skill_versions=excluded.skill_versions,permissions=excluded.permissions,requires=excluded.requires,status='enabled',updated_at=excluded.updated_at`)
      .run(bundle.id, ownerId, bundle.name, bundle.version, bundle.apiVersion, bundle.description, JSON.stringify(bundle.skills), JSON.stringify(skillVersions), JSON.stringify(bundle.permissions), JSON.stringify(bundle.requires), now, now);
    this.log(ownerId, bundle.id, "installed", `已安装 ${bundle.name} ${bundle.version}（插件接口 ${bundle.apiVersion}），包含 ${bundle.skills.length} 个已注册技能：${skillVersions.join("、")}。`);
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

  /**
   * Homepage projection.
   *
   * The homepage must never download the full catalogue of 480 plugins just to
   * paint four chips, so this returns only what is installed *and* enabled plus
   * the readiness of each bundled skill. The full list stays on /plugins.
   */
  home(ownerId: string): HomePlugins {
    const installed = this.listInstalled(ownerId).filter((plugin) => plugin.status === "enabled");
    const catalogue = runtimeCatalog();
    const known = new Map(catalogue.map((skill) => [skill.id, skill]));
    const bundles: HomePluginBundle[] = installed.map((plugin) => {
      const skills: HomePluginSkill[] = plugin.skills.map((id) => {
        const skill = known.get(id);
        return {
          id,
          name: skill?.name ?? id,
          status: skill?.status === "ready" ? "ready" : "unavailable",
          accepts: skill?.accepts ?? [],
          outputs: skill?.outputs ?? [],
          requires: (skill?.requires ?? []).map((requirement) => ({ kind: requirement.kind, label: requirement.label, detail: requirement.detail })),
          permissions: skill?.permissions ?? [],
          // Only an unavailable skill carries a reason; for a ready skill the
          // description is a capability statement, not an error.
          unavailableReason: skill && skill.status !== "ready" ? skill.description : "",
        };
      });
      const readySkills = skills.filter((skill) => skill.status === "ready").length;
      return {
        id: plugin.id,
        name: plugin.name,
        description: plugin.description,
        skills,
        requires: plugin.requires,
        enabled: true,
        readySkills,
        blockedSkills: skills.length - readySkills,
      };
    });
    return {
      apiVersion: PLUGIN_API_VERSION,
      bundles,
      totals: {
        enabled: bundles.length,
        readySkills: bundles.reduce((total, bundle) => total + bundle.readySkills, 0),
        blockedSkills: bundles.reduce((total, bundle) => total + bundle.blockedSkills, 0),
      },
    };
  }

  async handle(request: Request, ownerId: string): Promise<Response | null> {
    const url = new URL(request.url);
    const path = url.pathname;
    if (!path.startsWith("/api/plugins")) return null;
    if (!["GET", "HEAD"].includes(request.method) && !sameOrigin(request))
      return responseJSON({ error: "跨站修改请求已拒绝。" }, 403);
    try {
      if (path === "/api/plugins" && request.method === "GET") {
        // ?scope=home keeps the homepage payload small: enabled bundles only.
        if (url.searchParams.get("scope") === "home") return responseJSON(this.home(ownerId));
        return responseJSON(this.list(ownerId));
      }
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
