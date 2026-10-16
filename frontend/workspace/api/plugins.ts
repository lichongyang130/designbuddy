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
  return body.plugin;
}

export async function setPluginBundleStatus(id: string, status: "enabled" | "disabled"): Promise<InstalledPlugin> {
  const body = await apiJSON<{ plugin: InstalledPlugin }>(`/plugins/${encodeURIComponent(id)}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  return body.plugin;
}

export async function uninstallPluginBundle(id: string): Promise<void> {
  await apiFetch(`/plugins/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function fetchPluginEvents(): Promise<PluginEvent[]> {
  const body = await apiJSON<{ events?: PluginEvent[] }>("/plugins/events");
  return Array.isArray(body.events) ? body.events : [];
}
