import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { HomeIcon, type HomeIconName } from "./HomeIcon";
import { AIProviderSettings } from "../../../../frontend/workspace/AIProviderSettings";
import { readCustomModelApiKey, writeCustomModelApiKey } from "../../../../frontend/workspace/aiProviderStorage";
import { testModelConnection } from "../../../../frontend/workspace/api/models";
import { navigateTo } from "../../../../frontend/workspace/workspaceRoutes";
import { AUTH_GATE_ENABLED, SERVER_PANEL_TITLE } from "../../../../frontend/workspace/authGate";
import {
  closeSettings,
  refreshPreferences,
  removeCustomModel,
  saveCustomModel,
  setFontSize,
  setLinkMode,
  setLocale,
  setWakeLock,
  SETTINGS_KEY,
  usePreferences,
  useSettingsWindow,
  type CustomModel,
  type ModelCapabilities,
  type Locale,
  type SettingsSection,
} from "../../../../frontend/workspace/settingsStore";
import { hasFullCatalog, translate } from "../../../../frontend/workspace/i18n";
import { LOCALE_OPTIONS } from "../../../../frontend/workspace/locales";
import "./settings-window.css";
import {
  AppearanceSettings,
  DataSettings,
  DevicesSettings,
  PersonalSettings,
  PlanSettings,
  ShortcutsSettings,
} from "./SettingsSections";

type Section = {
  id: SettingsSection;
  nameKey: string;
  icon: HomeIconName;
  keywords?: string;
};
const groups: { labelKey: string; items: Section[] }[] = [
  {
    labelKey: "settings.group.settings",
    items: [
      {
        id: "general",
        nameKey: "settings.section.general",
        icon: "settings",
        keywords:
          "常规 语言 多语言 简体中文 繁體中文 English Bahasa Indonesia Deutsch Português Brasil Español España Русский فارسی العربية 日本語 한국어 Polski Magyar Français Українська Türkçe ภาษาไทย Italiano zh-CN zh-TW en id de pt-BR es-ES ru fa ar ja ko pl hu fr uk tr th it 链接打开方式 字体大小 字号 系统 防休眠 唤醒锁定 屏幕常亮",
      },
      { id: "profile", nameKey: "settings.section.profile", icon: "invite" },
      { id: "plan", nameKey: "settings.section.plan", icon: "chart", keywords: "用量 统计 套餐 积分 订阅 本地版" },
      { id: "appearance", nameKey: "settings.section.appearance", icon: "palette", keywords: "主题 深色 浅色 跟随系统 密度 紧凑" },
      { id: "shortcuts", nameKey: "settings.section.shortcuts", icon: "panel", keywords: "快捷键 录制 按键 绑定 恢复默认" },
    ],
  },
  {
    labelKey: "settings.group.features",
    items: [
      { id: "personalization", nameKey: "settings.section.personalization", icon: "pencil", keywords: "默认值 预设 空间 权限 快捷场景 创作" },
      { id: "memory", nameKey: "settings.section.memory", icon: "bulb" },
      { id: "agents", nameKey: "settings.section.agents", icon: "assistant" },
      {
        id: "models",
        nameKey: "settings.section.models",
        icon: "grid",
        keywords: "自定义模型 添加模型 AI 服务商 API",
      },
      { id: "assistant", nameKey: "settings.section.assistant", icon: "experts" },
      { id: "devices", nameKey: "settings.section.devices", icon: "devices", keywords: "会话 同步 迁移 设置文件 导出导入 清除" },
    ],
  },
  {
    labelKey: "settings.group.data",
    items: [
      { id: "data", nameKey: "settings.section.data", icon: "book", keywords: "备份 导出 导入 清空 存储 占用 恢复" },
      { id: "apps", nameKey: "settings.section.apps", icon: "panel" },
      { id: "security", nameKey: "settings.section.security", icon: "shield" },
    ],
  },
];

