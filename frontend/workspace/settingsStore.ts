import { create } from "zustand";
import { useMemo } from "react";
import { apiJSON } from "../../apps/web/src/api/client";
import { modelOptions } from "./taskModels";

export const SETTINGS_KEY = "designbuddy.preferences.v1";
export type CustomModel = { id: string; name: string; modelId: string };
type Preferences = {
  fontSize: number;
  linkMode: "smart" | "new-tab" | "same-tab";
  models: CustomModel[];
};
const defaults: Preferences = { fontSize: 15, linkMode: "smart", models: [] };
const validModelId = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;

function readPreferences(): Preferences {
  try {
    return sanitizePreferences(JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"));
  } catch {
    return { ...defaults, models: [] };
  }
}

/** Keep only the shapes the settings screens understand. */
function sanitizePreferences(raw: unknown): Preferences {
  try {
    const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const models: CustomModel[] = [];
    if (Array.isArray(source.models))
      for (const item of source.models.slice(0, 20)) {
        if (
          !item ||
          typeof item.id !== "string" ||
          typeof item.name !== "string" ||
          typeof item.modelId !== "string"
        )
          continue;
        const name = item.name.trim().slice(0, 60),
          modelId = item.modelId.trim();
        if (
          !name ||
          !validModelId.test(modelId) ||
          modelOptions.some((option) => option.id === modelId) ||
          models.some(
            (model) => model.modelId === modelId || model.id === item.id,
          )
        )
          continue;
        models.push({ id: item.id, name, modelId });
      }
    return {
      fontSize:
        typeof source.fontSize === "number" && Number.isFinite(source.fontSize)
          ? Math.min(20, Math.max(12, Math.round(source.fontSize)))
          : defaults.fontSize,
      linkMode: ["smart", "new-tab", "same-tab"].includes(source.linkMode as string)
        ? (source.linkMode as Preferences["linkMode"])
        : "smart",
      models,
    };
  } catch {
    return { ...defaults, models: [] };
  }
}

/** The key the account preferences are stored under on the server. */
export const SYNCED_PREFERENCE_KEY = "workspace.preferences";

export type PreferenceSyncState = {
  status: "idle" | "syncing" | "synced" | "offline";
  lastSyncedAt: number | null;
  error: string;
};

/** The state of the cross-device preference sync. */
export const usePreferenceSync = create<PreferenceSyncState>(() => ({
  status: "idle",
  lastSyncedAt: null,
  error: "",
}));

let syncTimer: ReturnType<typeof setTimeout> | undefined;

/** Push the current preferences to the account. Best effort: never breaks the UI. */
export async function pushPreferencesToAccount(): Promise<void> {
  usePreferenceSync.setState({
    status: "syncing",
    lastSyncedAt: usePreferenceSync.getState().lastSyncedAt,
    error: "",
  });
  try {
    const body = await apiJSON<{ preference: { updatedAt: number } }>("/profile/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: SYNCED_PREFERENCE_KEY, value: usePreferences.getState() }),
    });
    usePreferenceSync.setState({ status: "synced", lastSyncedAt: body.preference.updatedAt, error: "" });
  } catch {
    usePreferenceSync.setState({
      status: "offline",
      lastSyncedAt: usePreferenceSync.getState().lastSyncedAt,
      error: "偏好已在本机生效，跨设备同步暂不可用（后端未连接）。",
    });
  }
}

function schedulePreferencePush() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    void pushPreferencesToAccount();
  }, 800);
}

