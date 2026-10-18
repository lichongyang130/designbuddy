import { SETTINGS_KEY, refreshPreferences, usePreferences } from "./settingsStore";
import { translate } from "./i18n";

/**
 * Local-data inventory, backup and restore.
 * The auth token is never listed, exported or cleared here.
 */
const AUTH_KEYS = ["designbuddy.auth-token.v1"];

export type DataGroup = {
  id: string;
  labelKey: string;
  hintKey: string;
  prefixes: string[];
};

export const DATA_GROUPS: DataGroup[] = [
  {
    id: "settings",
    labelKey: "settings.data.group.settings",
    hintKey: "settings.data.group.settings.hint",
    prefixes: [SETTINGS_KEY],
  },
  {
    id: "projects",
    labelKey: "settings.data.group.projects",
    hintKey: "settings.data.group.projects.hint",
    prefixes: [
      "designbuddy.projects.v1",
      "designbuddy.project-base-versions.v1",
      "designbuddy.scene-workspace.v1.",
      "designbuddy.studio.artifacts.v1",
      "designbuddy.forme.versions.",
      "designbuddy.atelier.versions.",
    ],
  },
  {
    id: "conversations",
    labelKey: "settings.data.group.conversations",
    hintKey: "settings.data.group.conversations.hint",
    prefixes: [
      "designbuddy.conversation.v1.",
      "designbuddy.conversation.pending.",
      "designbuddy.generate-on-open.",
    ],
  },
  {
    id: "templates",
    labelKey: "settings.data.group.templates",
    hintKey: "settings.data.group.templates.hint",
    prefixes: ["designbuddy.samples.v2.", "designbuddy.samples.drafts.v2"],
  },
  {
    id: "workspace",
    labelKey: "settings.data.group.workspace",
    hintKey: "settings.data.group.workspace.hint",
    prefixes: [
      "designbuddy.workspace.v1",
      "designbuddy.active-workspace.v1",
      "designbuddy.review.",
      "designbuddy.notifications.v1",
      "designbuddy.skill-favorites.v1",
      "designbuddy.prompt-recommendations.v1",
      "designbuddy.feedback-draft.v1",
      "designbuddy.launch-context.v1",
      "designbuddy.expert-match-consent.v1",
    ],
  },
];

const groupOf = (key: string): DataGroup | null => {
  if (AUTH_KEYS.includes(key)) return null;
  return DATA_GROUPS.find((group) => group.prefixes.some((prefix) => key.startsWith(prefix))) || null;
};

export type InventoryRow = { group: DataGroup; keys: number; bytes: number };

export function storageInventory(): { rows: InventoryRow[]; totalKeys: number; totalBytes: number; otherKeys: number; otherBytes: number } {
  const rows: InventoryRow[] = DATA_GROUPS.map((group) => ({ group, keys: 0, bytes: 0 }));
  let totalKeys = 0;
  let totalBytes = 0;
  let otherKeys = 0;
  let otherBytes = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || AUTH_KEYS.includes(key)) continue;
    const bytes = (localStorage.getItem(key) || "").length * 2;
    totalKeys += 1;
    totalBytes += bytes;
    const row = rows.find((item) => item.group.prefixes.some((prefix) => key.startsWith(prefix)));
    if (row) {
      row.keys += 1;
      row.bytes += bytes;
    } else {
      otherKeys += 1;
      otherBytes += bytes;
    }
  }
  return { rows, totalKeys, totalBytes, otherKeys, otherBytes };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function saveFile(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
};

type BackupFile = {
  app: "designbuddy";
  scope: "all" | "settings";
  version: 1;
  exportedAt: string;
  entries: { key: string; value: string }[];
};

/** Full local backup. Secrets and the auth token are never included. */
export function exportAllData(): number {
  const entries: BackupFile["entries"] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || AUTH_KEYS.includes(key)) continue;
    entries.push({ key, value: localStorage.getItem(key) || "" });
  }
  const file: BackupFile = { app: "designbuddy", scope: "all", version: 1, exportedAt: new Date().toISOString(), entries };
  saveFile(`designbuddy-backup-${stamp()}.json`, JSON.stringify(file));
  return entries.length;
}