function wakeLockSupported() {
  if (typeof window !== "undefined" && window.designBuddyDesktop?.setRuntimeSleepBlocker) return true;
  return typeof window !== "undefined" && typeof navigator !== "undefined" && !!window.isSecureContext && "wakeLock" in navigator;
}
function GeneralSettings({ onError }: { onError(message: string): void }) {
  const fontSize = usePreferences((state) => state.fontSize);
  const linkMode = usePreferences((state) => state.linkMode);
  const locale = usePreferences((state) => state.locale);
  const wakeLock = usePreferences((state) => state.wakeLock);
  const t = (key: string, params?: Record<string, string | number>) =>
    translate(locale, key, params);
  const change = (callback: () => void) => {
    try {
      callback();
      onError("");
    } catch {
      onError(t("settings.storageError"));
    }
  };
  useEffect(() => {
    const failed = () => onError(t("settings.general.wakelock.denied"));
    window.addEventListener("designbuddy:wake-lock-failed", failed);
    return () => window.removeEventListener("designbuddy:wake-lock-failed", failed);
  }, [locale, onError]);
  return (
    <>
      <section aria-labelledby="settings-normal-title">
        <h2 className="settings-section-label" id="settings-normal-title">
          {t("settings.general.regular")}
        </h2>
        <div className="settings-card">
          <div className="settings-row">
            <div>
              <label htmlFor="settings-language">{t("settings.general.language")}</label>
              {!hasFullCatalog(locale) && (
                <p className="settings-language-fallback" role="status">
                  {t("settings.general.language.fallback")}
                </p>
              )}
            </div>
            <select
              id="settings-language"
              className="settings-language-select"
              value={locale}
              onChange={(event) =>
                change(() => setLocale(event.target.value as Locale))
              }
            >
              {LOCALE_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="settings-row">
            <div>
              <label htmlFor="settings-link-mode">{t("settings.general.links")}</label>
              <p>{t("settings.general.links.help")}</p>
            </div>
            <select
              id="settings-link-mode"
              value={linkMode}
              onChange={(event) =>
                change(() =>
                  setLinkMode(
                    event.target.value as "smart" | "new-tab" | "same-tab",
                  ),
                )
              }
            >
              <option value="smart">{t("settings.general.links.smart")}</option>
              <option value="new-tab">{t("settings.general.links.newtab")}</option>
              <option value="same-tab">{t("settings.general.links.sametab")}</option>
            </select>
          </div>
          <div className="settings-row">
            <div>
              <label htmlFor="settings-font-size">{t("settings.general.font")}</label>
              <p className="settings-font-help">{t("settings.general.font.help")}</p>
            </div>
            <div className="settings-font-control">
              <input
                id="settings-font-size"
                type="range"
                min="12"
                max="20"
                step="1"
                value={fontSize}
                onChange={(event) =>
                  change(() => setFontSize(Number(event.target.value)))
                }
                aria-valuetext={t("settings.general.font.unit", { size: fontSize })}
              />
              <div>
                <span>{t("settings.general.font.small")}</span>
                <button onClick={() => change(() => setFontSize(15))}>
                  {t("settings.general.font.default")}
                </button>
                <span>{t("settings.general.font.big")}</span>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section aria-labelledby="settings-system-title">
        <h2 className="settings-section-label" id="settings-system-title">
          {t("settings.general.system")}
        </h2>
        <div className="settings-card">
          <div className="settings-row">
            <div>
              <strong id="settings-wakelock-label">
                {t("settings.general.wakelock")}
              </strong>
              <p>{t("settings.general.wakelock.help")}</p>
            </div>
            <button
              className="settings-switch"
              type="button"
              role="switch"
              aria-labelledby="settings-wakelock-label"
              aria-checked={wakeLock}
              onClick={() => {
                if (!wakeLock && !wakeLockSupported()) {
                  onError(t("settings.general.wakelock.unsupported"));
                  return;
                }
                change(() => setWakeLock(!wakeLock));
              }}
            >
              <span />
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

const modelProviderEndpoints: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  deepseek: "https://api.deepseek.com/v1",
  groq: "https://api.groq.com/openai/v1",
  mistral: "https://api.mistral.ai/v1",
  google: "https://generativelanguage.googleapis.com/v1beta/openai",
};

type ModelDraft = {
  provider: string;
  baseUrl: string;
  modelId: string;
  apiKey: string;
  inputTokens: string;
  outputTokens: string;
  capabilities: ModelCapabilities;
};

function emptyModelDraft(): ModelDraft {
  return {
    provider: "custom",
    baseUrl: "",
    modelId: "",
    apiKey: "",
    inputTokens: "",
    outputTokens: "",
    capabilities: { tools: true, images: false, reasoning: false, customProtocol: false },
  };
}

function parseTokenLimit(value: string, maximum: number, t: (key: string) => string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum)
    throw new Error(t("settings.models.err.tokens"));
  return parsed;
}

function ModelsSettings() {
  const models = usePreferences((state) => state.models);
  const locale = usePreferences((state) => state.locale);
  const t = (key: string, params?: Record<string, string | number>) =>
    translate(locale, key, params);
  const [editing, setEditing] = useState<CustomModel | "new" | null>(null);
  const [draft, setDraft] = useState<ModelDraft>(emptyModelDraft);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connection, setConnection] = useState<{ ok: boolean; message: string } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const modal = useRef<HTMLDialogElement>(null);
  const modelInput = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    const element = modal.current;
    if (!element) return;
    if (editing && !element.open) {
      element.showModal();
      requestAnimationFrame(() => modelInput.current?.focus());
    } else if (!editing && element.open) {
      element.close();
    }
  }, [editing]);

  function openEditor(model: CustomModel | "new") {
    const isNew = model === "new";
    const provider = isNew ? "custom" : model.provider || "server";
    setDraft({
      provider,
      baseUrl: isNew ? "" : model.baseUrl || modelProviderEndpoints[provider] || "",
      modelId: isNew ? "" : model.modelId,
      apiKey: isNew ? "" : readCustomModelApiKey(model.modelId),
      inputTokens: isNew || !model.inputTokens ? "" : String(model.inputTokens),
      outputTokens: isNew || !model.outputTokens ? "" : String(model.outputTokens),
      capabilities: isNew
        ? { tools: true, images: false, reasoning: false, customProtocol: false }
        : { tools: false, images: false, reasoning: false, customProtocol: false, ...model.capabilities },
    });
    setShowKey(false);
    setTesting(false);
    setConnection(null);
    setError("");
    setNotice("");
    setEditing(model);
  }

  function closeEditor() {
    setEditing(null);
    setError("");
    setConnection(null);
  }

  function setField<K extends keyof ModelDraft>(key: K, value: ModelDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setConnection(null);
  }

  function changeProvider(provider: string) {
    setDraft((current) => ({
      ...current,
      provider,
      baseUrl: provider === "custom" ? (current.provider === "custom" ? current.baseUrl : "") : modelProviderEndpoints[provider] || "",
    }));
    setConnection(null);
  }

  function validCustomEndpoint(value: string): boolean {
    try {
      const url = new URL(value.trim());
      const host = url.hostname.toLowerCase().replace(/\.$/, "");
      return url.protocol === "https:" && !!host.includes(".") &&
        !url.username && !url.password && !url.search && !url.hash &&
        host !== "localhost" && !/\.(?:localhost|local|internal|lan|home|test|invalid)$/.test(host) &&
        !/^(?:10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host);
    } catch { return false; }
  }

  async function testConnection() {
    const modelId = draft.modelId.trim();
    if (!draft.apiKey.trim()) {
      setConnection({ ok: false, message: t("settings.models.err.key") });
      return;
    }
    if (!modelId || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(modelId)) {
      setConnection({ ok: false, message: t("settings.models.err.id") });
      return;
    }
    if (draft.provider === "custom" && !validCustomEndpoint(draft.baseUrl)) {
      setConnection({ ok: false, message: t("settings.models.err.endpoint") });
      return;
    }
    setTesting(true);
    setConnection(null);
    try {
      const result = await testModelConnection({
        provider: draft.provider,
        baseUrl: draft.provider === "custom" ? draft.baseUrl.trim() : undefined,
        apiKey: draft.apiKey.trim(),
        modelId,
      });
      if (!result.ok) {
        setConnection({ ok: false, message: result.error || t("settings.models.test.fail") });
      } else if (!result.modelCount) {
        setConnection({ ok: true, message: t("settings.models.test.noList") });
      } else if (result.modelFound) {
        setConnection({ ok: true, message: t("settings.models.test.found") });
      } else {
        setConnection({ ok: false, message: t("settings.models.test.notFound") });
      }
    } catch (cause) {
      setConnection({
        ok: false,
        message: cause instanceof Error ? cause.message.slice(0, 300) : t("settings.models.test.fail"),
      });
    } finally {
      setTesting(false);
    }
  }

  function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const modelId = draft.modelId.trim();
    const apiKey = draft.provider === "server" ? "" : draft.apiKey.trim();
    const baseUrl = draft.provider === "custom" ? draft.baseUrl.trim() : modelProviderEndpoints[draft.provider] || "";
    if (draft.provider !== "server" && !apiKey) {
      setError(t("settings.models.err.key"));
      return;
    }
    if (draft.provider === "custom" && !validCustomEndpoint(baseUrl)) {
      setError(t("settings.models.err.endpoint"));
      return;
    }
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;
    try {
      inputTokens = parseTokenLimit(draft.inputTokens, 1_000_000, t);
      outputTokens = parseTokenLimit(draft.outputTokens, 128_000, t);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("settings.models.err.tokens"));
      return;
    }

    const previous = editing !== "new" ? editing : null;
    const name = previous && previous.name !== previous.modelId
      ? previous.name
      : modelId.slice(0, 60);
    const previousKeyAtModelId = readCustomModelApiKey(modelId);
    const previousModelKey = previous ? readCustomModelApiKey(previous.modelId) : "";
    try {
      writeCustomModelApiKey(modelId, apiKey);
      saveCustomModel({
        id: previous?.id,
        name,
        modelId,
        provider: draft.provider === "server" ? undefined : draft.provider,
        baseUrl: baseUrl || undefined,
        inputTokens,
        outputTokens,
        capabilities: draft.capabilities,
      });
      if (previous && previous.modelId !== modelId) writeCustomModelApiKey(previous.modelId, "");
      closeEditor();
      setNotice(t("settings.models.saved"));
    } catch (cause) {
      try {
        writeCustomModelApiKey(modelId, previous && previous.modelId === modelId ? previousModelKey : previousKeyAtModelId);
      } catch { /* Keep the validation or storage error shown below. */ }
      setError(cause instanceof Error ? cause.message : t("settings.models.saveFail"));
    }
  }

  const title = editing === "new" ? t("settings.models.add") : t("settings.models.edit");
  const canTest = draft.provider !== "server" && !!draft.apiKey.trim() && !!draft.modelId.trim() && !testing;
  return (
    <>
      <section
        className="settings-card settings-model-heading"
        aria-label={t("settings.models.title")}
      >
        <div>
          <h2>{t("settings.models.title")}</h2>
          <p>{t("settings.models.help")}</p>
        </div>
        <button className="settings-button" type="button" onClick={() => openEditor("new")}>
          {t("settings.models.add")}
        </button>
      </section>
      {notice && <p className="settings-notice" role="status">{notice}</p>}
      {error && !editing && <p className="settings-error" role="alert">{error}</p>}
      {models.length > 0 && (
        <section
          className="settings-card settings-model-list"
          aria-label={t("settings.models.list")}
        >
          {models.map((model) => (
            <article key={model.id}>
              <div>
                <strong>{model.name}</strong>
                <code>{model.modelId}</code>
              </div>
              <button
                className="settings-button"
                aria-label={t("settings.models.editAria", { name: model.name })}
                onClick={() => openEditor(model)}
              >
                {t("settings.models.editItem")}
              </button>
              <button
                className="settings-button"
                aria-label={t("settings.models.removeAria", { name: model.name })}
                onClick={() => {
                  if (!window.confirm(t("settings.models.removeConfirm", { name: model.name }))) return;
                  try {
                    removeCustomModel(model.id);
                    setNotice(t("settings.models.removed"));
                    setError("");
                    if (editing !== "new" && editing?.id === model.id) closeEditor();
                  } catch {
                    setError(t("settings.models.removeFail"));
                  }
                }}
              >
                {t("settings.models.remove")}
              </button>
            </article>
          ))}
        </section>
      )}
      <dialog
        ref={modal}
        className="settings-model-dialog"
        aria-labelledby="settings-model-dialog-title"
        onCancel={(event) => { event.preventDefault(); closeEditor(); }}
        onClick={(event) => { if (event.target === event.currentTarget) closeEditor(); }}
      >
        <div className="settings-model-dialog__shell">
          <header className="settings-model-dialog__header">
            <h2 id="settings-model-dialog-title">{title}</h2>
            <button type="button" className="settings-model-dialog__close" aria-label={t("settings.close")} onClick={closeEditor}>×</button>
          </header>
          <form
            className="settings-model-dialog__form"
            aria-label={title}
            onSubmit={saveDraft}
          >
            <div className="settings-model-dialog__scroll">
              <label className="settings-model-dialog__field">
                <span>{t("settings.models.provider")} <small>{t("settings.models.provider.help")}</small></span>
                <select value={draft.provider} onChange={(event) => changeProvider(event.target.value)}>
                  <option value="custom">✧ {t("settings.models.custom")}</option>
                  <option value="openai">OpenAI</option>
                  <option value="openrouter">OpenRouter</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="groq">Groq</option>
                  <option value="mistral">Mistral</option>
                  <option value="google">Google Gemini</option>
                  <option value="server">{t("ai.server")}</option>
                </select>
              </label>
              <label className="settings-model-dialog__field">
                <span>{t("settings.models.endpoint")}</span>
                <input
                  type="url"
                  value={draft.baseUrl}
                  onChange={(event) => setField("baseUrl", event.target.value)}
                  placeholder={draft.provider === "server" ? t("settings.models.endpoint.serverPh") : t("settings.models.endpoint.ph")}
                  disabled={draft.provider !== "custom"}
                  autoComplete="url"
                  spellCheck={false}
                />
              </label>
              <div className="settings-model-dialog__key-row">
                <label className="settings-model-dialog__field">
                  <span>API Key</span>
                  <span className="settings-model-dialog__key-control">
                    <input
                      type={showKey ? "text" : "password"}
                      autoComplete="off"
                      spellCheck={false}
                      value={draft.apiKey}
                      onChange={(event) => setField("apiKey", event.target.value)}
                      placeholder={draft.provider === "server" ? t("settings.models.key.serverPh") : t("settings.models.key.ph")}
                      disabled={draft.provider === "server"}
                      required={draft.provider !== "server"}
                    />
                    <button
                      type="button"
                      className="settings-model-dialog__key-toggle"
                      aria-label={t(showKey ? "settings.models.key.hide" : "settings.models.key.show")}
                      onClick={() => setShowKey((value) => !value)}
                      disabled={draft.provider === "server"}
                    >
                      {showKey ? "◉" : "⌁"}
                    </button>
                  </span>
                </label>
                <button type="button" className="settings-model-dialog__test" onClick={() => void testConnection()} disabled={!canTest}>
                  {testing ? t("settings.models.testing") : t("settings.models.test")}
                </button>
              </div>
              {connection && <p className={`settings-model-dialog__connection ${connection.ok ? "is-ok" : "is-error"}`} role={connection.ok ? "status" : "alert"}>{connection.message}</p>}
              <label className="settings-model-dialog__field">
                <span>{t("settings.models.id")}</span>
                <input
                  ref={modelInput}
                  type="text"
                  value={draft.modelId}
                  onChange={(event) => setField("modelId", event.target.value)}
                  maxLength={128}
                  placeholder={t("settings.models.id.ph")}
                  required
                  spellCheck={false}
                  autoCapitalize="off"
                />
              </label>
              <fieldset className="settings-model-dialog__advanced">
                <legend>{t("settings.models.advanced")}</legend>
                <div className="settings-model-dialog__checks">
                  {([
                    ["tools", "settings.models.feature.tools"],
                    ["images", "settings.models.feature.images"],
                    ["reasoning", "settings.models.feature.reasoning"],
                    ["customProtocol", "settings.models.feature.protocol"],
                  ] as const).map(([key, label]) => (
                    <label key={key}>
                      <input
                        type="checkbox"
                        checked={draft.capabilities[key]}
                        onChange={(event) => {
                          setDraft((current) => ({ ...current, capabilities: { ...current.capabilities, [key]: event.target.checked } }));
                        }}
                      />
                      {t(label)}
                    </label>
                  ))}
                </div>
                <p>{t("settings.models.capability.note")}</p>
              </fieldset>
              <div className="settings-model-dialog__token-row">
                <label className="settings-model-dialog__field">
                  <span>{t("settings.models.tokens.input")}</span>
                  <input
                    type="number"
                    min="1"
                    max="1000000"
                    step="1"
                    value={draft.inputTokens}
                    onChange={(event) => setField("inputTokens", event.target.value)}
                    placeholder={t("settings.models.tokens.ph")}
                    inputMode="numeric"
                  />
                </label>
                <label className="settings-model-dialog__field">
                  <span>{t("settings.models.tokens.output")}</span>
                  <input
                    type="number"
                    min="1"
                    max="128000"
                    step="1"
                    value={draft.outputTokens}
                    onChange={(event) => setField("outputTokens", event.target.value)}
                    placeholder={t("settings.models.tokens.ph")}
                    inputMode="numeric"
                  />
                </label>
              </div>
              <p className="settings-model-dialog__note">{t("settings.models.tokens.note")}</p>
              <p className="settings-model-dialog__note">{t("settings.models.note")}</p>
              {error && <p className="settings-error" role="alert">{error}</p>}
            </div>
            <footer className="settings-model-dialog__footer">
              <button type="button" className="settings-button" onClick={closeEditor}>{t("settings.models.cancel")}</button>
              <button type="submit" className="settings-button is-primary">{t("settings.models.save")}</button>
            </footer>
          </form>
        </div>
      </dialog>
    </>
  );
}