/** Load the account preferences from the server. The server wins for known keys. */
export async function syncPreferencesFromAccount(): Promise<void> {
  usePreferenceSync.setState({
    status: "syncing",
    lastSyncedAt: usePreferenceSync.getState().lastSyncedAt,
    error: "",
  });
  try {
    const body = await apiJSON<{ preferences: { key: string; value: unknown }[] }>("/profile/preferences");
    const entry = body.preferences.find((item) => item.key === SYNCED_PREFERENCE_KEY);
    if (entry && entry.value && typeof entry.value === "object") {
      const merged = sanitizePreferences({ ...readPreferences(), ...(entry.value as Record<string, unknown>) });
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
      } catch {
        /* The local store still works without persistence. */
      }
      usePreferences.setState(merged);
    }
    usePreferenceSync.setState({ status: "synced", lastSyncedAt: Date.now(), error: "" });
  } catch {
    usePreferenceSync.setState({
      status: "offline",
      lastSyncedAt: usePreferenceSync.getState().lastSyncedAt,
      error: "未能从账号读取偏好，当前使用本机设置。",
    });
  }
}

/** Persist public preferences before updating UI. Never store API keys in this key. */
export const usePreferences = create<Preferences>(() => readPreferences());
function save(next: Preferences) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {
    throw new Error("浏览器存储不可用，配置未保存。请检查存储权限或空间。");
  }
  usePreferences.setState(next);
  schedulePreferencePush();
}
export function setFontSize(fontSize: number) {
  save({
    ...usePreferences.getState(),
    fontSize: Math.max(12, Math.min(20, Math.round(fontSize))),
  });
}
export function setLinkMode(linkMode: Preferences["linkMode"]) {
  save({ ...usePreferences.getState(), linkMode });
}
export function saveCustomModel(input: {
  id?: string;
  name: string;
  modelId: string;
}) {
  const name = input.name.trim(),
    modelId = input.modelId.trim();
  if (!name || name.length > 60) throw new Error("模型名称需为 1–60 个字符。");
  if (!validModelId.test(modelId))
    throw new Error(
      "请输入有效模型标识：支持字母、数字、点、短横线、下划线、冒号和斜线，最多 128 字符。",
    );
  const state = usePreferences.getState();
  if (
    modelOptions.some((option) => option.id === modelId) ||
    state.models.some(
      (model) =>
        model.id !== input.id &&
        (model.modelId === modelId ||
          model.name.toLocaleLowerCase() === name.toLocaleLowerCase()),
    )
  )
    throw new Error("模型名称或标识已存在。");
  if (!input.id && state.models.length >= 20)
    throw new Error("最多添加 20 个自定义模型。");
  if (input.id && !state.models.some((model) => model.id === input.id))
    throw new Error("此模型已被其他页面移除，请重新添加。");
  const model = { id: input.id || crypto.randomUUID(), name, modelId };
  const models = input.id
    ? state.models.map((item) => (item.id === input.id ? model : item))
    : [...state.models, model];
  save({ ...state, models });
}
export function removeCustomModel(id: string) {
  const state = usePreferences.getState();
  save({ ...state, models: state.models.filter((model) => model.id !== id) });
}
export function refreshPreferences() {
  usePreferences.setState(readPreferences());
}
export function useModelOptions() {
  const custom = usePreferences((state) => state.models);
  return useMemo(
    () => [
      ...modelOptions,
      ...custom.map((model) => ({
        id: model.modelId,
        name: model.name,
        icon: "custom",
        badge: "自定义",
        badgeTone: "neutral",
        cost: "",
      })),
    ],
    [custom],
  );
}

export type SettingsSection =
  | "general"
  | "profile"
  | "plan"
  | "appearance"
  | "shortcuts"
  | "personalization"
  | "memory"
  | "agents"
  | "models"
  | "assistant"
  | "devices"
  | "data"
  | "apps"
  | "security";
export const useSettingsWindow = create<{
  open: boolean;
  section: SettingsSection;
}>(() => ({ open: false, section: "general" }));
let returnFocus: HTMLElement | null = null;
export function openSettings(
  section: SettingsSection = "general",
  anchor?: HTMLElement | null,
) {
  returnFocus =
    anchor ||
    (document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null);
  useSettingsWindow.setState({ open: true, section });
}
export function closeSettings() {
  useSettingsWindow.setState({ open: false });
  const target = returnFocus;
  requestAnimationFrame(() => {
    if (target?.isConnected) target.focus({ preventScroll: true });
  });
}