/** Settings-only migration file: the 14 sections' preferences in one file. */
export function exportSettings(): void {
  const file: BackupFile = {
    app: "designbuddy",
    scope: "settings",
    version: 1,
    exportedAt: new Date().toISOString(),
    entries: [{ key: SETTINGS_KEY, value: localStorage.getItem(SETTINGS_KEY) || "{}" }],
  };
  saveFile(`designbuddy-settings-${stamp()}.json`, JSON.stringify(file));
}

function transferError(key: string, params?: Record<string, string | number>): Error {
  return new Error(translate(usePreferences.getState().locale, key, params));
}

function parseBackup(text: string, scope: "all" | "settings"): BackupFile["entries"] {
  const file = JSON.parse(text) as Partial<BackupFile>;
  if (!file || file.app !== "designbuddy" || file.scope !== scope || !Array.isArray(file.entries)) {
    throw transferError(scope === "all" ? "settings.xfer.badFileAll" : "settings.xfer.badFileSettings");
  }
  const entries = file.entries.filter(
    (entry): entry is { key: string; value: string } =>
      !!entry && typeof entry.key === "string" && typeof entry.value === "string" && !AUTH_KEYS.includes(entry.key),
  );
  if (entries.length === 0) throw transferError("settings.xfer.empty");
  const bytes = entries.reduce((sum, entry) => sum + entry.key.length + entry.value.length, 0);
  if (bytes > 8 * 1024 * 1024) throw transferError("settings.xfer.tooBig8");
  if (scope === "settings" && !entries.some((entry) => entry.key === SETTINGS_KEY)) {
    throw transferError("settings.xfer.noPrefs");
  }
  return entries;
}

async function readFile(file: File): Promise<string> {
  if (file.size > 10 * 1024 * 1024) throw transferError("settings.xfer.tooBig10");
  return file.text();
}

/** Restore a full backup. Returns the restored entry count. */
export async function importAllData(file: File): Promise<number> {
  const entries = parseBackup(await readFile(file), "all");
  for (const entry of entries) {
    try {
      localStorage.setItem(entry.key, entry.value);
    } catch {
      throw transferError("settings.xfer.writeKey", { key: entry.key });
    }
  }
  refreshPreferences();
  return entries.length;
}

/** Restore a settings migration file. */
export async function importSettings(file: File): Promise<void> {
  const entries = parseBackup(await readFile(file), "settings");
  for (const entry of entries) {
    try {
      localStorage.setItem(entry.key, entry.value);
    } catch {
      throw transferError("settings.xfer.writeFail");
    }
  }
  refreshPreferences();
}

/** Remove one data group (or everything except the auth token). Returns removed key count. */
export function clearDataGroup(groupId: string): number {
  const groups = groupId === "all" ? DATA_GROUPS : DATA_GROUPS.filter((group) => group.id === groupId);
  if (groups.length === 0) throw transferError("settings.xfer.unknownGroup");
  const victims: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || AUTH_KEYS.includes(key)) continue;
    if (groupId === "all" || groups.some((group) => group.prefixes.some((prefix) => key.startsWith(prefix)))) {
      victims.push(key);
    }
  }
  for (const key of victims) localStorage.removeItem(key);
  if (groupId === "all" || groupId === "settings") refreshPreferences();
  return victims.length;
}

function parseArrayLength(key: string): number {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value.length : 0;
  } catch {
    return 0;
  }
}

/** Honest local usage numbers for the plan section. No server involved. */
export function usageStats(): {
  projects: number;
  conversations: number;
  templateDrafts: number;
  templateStates: number;
  customModels: number;
  storageBytes: number;
} {
  let conversations = 0;
  let templateStates = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i) || "";
    if (key.startsWith("designbuddy.conversation.v1.")) conversations += 1;
    if (key.startsWith("designbuddy.samples.v2.")) templateStates += 1;
  }
  let customModels = 0;
  try {
    const prefs = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") as { models?: unknown[] };
    customModels = Array.isArray(prefs.models) ? prefs.models.length : 0;
  } catch {
    customModels = 0;
  }
  return {
    projects: parseArrayLength("designbuddy.projects.v1"),
    conversations,
    templateDrafts: parseArrayLength("designbuddy.samples.drafts.v2"),
    templateStates,
    customModels,
    storageBytes: storageInventory().totalBytes,
  };
}