const descriptionKeys: Partial<Record<SettingsSection, string>> = {
  profile: AUTH_GATE_ENABLED
    ? "settings.desc.profile.gate"
    : "settings.desc.profile.open",
  memory: "settings.desc.memory",
  agents: "settings.desc.agents",
  assistant: "settings.desc.assistant",
  apps: "settings.desc.apps",
  security: "settings.desc.security",
};
function SectionInfoCard({
  section,
  name,
  cardTitle,
}: {
  section: SettingsSection;
  name: string;
  cardTitle?: string;
}) {
  const locale = usePreferences((state) => state.locale);
  const t = (key: string) => translate(locale, key);
  const routes: Partial<
    Record<SettingsSection, { labelKey: string; path: string }>
  > = {
    profile: { labelKey: "settings.link.profile", path: "/profile" },
    agents: { labelKey: "settings.link.experts", path: "/experts" },
    assistant: { labelKey: "settings.link.plugins", path: "/plugins" },
    apps: { labelKey: "settings.link.connectors", path: "/connectors" },
    memory: { labelKey: "settings.link.profile", path: "/profile" },
  };
  const link = routes[section];
  return (
    <section className="settings-card settings-info">
      <h2>{cardTitle ?? name}</h2>
      <p>{descriptionKeys[section] ? t(descriptionKeys[section]!) : ""}</p>
      {section === "profile" && (
        <button
          className="settings-button"
          onClick={() => {
            closeSettings();
            requestAnimationFrame(() =>
              window.dispatchEvent(new Event("designbuddy:open-server")),
            );
          }}
        >
          {SERVER_PANEL_TITLE}
        </button>
      )}
      {link && (
        <button
          className="settings-button"
          onClick={() => {
            closeSettings();
            navigateTo(link.path);
          }}
        >
          {t(link.labelKey)}
        </button>
      )}
    </section>
  );
}

