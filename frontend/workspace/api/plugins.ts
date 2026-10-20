import { apiFetch, apiJSON } from "../../../apps/web/src/api/client";
import type { SkillPermission } from "../../../shared/skillRuntime";

/** A plugin bundle the server is willing to install. */
export type PluginBundle = {
  id: string;
  name: string;
  version: string;
  apiVersion: string;
  description: string;
  skills: string[];
  permissions: SkillPermission[];
  requires: string[];
  installed: boolean;
  status: string;
  /** Whether this server can run the bundle, and why not when it cannot. */
  compatible: boolean;
  compatibleReason: string;
};

export type InstalledPlugin = {
  id: string;
  name: string;
  version: string;
  apiVersion: string;
  description: string;
  skills: string[];
  skillVersions: string[];
  permissions: SkillPermission[];
  requires: string[];
  status: "enabled" | "disabled";
  installedAt: number;
  updatedAt: number;
};

export type PluginEvent = {
  id: string;
  pluginId: string;
  action: "installed" | "enabled" | "disabled" | "uninstalled";
  detail: string;
  createdAt: number;
};

/**
 * The homepage rail caches the enabled bundles for a minute so re-entering home
 * is free. Any lifecycle change has to drop that cache, otherwise the rail
 * shows a bundle the person just disabled.
 */
function invalidateHomeRailCache() {
  try { sessionStorage.removeItem("designbuddy.home.plugins.v1"); } catch { /* storage disabled */ }
}

export async function fetchPluginBundles(): Promise<{ bundles: PluginBundle[]; installed: InstalledPlugin[]; apiVersion: string }> {
  const body = await apiJSON<{ bundles?: PluginBundle[]; installed?: InstalledPlugin[]; apiVersion?: string }>("/plugins");
  return {
    bundles: Array.isArray(body.bundles) ? body.bundles : [],
    installed: Array.isArray(body.installed) ? body.installed : [],
    apiVersion: body.apiVersion ?? "1.0",
  };
}

export async function installPluginBundle(id: string): Promise<InstalledPlugin> {
  const body = await apiJSON<{ plugin: InstalledPlugin }>("/plugins/install", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  invalidateHomeRailCache();
  return body.plugin;
}

export async function setPluginBundleStatus(id: string, status: "enabled" | "disabled"): Promise<InstalledPlugin> {
  const body = await apiJSON<{ plugin: InstalledPlugin }>(`/plugins/${encodeURIComponent(id)}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  invalidateHomeRailCache();
  return body.plugin;
}

export async function uninstallPluginBundle(id: string): Promise<void> {
  await apiFetch(`/plugins/${encodeURIComponent(id)}`, { method: "DELETE" });
  invalidateHomeRailCache();
}

export async function fetchPluginEvents(): Promise<PluginEvent[]> {
  const body = await apiJSON<{ events?: PluginEvent[] }>("/plugins/events");
  return Array.isArray(body.events) ? body.events : [];
}

/** The homepage projection: enabled bundles only, with per-skill readiness. */
export type HomePluginSkill = {
  id: string;
  name: string;
  status: "ready" | "unavailable";
  accepts: string[];
  outputs: string[];
  requires: { kind: string; label: string; detail: string }[];
  permissions: SkillPermission[];
  unavailableReason: string;
};

export type HomePluginBundle = {
  id: string;
  name: string;
  description: string;
  skills: HomePluginSkill[];
  requires: string[];
  enabled: boolean;
  readySkills: number;
  blockedSkills: number;
};

export type HomePlugins = {
  apiVersion: string;
  bundles: HomePluginBundle[];
  totals: { enabled: number; readySkills: number; blockedSkills: number };
};

/**
 * Fast path for the homepage: only installed + enabled bundles, so the first
 * paint never waits for the 480-item catalogue or the full bundle list.
 */
export async function fetchHomePlugins(): Promise<HomePlugins> {
  const body = await apiJSON<Partial<HomePlugins>>("/plugins?scope=home");
  const bundles = Array.isArray(body.bundles) ? body.bundles : [];
  return {
    apiVersion: body.apiVersion ?? "1.0",
    bundles,
    totals: body.totals ?? {
      enabled: bundles.length,
      readySkills: bundles.reduce((total, bundle) => total + (bundle.readySkills ?? 0), 0),
      blockedSkills: bundles.reduce((total, bundle) => total + (bundle.blockedSkills ?? 0), 0),
    },
  };
}
