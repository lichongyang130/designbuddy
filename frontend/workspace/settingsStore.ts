import { create } from "zustand";
import { useMemo } from "react";
import { apiJSON } from "../../apps/web/src/api/client";
import { modelOptions } from "./taskModels";
import { translate } from "./i18n";
import { isLocale, type Locale } from "./locales";
import { removeCustomModelApiKey } from "./aiProviderStorage";
export type { Locale } from "./locales";

export const SETTINGS_KEY = "designbuddy.preferences.v1";
export type ModelCapabilities = {
  tools: boolean;
  images: boolean;
  reasoning: boolean;
  customProtocol: boolean;
};
export type CustomModel = {
  id: string;
  name: string;
  modelId: string;
  provider?: string;
  baseUrl?: string;
  inputTokens?: number;
  outputTokens?: number;
  capabilities?: ModelCapabilities;
};
export type ThemeMode = "system" | "light" | "dark";
export type DensityMode = "comfortable" | "compact";
export type ComposerMode = "office" | "code" | "design";
export type KeybindingAction =
  | "open-settings"
  | "send-task"
  | "go-home"
  | "focus-composer"
  | "go-templates";
export const KEYBINDING_ACTIONS: { id: KeybindingAction; labelKey: string; hintKey: string }[] = [
  { id: "open-settings", labelKey: "settings.shortcuts.action.open-settings", hintKey: "settings.shortcuts.hint.open-settings" },
  { id: "send-task", labelKey: "settings.shortcuts.action.send-task", hintKey: "settings.shortcuts.hint.send-task" },
  { id: "go-home", labelKey: "settings.shortcuts.action.go-home", hintKey: "settings.shortcuts.hint.go-home" },
  { id: "focus-composer", labelKey: "settings.shortcuts.action.focus-composer", hintKey: "settings.shortcuts.hint.focus-composer" },
  { id: "go-templates", labelKey: "settings.shortcuts.action.go-templates", hintKey: "settings.shortcuts.hint.go-templates" },
];
export const DEFAULT_KEYBINDINGS: Record<KeybindingAction, string> = {
  "open-settings": "mod+,",
  "send-task": "mod+enter",
  "go-home": "mod+.",
  "focus-composer": "mod+/",
  "go-templates": "mod+u",
};
type Preferences = {
  fontSize: number;
  linkMode: "smart" | "new-tab" | "same-tab";
  models: CustomModel[];
  locale: Locale;
  wakeLock: boolean;
  theme: ThemeMode;
  density: DensityMode;
  defaultModel: string;
  defaultMode: ComposerMode;
  defaultWorkspace: string;
  defaultPermission: string;
  homeScenes: string[];
  keybindings: Record<KeybindingAction, string>;
};
export const DEFAULT_HOME_SCENES = ["doc", "finance", "data-viz", "desk", "slides", "website"];
const defaults: Preferences = {
  fontSize: 15,
  linkMode: "smart",
  models: [],
  locale: "zh-CN",
  wakeLock: false,
  theme: "system",
  density: "comfortable",
  defaultModel: "",
  defaultMode: "office",
  defaultWorkspace: "",
  defaultPermission: "",
  homeScenes: [...DEFAULT_HOME_SCENES],
  keybindings: { ...DEFAULT_KEYBINDINGS },
};
const validModelId = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const validBinding = /^(mod\+)?(alt\+)?(shift\+)?[a-z0-9,./;'[\]\\\-=]$|^(mod\+)?(alt\+)?(shift\+)?(enter|space|tab|up|down|left|right)$/;

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
        const provider = ["custom", "openai", "openrouter", "deepseek", "groq", "mistral", "google"].includes(item.provider)
          ? item.provider as string
          : undefined;
        const baseUrl = typeof item.baseUrl === "string" && item.baseUrl.length <= 2048
          ? (() => {
              try {
                const url = new URL(item.baseUrl.trim());
                return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash
                  ? item.baseUrl.trim()
                  : undefined;
              } catch { return undefined; }
            })()
          : undefined;
        const capabilitiesValue = item.capabilities && typeof item.capabilities === "object"
          ? item.capabilities as Record<string, unknown>
          : {};
        const capabilities: ModelCapabilities = {
          tools: capabilitiesValue.tools === true,
          images: capabilitiesValue.images === true,
          reasoning: capabilitiesValue.reasoning === true,
          customProtocol: capabilitiesValue.customProtocol === true,
        };
        const inputTokens = Number.isInteger(item.inputTokens) && Number(item.inputTokens) > 0 && Number(item.inputTokens) <= 1_000_000
          ? Number(item.inputTokens)
          : undefined;
        const outputTokens = Number.isInteger(item.outputTokens) && Number(item.outputTokens) > 0 && Number(item.outputTokens) <= 128_000
          ? Number(item.outputTokens)
          : undefined;
        models.push({
          id: item.id,
          name,
          modelId,
          ...(provider ? { provider } : {}),
          ...(baseUrl ? { baseUrl } : {}),
          ...(inputTokens ? { inputTokens } : {}),
          ...(outputTokens ? { outputTokens } : {}),
          capabilities,
        });
      }
    const rawDefaultModel = typeof source.defaultModel === "string" ? source.defaultModel.slice(0, 128) : "";
    const defaultModel = modelOptions.some((option) => option.id === rawDefaultModel) || models.some((model) => model.modelId === rawDefaultModel)
      ? rawDefaultModel
      : "";
    const homeScenes = Array.isArray(source.homeScenes)
      ? source.homeScenes
          .filter((id): id is string => typeof id === "string" && /^[a-z0-9-]{1,40}$/.test(id))
          .slice(0, 6)
      : [];
    while (homeScenes.length < 6) {
      const fill = DEFAULT_HOME_SCENES[homeScenes.length];
      if (!homeScenes.includes(fill)) homeScenes.push(fill);
      else break;
    }
    const keybindings = { ...DEFAULT_KEYBINDINGS };
    if (source.keybindings && typeof source.keybindings === "object") {
      const raw = source.keybindings as Record<string, unknown>;
      const seen = new Set<string>();
      for (const action of Object.keys(DEFAULT_KEYBINDINGS) as KeybindingAction[]) {
        const value = raw[action];
        if (typeof value === "string" && validBinding.test(value) && !seen.has(value)) {
          keybindings[action] = value;
          seen.add(value);
        }
      }
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
      locale: isLocale(source.locale) ? source.locale : defaults.locale,
      wakeLock: source.wakeLock === true,
      theme: (["system", "light", "dark"] as const).includes(source.theme as ThemeMode)
        ? (source.theme as ThemeMode)
        : "system",
      density: (["comfortable", "compact"] as const).includes(source.density as DensityMode)
        ? (source.density as DensityMode)
        : "comfortable",
      defaultModel,
      defaultMode: (["office", "code", "design"] as const).includes(source.defaultMode as ComposerMode)
        ? (source.defaultMode as ComposerMode)
        : "office",
      defaultWorkspace: typeof source.defaultWorkspace === "string" ? source.defaultWorkspace.trim().slice(0, 40) : "",
      defaultPermission: typeof source.defaultPermission === "string" ? source.defaultPermission.trim().slice(0, 40) : "",
      homeScenes: homeScenes.length === 6 ? homeScenes : [...DEFAULT_HOME_SCENES],
      keybindings,
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
    throw new Error(translate(usePreferences.getState().locale, "settings.err.storeSave"));
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
export function setLocale(locale: Locale) {
  save({ ...usePreferences.getState(), locale });
}
export function setWakeLock(wakeLock: boolean) {
  save({ ...usePreferences.getState(), wakeLock });
}
export function setTheme(theme: ThemeMode) {
  save({ ...usePreferences.getState(), theme });
}
export function setDensity(density: DensityMode) {
  save({ ...usePreferences.getState(), density });
}
export function setComposerDefaults(patch: {
  defaultModel?: string;
  defaultMode?: ComposerMode;
  defaultWorkspace?: string;
  defaultPermission?: string;
}) {
  const state = usePreferences.getState();
  save({
    ...state,
    defaultModel: patch.defaultModel !== undefined ? patch.defaultModel.slice(0, 128) : state.defaultModel,
    defaultMode: patch.defaultMode || state.defaultMode,
    defaultWorkspace: patch.defaultWorkspace !== undefined ? patch.defaultWorkspace.slice(0, 40) : state.defaultWorkspace,
    defaultPermission: patch.defaultPermission !== undefined ? patch.defaultPermission.slice(0, 40) : state.defaultPermission,
  });
}
export function setHomeScenes(ids: string[]) {
  const clean = ids.filter((id) => typeof id === "string" && /^[a-z0-9-]{1,40}$/.test(id)).slice(0, 6);
  if (clean.length !== 6 || new Set(clean).size !== 6)
    throw new Error(translate(usePreferences.getState().locale, "settings.personal.err.dup"));
  save({ ...usePreferences.getState(), homeScenes: clean });
}
export function resetHomeScenes() {
  save({ ...usePreferences.getState(), homeScenes: [...DEFAULT_HOME_SCENES] });
}
export function setKeybinding(action: KeybindingAction, binding: string) {
  const locale = usePreferences.getState().locale;
  if (!validBinding.test(binding)) throw new Error(translate(locale, "settings.shortcuts.err.binding"));
  const state = usePreferences.getState();
  const clash = (Object.keys(state.keybindings) as KeybindingAction[]).find(
    (other) => other !== action && state.keybindings[other] === binding,
  );
  if (clash) {
    const labelKey = KEYBINDING_ACTIONS.find((item) => item.id === clash)?.labelKey;
    const label = labelKey ? translate(locale, labelKey) : clash;
    throw new Error(translate(locale, "settings.shortcuts.clash", { label }));
  }
  save({ ...usePreferences.getState(), keybindings: { ...state.keybindings, [action]: binding } });
}
export function resetKeybindings() {
  save({ ...usePreferences.getState(), keybindings: { ...DEFAULT_KEYBINDINGS } });
}
/** Canonical binding string from a key event, or "" for bare modifiers. */
export function bindingFromEvent(event: KeyboardEvent): string {
  const key = event.key.toLowerCase();
  if (["control", "meta", "alt", "shift"].includes(key)) return "";
  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) parts.push("mod");
  if (event.altKey) parts.push("alt");
  if (event.shiftKey) parts.push("shift");
  parts.push(key === " " ? "space" : key);
  return parts.join("+");
}
export function matchBinding(event: KeyboardEvent, binding: string): boolean {
  return bindingFromEvent(event) === binding;
}
export function formatBinding(binding: string): string {
  return binding
    .split("+")
    .map((part) => (part === "mod" ? "Ctrl/⌘" : part === " " ? "Space" : part.length === 1 ? part.toUpperCase() : part[0].toUpperCase() + part.slice(1)))
    .join(" + ");
}
export function saveCustomModel(input: {
  id?: string;
  name: string;
  modelId: string;
  provider?: string;
  baseUrl?: string;
  inputTokens?: number;
  outputTokens?: number;
  capabilities?: ModelCapabilities;
}) {
  const name = input.name.trim(),
    modelId = input.modelId.trim();
  const locale = usePreferences.getState().locale;
  if (!name || name.length > 60) throw new Error(translate(locale, "settings.models.err.name"));
  if (!validModelId.test(modelId))
    throw new Error(translate(locale, "settings.models.err.id"));
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
    throw new Error(translate(locale, "settings.models.err.dup"));
  if (!input.id && state.models.length >= 20)
    throw new Error(translate(locale, "settings.models.err.max"));
  if (input.id && !state.models.some((model) => model.id === input.id))
    throw new Error(translate(locale, "settings.models.err.gone"));
  const previous = input.id ? state.models.find((item) => item.id === input.id) : undefined;
  const allowedProviders = ["custom", "openai", "openrouter", "deepseek", "groq", "mistral", "google"];
  if (input.provider !== undefined && !allowedProviders.includes(input.provider))
    throw new Error(translate(locale, "settings.models.err.provider"));
  const baseUrl = input.baseUrl?.trim();
  if (input.provider === "custom" && !baseUrl)
    throw new Error(translate(locale, "settings.models.err.endpoint"));
  if (input.provider === "custom" && baseUrl) {
    let parsed: URL;
    try { parsed = new URL(baseUrl); } catch { throw new Error(translate(locale, "settings.models.err.endpoint")); }
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash)
      throw new Error(translate(locale, "settings.models.err.endpoint"));
  }
  const model = {
    id: input.id || crypto.randomUUID(),
    name,
    modelId,
    ...(input.provider ? { provider: input.provider } : {}),
    ...(baseUrl && baseUrl.length <= 2048 ? { baseUrl } : {}),
    ...(Number.isInteger(input.inputTokens) && input.inputTokens! > 0 && input.inputTokens! <= 1_000_000 ? { inputTokens: input.inputTokens } : {}),
    ...(Number.isInteger(input.outputTokens) && input.outputTokens! > 0 && input.outputTokens! <= 128_000 ? { outputTokens: input.outputTokens } : {}),
    ...(input.capabilities ? { capabilities: { ...input.capabilities } } : {}),
  };
  const models = input.id
    ? state.models.map((item) => (item.id === input.id ? model : item))
    : [...state.models, model];
  const defaultModel = previous && state.defaultModel === previous.modelId
    ? modelId
    : state.defaultModel;
  save({ ...state, models, defaultModel });
}
export function removeCustomModel(id: string) {
  const state = usePreferences.getState();
  const removed = state.models.find((model) => model.id === id);
  save({
    ...state,
    models: state.models.filter((model) => model.id !== id),
    defaultModel: removed && state.defaultModel === removed.modelId ? "" : state.defaultModel,
  });
  if (removed) removeCustomModelApiKey(removed.modelId);
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