function OtherSettings({
  section,
  name,
}: {
  section: SettingsSection;
  name: string;
}) {
  return (
    <section aria-labelledby={`settings-${section}-title`}>
      <h2 className="settings-section-label" id={`settings-${section}-title`}>
        {name}
      </h2>
      <SectionInfoCard section={section} name={name} />
    </section>
  );
}

/**
 * 设置 → 个人主页：把套餐与额度面板直接放进设置窗口。
 *
 * 版式来自 2026-10-18 提供的参考截图（顶部渐变横幅、钱包余额卡、使用限额重置卡），
 * 但所有数字都是真实状态：没有接入支付、钱包、自动充值或云端额度服务，
 * 所以余额固定为 $0.00、开关禁用，并把「未接入」写在卡片脚注里，不伪造账单。
 */
function ProfilePlanSettings({ name }: { name: string }) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const upgrade = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = upgrade.current;
    if (!element) return;
    if (upgradeOpen && !element.open) element.showModal();
    else if (!upgradeOpen && element.open) element.close();
  }, [upgradeOpen]);
  return (
    <section aria-labelledby="settings-profile-title">
      <h2 className="settings-section-label" id="settings-profile-title">
        {name}
      </h2>

      <div className="settings-plan-banner" role="region" aria-label="当前套餐">
        <div className="settings-plan-banner-art" aria-hidden="true" />
        <div className="settings-plan-banner-copy">
          <span className="settings-plan-free">Free</span>
          <p>订阅状态：免费</p>
        </div>
        <button
          type="button"
          className="settings-plan-upgrade"
          onClick={() => setUpgradeOpen(true)}
        >
          升级
        </button>
      </div>

      <div className="settings-plan-heading">
        <h3>钱包余额</h3>
        <p>Design Plan 额度用尽后，自动使用此余额按量付费。</p>
      </div>
      <div className="settings-plan-card" role="region" aria-label="钱包余额">
        <div className="settings-plan-balance">
          <strong aria-label="当前可用余额 0.00，支付与钱包服务未接入">$0.00</strong>
          <span>当前可用余额</span>
        </div>
        <div className="settings-plan-divider" />
        <div className="settings-plan-row">
          <div>
            <strong>自动充值</strong>
            <p>升级会员后即可使用自动充值。</p>
          </div>
          <button
            type="button"
            className="settings-plan-switch"
            role="switch"
            aria-checked={false}
            aria-label="自动充值"
            disabled
            title="自动充值服务尚未接入"
          >
            <span />
          </button>
        </div>
        <p className="settings-plan-foot">
          支付、钱包与自动充值服务尚未接入：$0.00 表示现在没有可用余额，也不会产生扣费。
        </p>
      </div>

      <div className="settings-plan-heading">
        <h3>使用限额重置</h3>
      </div>
      <div className="settings-plan-card is-soft" role="region" aria-label="使用限额重置">
        <div className="settings-plan-quota">
          <span>可用</span>
          <strong>0</strong>
        </div>
        <div className="settings-plan-divider" />
        <p className="settings-plan-empty">暂无可用重置额度</p>
        <p className="settings-plan-foot">
          没有已连接的云端额度服务；这个数字不会限制本机项目或本地数据。
        </p>
      </div>

      <SectionInfoCard section="profile" name={name} cardTitle="账号与后台连接" />

      <dialog
        ref={upgrade}
        className="settings-plan-dialog"
        aria-labelledby="settings-plan-dialog-title"
        onCancel={(event) => {
          event.preventDefault();
          setUpgradeOpen(false);
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) setUpgradeOpen(false);
        }}
      >
        <header className="settings-plan-dialog__header">
          <h2 id="settings-plan-dialog-title">付费套餐暂未接入</h2>
          <button
            type="button"
            className="settings-plan-dialog__close"
            aria-label="关闭升级说明"
            onClick={() => setUpgradeOpen(false)}
          >
            ×
          </button>
        </header>
        <p>
          这里展示的是本机免费版本信息。订阅购买、钱包余额、自动充值和云端额度服务还没有接入，
          因此不会创建订单或产生扣费。
        </p>
        <div className="settings-plan-dialog__actions">
          <button
            type="button"
            className="settings-button is-primary"
            onClick={() => setUpgradeOpen(false)}
          >
            知道了
          </button>
        </div>
      </dialog>
    </section>
  );
}

export function SettingsWindow() {
  const { open, section } = useSettingsWindow();
  const fontSize = usePreferences((state) => state.fontSize);
  const locale = usePreferences((state) => state.locale);
  const t = (key: string, params?: Record<string, string | number>) =>
    translate(locale, key, params);
  const dialog = useRef<HTMLDialogElement>(null);
  const content = useRef<HTMLElement>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const active = groups
    .flatMap((group) => group.items)
    .find((item) => item.id === section)!;
  const normalized = query.trim().toLocaleLowerCase();
  const shown = groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        `${translate("zh-CN", item.nameKey)} ${translate("en", item.nameKey)} ${item.keywords || ""}`
          .toLocaleLowerCase()
          .includes(normalized),
      ),
    }))
    .filter((group) => group.items.length);
  useLayoutEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    else if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);
  useEffect(() => {
    if (open) {
      setQuery("");
      setError("");
    }
  }, [open]);
  useEffect(() => {
    setError("");
    content.current?.scrollTo(0, 0);
  }, [section]);
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--db-user-font-size",
      `${fontSize}px`,
    );
  }, [fontSize]);
  useLayoutEffect(() => {
    // Global shortcuts (including open-settings) are dispatched by App from
    // the keybinding registry, so rebinding keeps working everywhere.
    const storage = (event: StorageEvent) => {
      if (event.key === SETTINGS_KEY || event.key === null)
        refreshPreferences();
    };
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener("storage", storage);
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="settings-window"
      aria-label={t("settings.title")}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const focusable = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            "button:not(:disabled), input:not(:disabled), select:not(:disabled), summary, a[href], [tabindex='0']",
          ),
        ).filter((element) => element.offsetParent !== null);
        const first = focusable[0],
          last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        closeSettings();
      }}
      onClick={(event) => {
        if (event.target !== dialog.current) return;
        const bounds = dialog.current.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          closeSettings();
      }}
    >
      {open && (
        <div className="settings-layout">
          <button
            className="settings-close"
            title={t("settings.close")}
            aria-label={t("settings.close")}
            onClick={closeSettings}
          >
            <span />
          </button>
          <aside className="settings-sidebar" aria-label={t("settings.nav")}>
            <label className="settings-search">
              <HomeIcon name="search" size={15} />
              <input
                aria-label={t("settings.search")}
                placeholder={t("settings.search")}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {query && (
                <button aria-label={t("settings.search.clear")} onClick={() => setQuery("")}>
                  ×
                </button>
              )}
            </label>
            <nav>
              {shown.map((group) => (
                <section key={group.labelKey}>
                  <h2>{t(group.labelKey)}</h2>
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      aria-current={section === item.id ? "page" : undefined}
                      className={section === item.id ? "is-active" : ""}
                      onClick={() =>
                        useSettingsWindow.setState({ section: item.id })
                      }
                    >
                      <HomeIcon name={item.icon} size={16} />
                      <span>{t(item.nameKey)}</span>
                    </button>
                  ))}
                </section>
              ))}
              {shown.length === 0 && (
                <p className="settings-search-empty">{t("settings.search.empty")}</p>
              )}
            </nav>
          </aside>
          <main
            ref={content}
            className="settings-content"
            aria-label={t("settings.contentTitle", { name: t(active.nameKey) })}
          >
            {error && (
              <p className="settings-error" role="alert">
                {error}
              </p>
            )}
            {section === "general" ? (
              <GeneralSettings onError={setError} />
            ) : section === "models" ? (
              <ModelsSettings />
            ) : section === "appearance" ? (
              <AppearanceSettings onError={setError} />
            ) : section === "shortcuts" ? (
              <ShortcutsSettings onError={setError} />
            ) : section === "personalization" ? (
              <PersonalSettings onError={setError} />
            ) : section === "devices" ? (
              <DevicesSettings onError={setError} />
            ) : section === "data" ? (
              <DataSettings onError={setError} />
            ) : section === "plan" ? (
              <PlanSettings />
            ) : section === "profile" ? (
              <ProfilePlanSettings name={t(active.nameKey)} />
            ) : (
              <OtherSettings section={section} name={t(active.nameKey)} />
            )}
          </main>
        </div>
      )}
    </dialog>
  );
}
