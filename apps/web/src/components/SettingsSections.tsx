import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  DEFAULT_KEYBINDINGS,
  KEYBINDING_ACTIONS,
  bindingFromEvent,
  closeSettings,
  formatBinding,
  resetHomeScenes,
  resetKeybindings,
  setComposerDefaults,
  setConsoleTheme,
  setContentWidth,
  setDensity,
  setFileIcons,
  setFontStyle,
  setGlassEffects,
  setHomeScenes,
  setKeybinding,
  setLinkMode,
  setLocale,
  setTheme,
  useModelOptions,
  usePreferences,
  type ConsoleTheme,
  type ContentWidth,
  type DensityMode,
  type FileIconStyle,
  type FontStyle,
  type KeybindingAction,
  type ThemeMode,
} from "../../../../frontend/workspace/settingsStore";
import {
  clearDataGroup,
  exportAllData,
  exportSettings,
  formatBytes,
  importAllData,
  importSettings,
  storageInventory,
  usageStats,
} from "../../../../frontend/workspace/settingsTransfer";
import {
  translate,
  type I18nParams,
} from "../../../../frontend/workspace/i18n";
import { LOCALE_OPTIONS } from "../../../../frontend/workspace/locales";
import type { Locale } from "../../../../frontend/workspace/locales";
import { navigateTo } from "../../../../frontend/workspace/workspaceRoutes";
import { apiJSON, resetAPISession } from "../api/client";
import { modeLabels, quickActionCatalog } from "./homeScenes";
import { HomeIcon, type HomeIconName } from "./HomeIcon";
import "./settings-shortcuts.css";
import { DeviceRecords, useSettingsCopy } from "./SettingsHubSections";

/** 与 settingsStore 的 linkMode 取值保持一致（该类型未导出）。 */
type LinkMode = "smart" | "new-tab" | "same-tab";

type T = (key: string, params?: I18nParams) => string;
function useT(): T {
  const locale = usePreferences((state) => state.locale);
  return (key, params) => translate(locale, key, params);
}

/** Where a setting lives. Everything new here is local-first and honest. */
export function SourceBadge({
  sourceKey,
}: {
  sourceKey: "settings.source.local" | "settings.source.server";
}) {
  const t = useT();
  return <span className="settings-source">{t(sourceKey)}</span>;
}

function reloadAfterDataChange() {
  window.setTimeout(() => window.location.reload(), 900);
}

function useNotice() {
  const [notice, setNotice] = useState("");
  const show = (message: string) => setNotice(message);
  const view = notice ? (
    <p className="settings-notice" role="status">
      {notice}
    </p>
  ) : null;
  return { show, view };
}

/* ------------------------------- appearance ------------------------------- */

/** 主题预览卡：三张卡对应真实可用的三种主题，点击即切换 html[data-theme]。 */
const THEME_CARDS: { id: ThemeMode; labelKey: string }[] = [
  { id: "system", labelKey: "settings.appearance.theme.system" },
  { id: "light", labelKey: "settings.appearance.theme.light" },
  { id: "dark", labelKey: "settings.appearance.theme.dark" },
];

const THEME_OPTIONS: { value: ThemeMode; labelKey: string }[] = [
  { value: "system", labelKey: "settings.appearance.theme.system" },
  { value: "light", labelKey: "settings.appearance.theme.light" },
  { value: "dark", labelKey: "settings.appearance.theme.dark" },
];

const FONT_STYLES: { value: FontStyle; labelKey: string }[] = [
  { value: "sans", labelKey: "settings.appearance.fontStyle.sans" },
  { value: "serif", labelKey: "settings.appearance.fontStyle.serif" },
];

const CONTENT_WIDTHS: { value: ContentWidth; labelKey: string }[] = [
  { value: "narrow", labelKey: "settings.appearance.contentWidth.narrow" },
  { value: "standard", labelKey: "settings.appearance.contentWidth.standard" },
  { value: "wide", labelKey: "settings.appearance.contentWidth.wide" },
];

const FILE_ICON_STYLES: { value: FileIconStyle; labelKey: string }[] = [
  { value: "color", labelKey: "settings.appearance.fileIcons.color" },
  { value: "mono", labelKey: "settings.appearance.fileIcons.mono" },
];

const LINK_MODES: { value: LinkMode; labelKey: string }[] = [
  { value: "smart", labelKey: "settings.general.links.smart" },
  { value: "new-tab", labelKey: "settings.general.links.newtab" },
  { value: "same-tab", labelKey: "settings.general.links.sametab" },
];

/** 一行：左标题 + 说明，右控件。结构与参考界面一致。 */
function AppearanceRow({
  id,
  title,
  help,
  children,
}: {
  id: string;
  title: string;
  help: string;
  children: ReactNode;
}) {
  return (
    <div className="settings-appearance-row">
      <div>
        <span className="settings-appearance-name" id={id}>
          {title}
        </span>
        <p>{help}</p>
      </div>
      <div className="settings-appearance-control">{children}</div>
    </div>
  );
}

export function AppearanceSettings({
  onError,
}: {
  onError(message: string): void;
}) {
  const theme = usePreferences((state) => state.theme);
  const density = usePreferences((state) => state.density);
  const locale = usePreferences((state) => state.locale);
  const consoleTheme = usePreferences((state) => state.consoleTheme);
  const fontStyle = usePreferences((state) => state.fontStyle);
  const contentWidth = usePreferences((state) => state.contentWidth);
  const fileIcons = usePreferences((state) => state.fileIcons);
  const glassEffects = usePreferences((state) => state.glassEffects);
  const linkMode = usePreferences((state) => state.linkMode);
  const t = useT();
  const change = (callback: () => void) => {
    try {
      callback();
      onError("");
    } catch {
      onError(t("settings.storageError"));
    }
  };
  const densities: { id: DensityMode; labelKey: string; hintKey: string }[] = [
    {
      id: "comfortable",
      labelKey: "settings.appearance.density.comfort",
      hintKey: "settings.appearance.density.comfort.hint",
    },
    {
      id: "compact",
      labelKey: "settings.appearance.density.compact",
      hintKey: "settings.appearance.density.compact.hint",
    },
  ];
  return (
    <section aria-labelledby="settings-appearance-title">
      <h2 className="settings-section-label" id="settings-appearance-title">
        {t("settings.appearance.title")}{" "}
        <SourceBadge sourceKey="settings.source.local" />
      </h2>
      <div className="settings-appearance">
        <div className="settings-appearance-group">
          <h3 className="settings-appearance-heading">
            {t("settings.appearance.styleTitle")}
          </h3>
          <div className="settings-appearance-rule" />

          <div className="settings-appearance-row">
            <div>
              <span
                className="settings-appearance-name"
                id="settings-appearance-mode"
              >
                {t("settings.appearance.mode")}
              </span>
              <p>{t("settings.appearance.mode.help")}</p>
            </div>
            <div className="settings-appearance-control">
              <span className="settings-appearance-select">
                <span
                  className="settings-appearance-swatch"
                  data-mode={theme}
                  aria-hidden="true"
                />
                <select
                  aria-labelledby="settings-appearance-mode"
                  value={theme}
                  onChange={(event) =>
                    change(() => setTheme(event.target.value as ThemeMode))
                  }
                >
                  {THEME_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {t(item.labelKey)}
                    </option>
                  ))}
                </select>
                <span
                  className="settings-appearance-caret"
                  aria-hidden="true"
                />
              </span>
              <button
                type="button"
                className="settings-appearance-icon-button"
                aria-label={t("settings.appearance.mode.toggle")}
                title={t("settings.appearance.mode.toggle")}
                onClick={() =>
                  change(() => setTheme(theme === "dark" ? "light" : "dark"))
                }
              >
                <span aria-hidden="true">◐</span>
              </button>
            </div>
          </div>

          <div
            className="settings-appearance-previews"
            role="radiogroup"
            aria-label={t("settings.appearance.preview.group")}
          >
            {THEME_CARDS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={theme === item.id}
                data-theme-preview={item.id}
                className={
                  theme === item.id
                    ? "settings-appearance-card is-active"
                    : "settings-appearance-card"
                }
                onClick={() => change(() => setTheme(item.id))}
              >
                <span
                  className="settings-appearance-preview"
                  aria-hidden="true"
                >
                  <span className="settings-appearance-preview-bar" />
                  <span className="settings-appearance-preview-dot" />
                  <span className="settings-appearance-preview-panel" />
                  <span className="settings-appearance-preview-line is-wide" />
                  <span className="settings-appearance-preview-line" />
                </span>
                <span className="settings-appearance-card-label">
                  {t(item.labelKey)}
                </span>
              </button>
            ))}
          </div>

          <div className="settings-appearance-rule" />
          <AppearanceRow
            id="settings-appearance-console-theme"
            title={t("settings.appearance.consoleTheme")}
            help={t("settings.appearance.consoleTheme.help")}
          >
            <span className="settings-appearance-select">
              <select
                aria-labelledby="settings-appearance-console-theme"
                value={consoleTheme}
                onChange={(event) =>
                  change(() =>
                    setConsoleTheme(event.target.value as ConsoleTheme),
                  )
                }
              >
                {THEME_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {t(item.labelKey)}
                  </option>
                ))}
              </select>
              <span className="settings-appearance-caret" aria-hidden="true" />
            </span>
          </AppearanceRow>
        </div>
        <div className="settings-appearance-group">
          <h3 className="settings-appearance-heading">
            {t("settings.design.readingLayout")}
          </h3>
          <div className="settings-appearance-rule" />
          <AppearanceRow
            id="settings-appearance-links"
            title={t("settings.general.links")}
            help={t("settings.general.links.help")}
          >
            <span className="settings-appearance-select">
              <select
                aria-label={t("settings.appearance.links.label")}
                value={linkMode}
                onChange={(event) =>
                  change(() => setLinkMode(event.target.value as LinkMode))
                }
              >
                {LINK_MODES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {t(item.labelKey)}
                  </option>
                ))}
              </select>
              <span className="settings-appearance-caret" aria-hidden="true" />
            </span>
          </AppearanceRow>

          <div className="settings-appearance-rule" />
          <AppearanceRow
            id="settings-appearance-language"
            title={t("settings.appearance.language")}
            help={t("settings.appearance.language.help")}
          >
            <span className="settings-appearance-select is-wide">
              <select
                aria-label={t("settings.appearance.language.label")}
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
              <span className="settings-appearance-caret" aria-hidden="true" />
            </span>
          </AppearanceRow>

          <div className="settings-appearance-rule" />
          <AppearanceRow
            id="settings-appearance-font-style"
            title={t("settings.appearance.fontStyle")}
            help={t("settings.appearance.fontStyle.help")}
          >
            <span className="settings-appearance-select">
              <select
                aria-labelledby="settings-appearance-font-style"
                value={fontStyle}
                onChange={(event) =>
                  change(() => setFontStyle(event.target.value as FontStyle))
                }
              >
                {FONT_STYLES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {t(item.labelKey)}
                  </option>
                ))}
              </select>
              <span className="settings-appearance-caret" aria-hidden="true" />
            </span>
          </AppearanceRow>

          <div
            className="settings-type-preview"
            style={{
              fontFamily:
                fontStyle === "serif"
                  ? "Georgia, 'Noto Serif SC', serif"
                  : "inherit",
            }}
          >
            <span>Aa</span>
            <p>{t("settings.design.fontSample")}</p>
          </div>
          <div className="settings-appearance-rule" />
          <AppearanceRow
            id="settings-appearance-content-width"
            title={t("settings.appearance.contentWidth")}
            help={t("settings.appearance.contentWidth.help")}
          >
            <span className="settings-appearance-select">
              <select
                aria-labelledby="settings-appearance-content-width"
                value={contentWidth}
                onChange={(event) =>
                  change(() =>
                    setContentWidth(event.target.value as ContentWidth),
                  )
                }
              >
                {CONTENT_WIDTHS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {t(item.labelKey)}
                  </option>
                ))}
              </select>
              <span className="settings-appearance-caret" aria-hidden="true" />
            </span>
          </AppearanceRow>

          <div className="settings-width-preview" aria-hidden="true">
            <i
              style={{
                width:
                  contentWidth === "narrow"
                    ? "45%"
                    : contentWidth === "wide"
                      ? "90%"
                      : "68%",
              }}
            />
          </div>
        </div>
        <div className="settings-appearance-group">
          <h3 className="settings-appearance-heading">
            {t("settings.design.detailsLayout")}
          </h3>
          <div className="settings-appearance-rule" />
          <AppearanceRow
            id="settings-appearance-file-icons"
            title={t("settings.appearance.fileIcons")}
            help={t("settings.appearance.fileIcons.help")}
          >
            <span className="settings-appearance-select">
              <select
                aria-labelledby="settings-appearance-file-icons"
                value={fileIcons}
                onChange={(event) =>
                  change(() =>
                    setFileIcons(event.target.value as FileIconStyle),
                  )
                }
              >
                {FILE_ICON_STYLES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {t(item.labelKey)}
                  </option>
                ))}
              </select>
              <span className="settings-appearance-caret" aria-hidden="true" />
            </span>
          </AppearanceRow>

          <div className="settings-appearance-rule" />
          <AppearanceRow
            id="settings-appearance-glass"
            title={t("settings.appearance.glass")}
            help={t("settings.appearance.glass.help")}
          >
            <button
              type="button"
              role="switch"
              aria-checked={glassEffects}
              aria-labelledby="settings-appearance-glass"
              className="settings-appearance-switch"
              onClick={() => change(() => setGlassEffects(!glassEffects))}
            />
          </AppearanceRow>

          <div className="settings-appearance-rule" />
          <div className="settings-appearance-row">
            <div>
              <span id="settings-density-label">
                {t("settings.appearance.density")}
              </span>
              <p>{t("settings.appearance.density.help")}</p>
            </div>
            <div className="settings-appearance-control">
              <div
                className="settings-radio-group"
                role="radiogroup"
                aria-labelledby="settings-density-label"
              >
                {densities.map((item) => (
                  <button
                    key={item.id}
                    role="radio"
                    aria-checked={density === item.id}
                    className={density === item.id ? "is-active" : ""}
                    title={t(item.hintKey)}
                    onClick={() => change(() => setDensity(item.id))}
                  >
                    <span>{t(item.labelKey)}</span>
                    <small>{t(item.hintKey)}</small>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
/* -------------------------------- shortcuts ------------------------------- */

const FIXED_SHORTCUTS = [
  {
    nameKey: "settings.shortcuts.fixed.send",
    keysKey: "settings.shortcuts.fixed.send.keys",
    keys: "Enter",
    icon: "send",
  },
  {
    nameKey: "settings.shortcuts.fixed.newline",
    keysKey: "settings.shortcuts.fixed.newline.keys",
    keys: "Shift + Enter",
    icon: "pencil",
  },
  {
    nameKey: "settings.shortcuts.fixed.close",
    keysKey: "settings.shortcuts.fixed.close.keys",
    keys: "Esc",
    icon: "panel",
  },
] satisfies {
  nameKey: string;
  keysKey: string;
  keys: string;
  icon: HomeIconName;
}[];

const SHORTCUT_ICONS: Record<KeybindingAction, HomeIconName> = {
  "open-settings": "settings",
  "send-task": "send",
  "go-home": "home",
  "focus-composer": "pencil",
  "go-templates": "grid",
};

function ShortcutKeys({ binding }: { binding: string }) {
  return (
    <span className="shortcut-keys" aria-label={binding}>
      {binding.split(" + ").map((key, index) => (
        <span className="shortcut-key-part" key={index} aria-hidden="true">
          {index > 0 && <span className="shortcut-plus"> + </span>}
          <kbd>{key}</kbd>
        </span>
      ))}
    </span>
  );
}

export function ShortcutsSettings({
  onError,
}: {
  onError(message: string): void;
}) {
  const keybindings = usePreferences((state) => state.keybindings);
  const [recording, setRecording] = useState<KeybindingAction | null>(null);
  const { show, view } = useNotice();
  const t = useT();
  useEffect(() => {
    if (!recording) return;
    const capture = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") {
        setRecording(null);
        show(t("settings.shortcuts.recordCancelled"));
        return;
      }
      const binding = bindingFromEvent(event);
      if (!binding) return;
      try {
        setKeybinding(recording, binding);
        onError("");
        show(
          t("settings.shortcuts.bound", { binding: formatBinding(binding) }),
        );
      } catch (error) {
        onError(
          error instanceof Error
            ? error.message
            : t("settings.shortcuts.err.fail"),
        );
      }
      setRecording(null);
    };
    const guardCancel = (event: Event) => {
      // Esc cancels the recording instead of closing the dialog.
      event.preventDefault();
    };
    window.addEventListener("keydown", capture, { capture: true });
    window.addEventListener("cancel", guardCancel, { capture: true });
    return () => {
      window.removeEventListener("keydown", capture, { capture: true });
      window.removeEventListener("cancel", guardCancel, { capture: true });
    };
  }, [recording, onError, show, t]);
  return (
    <section
      className="settings-shortcuts"
      aria-labelledby="settings-shortcuts-title"
    >
      <header className="shortcuts-header">
        <div className="shortcuts-header-icon" aria-hidden="true">
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <rect x="2" y="5" width="20" height="14" rx="3" />
            <path d="M6 9h1m4 0h1m4 0h1M6 12h1m4 0h1m4 0h1M8 15h8" />
          </svg>
        </div>
        <div>
          <h2 id="settings-shortcuts-title">{t("settings.shortcuts.title")}</h2>
          <p>{t("settings.shortcuts.subtitle")}</p>
        </div>
      </header>
      <div className="shortcuts-group-heading">
        <h3>{t("settings.shortcuts.custom")}</h3>
        <SourceBadge sourceKey="settings.source.local" />
      </div>
      <div className="shortcuts-actions">
        {KEYBINDING_ACTIONS.map((action) => (
          <div
            className={`shortcut-action${recording === action.id ? " is-recording" : ""}`}
            key={action.id}
          >
            <span className="shortcut-action-icon">
              <HomeIcon name={SHORTCUT_ICONS[action.id]} size={17} />
            </span>
            <div className="shortcut-description">
              <span>{t(action.labelKey)}</span>
              <p>{t(action.hintKey)}</p>
            </div>
            <div className="shortcut-binding-control">
              <ShortcutKeys binding={formatBinding(keybindings[action.id])} />
              <button
                className="shortcut-edit"
                aria-pressed={recording === action.id}
                aria-describedby={
                  recording === action.id
                    ? "shortcut-recording-hint"
                    : undefined
                }
                onClick={() =>
                  setRecording(recording === action.id ? null : action.id)
                }
              >
                <HomeIcon
                  name={recording === action.id ? "stop" : "pencil"}
                  size={13}
                />
                {t("settings.shortcuts.rerecord")}
              </button>
            </div>
            {recording === action.id && (
              <p
                className="shortcut-recording-hint"
                id="shortcut-recording-hint"
                role="status"
              >
                <span />
                {t("settings.shortcuts.recording")}
              </p>
            )}
          </div>
        ))}
      </div>
      <div className="shortcuts-tip">
        <HomeIcon name="help" size={15} />
        <span>{t("settings.shortcuts.tip")}</span>
      </div>
      <div className="shortcuts-group-heading shortcuts-fixed-heading">
        <h3>{t("settings.shortcuts.fixed")}</h3>
        <span className="shortcuts-readonly">
          {t("settings.shortcuts.readonly")}
        </span>
      </div>
      <dl className="shortcuts-fixed">
        {FIXED_SHORTCUTS.map((item) => (
          <div key={item.nameKey}>
            <dt>
              <HomeIcon name={item.icon} size={15} />
              {t(item.nameKey)}
            </dt>
            <dd title={t(item.keysKey)}>
              <ShortcutKeys binding={item.keys} />
            </dd>
          </div>
        ))}
      </dl>
      <footer className="shortcuts-footer">
        <span>
          <HomeIcon name="checkCircle" size={14} />
          {t("settings.shortcuts.autosave")}
        </span>
        <button
          className="shortcut-reset"
          title={
            t("settings.shortcuts.default") +
            KEYBINDING_ACTIONS.map(
              (action) =>
                `${t(action.labelKey)} ${formatBinding(DEFAULT_KEYBINDINGS[action.id])}`,
            ).join("; ")
          }
          onClick={() => {
            try {
              setRecording(null);
              resetKeybindings();
              onError("");
              show(t("settings.shortcuts.restored"));
            } catch {
              onError(t("settings.storageErrorShort"));
            }
          }}
        >
          <HomeIcon name="refresh" size={14} />
          {t("settings.shortcuts.reset")}
        </button>
      </footer>
      {view}
    </section>
  );
}

/* ------------------------------ personalization ------------------------------ */

export function PersonalSettings({
  onError,
}: {
  onError(message: string): void;
}) {
  const prefs = usePreferences();
  const modelOptions = useModelOptions();
  const { show, view } = useNotice();
  const t = useT();
  const change = (
    callback: () => void,
    done = t("settings.personal.savedDefault"),
  ) => {
    try {
      callback();
      onError("");
      show(done);
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : t("settings.storageErrorShort"),
      );
    }
  };
  const pickScene = (slot: number, id: string) => {
    const next = prefs.homeScenes.map((current, i) =>
      i === slot ? id : current,
    );
    change(() => setHomeScenes(next), t("settings.personal.scenesUpdated"));
  };
  return (
    <>
      <section aria-labelledby="settings-personal-defaults-title">
        <h2
          className="settings-section-label"
          id="settings-personal-defaults-title"
        >
          {t("settings.personal.defaults")}{" "}
          <SourceBadge sourceKey="settings.source.local" />
        </h2>
        {view}
        <div className="settings-card">
          <div className="settings-row">
            <div>
              <label htmlFor="settings-default-model">
                {t("settings.personal.model")}
              </label>
              <p>{t("settings.personal.model.help")}</p>
            </div>
            <select
              id="settings-default-model"
              value={prefs.defaultModel}
              onChange={(event) =>
                change(() =>
                  setComposerDefaults({ defaultModel: event.target.value }),
                )
              }
            >
              <option value="">{t("settings.personal.model.default")}</option>
              {modelOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
          <div className="settings-row">
            <div>
              <label htmlFor="settings-default-mode">
                {t("settings.personal.workmode")}
              </label>
              <p>{t("settings.personal.workmode.help")}</p>
            </div>
            <select
              id="settings-default-mode"
              value={prefs.defaultMode}
              onChange={(event) =>
                change(() =>
                  setComposerDefaults({
                    defaultMode: event.target.value as
                      | "office"
                      | "code"
                      | "design",
                  }),
                )
              }
            >
              {(
                Object.keys(modeLabels) as ("office" | "code" | "design")[]
              ).map((mode) => (
                <option key={mode} value={mode}>
                  {t(`home.mode.${mode}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="settings-row">
            <div>
              <label htmlFor="settings-default-workspace">
                {t("settings.personal.workspace")}
              </label>
              <p>{t("settings.personal.workspace.help")}</p>
            </div>
            <input
              id="settings-default-workspace"
              maxLength={40}
              placeholder={t("settings.personal.workspace.ph")}
              value={prefs.defaultWorkspace}
              onChange={(event) =>
                change(
                  () =>
                    setComposerDefaults({
                      defaultWorkspace: event.target.value,
                    }),
                  t("settings.personal.saved"),
                )
              }
              onBlur={(event) =>
                change(
                  () =>
                    setComposerDefaults({
                      defaultWorkspace: event.currentTarget.value.trim(),
                    }),
                  t("settings.personal.saved"),
                )
              }
            />
          </div>
          <div className="settings-row">
            <div>
              <label htmlFor="settings-default-permission">
                {t("settings.personal.permission")}
              </label>
              <p>{t("settings.personal.permission.help")}</p>
            </div>
            <input
              id="settings-default-permission"
              maxLength={40}
              placeholder={t("settings.personal.permission.ph")}
              value={prefs.defaultPermission}
              onChange={(event) =>
                change(
                  () =>
                    setComposerDefaults({
                      defaultPermission: event.target.value,
                    }),
                  t("settings.personal.saved"),
                )
              }
              onBlur={(event) =>
                change(
                  () =>
                    setComposerDefaults({
                      defaultPermission: event.currentTarget.value.trim(),
                    }),
                  t("settings.personal.saved"),
                )
              }
            />
          </div>
        </div>
      </section>
      <section aria-labelledby="settings-personal-scenes-title">
        <h2
          className="settings-section-label"
          id="settings-personal-scenes-title"
        >
          {t("settings.personal.scenes")}
        </h2>
        <p className="settings-group-help">
          {translate(prefs.locale, "settings.design.sceneHelp")}
        </p>
        <div className="settings-card settings-scenes-card">
          <div className="settings-scene-grid">
            {prefs.homeScenes.map((id, slot) => (
              <div className="settings-scene-slot" key={slot}>
                <span className="settings-scene-number">
                  {String(slot + 1).padStart(2, "0")}
                </span>
                <label htmlFor={`settings-scene-${slot}`}>
                  {t("settings.personal.slot", { n: slot + 1 })}
                </label>
                <select
                  id={`settings-scene-${slot}`}
                  value={id}
                  onChange={(event) => pickScene(slot, event.target.value)}
                >
                  {quickActionCatalog.map((item) => (
                    <option
                      key={item.id}
                      value={item.id}
                      disabled={
                        prefs.homeScenes.includes(item.id) && item.id !== id
                      }
                    >
                      {item.title} · {t(`home.mode.${item.mode}`)}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="settings-row">
            <div>
              <span>{t("settings.personal.restore")}</span>
              <p>{t("settings.personal.restore.help")}</p>
            </div>
            <button
              onClick={() =>
                change(
                  () => resetHomeScenes(),
                  t("settings.personal.scenesRestored"),
                )
              }
            >
              {t("settings.shortcuts.reset")}
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

/* --------------------------------- devices --------------------------------- */

type SessionInfo = { kind: string; username: string | null; id: string } | null;

export function DevicesSettings({
  onError,
}: {
  onError(message: string): void;
}) {
  const [session, setSession] = useState<SessionInfo | undefined>(undefined);
  const [sessionError, setSessionError] = useState("");
  const { show, view } = useNotice();
  const fileRef = useRef<HTMLInputElement>(null);
  const t = useT();
  const refresh = async () => {
    setSessionError("");
    try {
      const data = await apiJSON<{
        user: { kind: string; username: string | null; id: string };
      }>("/auth/me");
      setSession(data.user);
    } catch (error) {
      setSession(null);
      setSessionError(
        error instanceof Error
          ? error.message
          : t("settings.devices.identityFailMsg"),
      );
    }
  };
  useEffect(() => {
    void refresh();
  }, []);
  const wipe = () => {
    if (!window.confirm(t("settings.devices.wipe.confirm"))) return;
    if (!window.confirm(t("settings.devices.wipe.confirm2"))) return;
    try {
      clearDataGroup("all");
      localStorage.removeItem("designbuddy.auth-token.v1");
      let sessionStorageFailed = false;
      try {
        sessionStorage.clear();
      } catch {
        sessionStorageFailed = true;
      }
      resetAPISession();
      onError(
        sessionStorageFailed ? t("settings.data.sessionStorageFail") : "",
      );
    } catch (error) {
      onError(
        error instanceof Error ? error.message : t("settings.data.wipeFail"),
      );
    } finally {
      reloadAfterDataChange();
    }
  };
  const identity =
    sessionError ||
    (session === undefined
      ? t("settings.devices.loading")
      : session
        ? `${session.kind === "account" ? t("settings.devices.account", { name: session.username ?? "" }) : t("settings.devices.guest")} · ${session.id}`
        : t("settings.devices.identityFail"));
  return (
    <>
      <section aria-labelledby="settings-devices-session-title">
        <h2
          className="settings-section-label"
          id="settings-devices-session-title"
        >
          {t("settings.devices.session")}{" "}
          <SourceBadge sourceKey="settings.source.server" />
        </h2>
        {view}
        <div className="settings-card">
          <div className="settings-row">
            <div>
              <span>{t("settings.devices.identity")}</span>
              <p>{identity}</p>
            </div>
            <button onClick={() => void refresh()}>
              {t("settings.devices.refresh")}
            </button>
          </div>
        </div>
      </section>
      <DeviceRecords />
      <section aria-labelledby="settings-devices-migrate-title">
        <h2
          className="settings-section-label"
          id="settings-devices-migrate-title"
        >
          {t("settings.devices.transfer")}{" "}
          <SourceBadge sourceKey="settings.source.local" />
        </h2>
        <div className="settings-card">
          <div className="settings-row">
            <div>
              <span>{t("settings.devices.export")}</span>
              <p>{t("settings.devices.export.help")}</p>
            </div>
            <button
              onClick={() => {
                try {
                  exportSettings();
                  onError("");
                  show(t("settings.devices.exported"));
                } catch {
                  onError(t("settings.devices.exportFail"));
                }
              }}
            >
              {t("settings.devices.export.go")}
            </button>
          </div>
          <div className="settings-row">
            <div>
              <span>{t("settings.devices.import")}</span>
              <p>{t("settings.devices.import.help")}</p>
            </div>
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                aria-label={t("settings.devices.import.pick")}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  void importSettings(file)
                    .then(() => {
                      onError("");
                      show(t("settings.devices.imported"));
                    })
                    .catch((error: unknown) =>
                      onError(
                        error instanceof Error
                          ? error.message
                          : t("settings.devices.importFail"),
                      ),
                    );
                }}
              />
            </div>
          </div>
          <div className="settings-row">
            <div>
              <span>{t("settings.devices.note")}</span>
              <p>{t("settings.devices.note.help")}</p>
            </div>
          </div>
        </div>
      </section>
      <section className="settings-hub-group is-danger">
        <h2 className="settings-section-label">
          {t("settings.design.danger")}
        </h2>
        <p className="settings-group-help">{t("settings.design.dangerHelp")}</p>
        <div className="settings-card">
          {" "}
          <div className="settings-row">
            <div>
              <span>{t("settings.devices.wipe")}</span>
              <p>{t("settings.devices.wipe.help")}</p>
            </div>
            <button className="settings-danger" onClick={wipe}>
              {t("settings.devices.wipe.go")}
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

/* ---------------------------------- data ---------------------------------- */

export function DataSettings({ onError }: { onError(message: string): void }) {
  const [inventory, setInventory] = useState(storageInventory);
  const { show, view } = useNotice();
  const fileRef = useRef<HTMLInputElement>(null);
  const t = useT();
  const refresh = () => setInventory(storageInventory());
  const max = Math.max(
    1,
    ...inventory.rows.map((row) => row.bytes),
    inventory.otherBytes,
  );
  return (
    <>
      <section aria-labelledby="settings-data-usage-title">
        <h2 className="settings-section-label" id="settings-data-usage-title">
          {t("settings.data.usage")}{" "}
          <SourceBadge sourceKey="settings.source.local" />
        </h2>
        {view}
        <div className="settings-storage-summary">
          <span className="settings-tile-icon">
            <HomeIcon name="chart" size={22} />
          </span>
          <div>
            <span>{t("settings.design.storage")}</span>
            <strong>{formatBytes(inventory.totalBytes)}</strong>
          </div>
          <p>{t("settings.design.storageHelp")}</p>
        </div>
        <div className="settings-card">
          {inventory.rows.map((row) => (
            <div className="settings-row" key={row.group.id}>
              <div>
                <span>
                  {t(row.group.labelKey)} ·{" "}
                  {t("settings.data.items", { n: row.keys })} ·{" "}
                  {formatBytes(row.bytes)}
                </span>
                <p>{t(row.group.hintKey)}</p>
                <div className="settings-meter" aria-hidden="true">
                  <i
                    style={{
                      width: `${Math.max(row.bytes > 0 ? 2 : 0, (row.bytes / max) * 100)}%`,
                    }}
                  />
                </div>
              </div>
              <button
                disabled={row.keys === 0}
                onClick={() => {
                  const label = t(row.group.labelKey);
                  if (
                    !window.confirm(
                      t("settings.data.clearGroup.confirm", {
                        label,
                        n: row.keys,
                      }),
                    )
                  )
                    return;
                  try {
                    const removed = clearDataGroup(row.group.id);
                    refresh();
                    onError("");
                    show(t("settings.data.cleared", { label, n: removed }));
                    reloadAfterDataChange();
                  } catch (error) {
                    onError(
                      error instanceof Error
                        ? error.message
                        : t("settings.data.clearFail"),
                    );
                  }
                }}
              >
                {t("settings.data.clearGroup.go")}
              </button>
            </div>
          ))}
          <div className="settings-row">
            <div>
              <span>
                {t("settings.data.total")} ·{" "}
                {t("settings.data.items", { n: inventory.totalKeys })} ·{" "}
                {formatBytes(inventory.totalBytes)}
              </span>
              <p>{t("settings.data.tokenNote", { n: inventory.otherKeys })}</p>
            </div>
            <button onClick={refresh}>{t("settings.data.recount")}</button>
          </div>
        </div>
      </section>
      <section aria-labelledby="settings-data-backup-title">
        <h2 className="settings-section-label" id="settings-data-backup-title">
          {t("settings.data.backup")}
        </h2>
        <div className="settings-card">
          <div className="settings-row">
            <div>
              <span>{t("settings.data.exportBackup")}</span>
              <p>{t("settings.data.exportBackup.help")}</p>
            </div>
            <button
              onClick={() => {
                try {
                  const count = exportAllData();
                  onError("");
                  show(t("settings.data.backupDone", { n: count }));
                } catch {
                  onError(t("settings.devices.exportFail"));
                }
              }}
            >
              {t("settings.data.exportBackup.go")}
            </button>
          </div>
          <div className="settings-row">
            <div>
              <span>{t("settings.data.importBackup")}</span>
              <p>{t("settings.data.importBackup.help")}</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              aria-label={t("settings.data.importBackup.pick")}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                void importAllData(file)
                  .then((count) => {
                    refresh();
                    onError("");
                    show(t("settings.data.restored", { n: count }));
                    reloadAfterDataChange();
                  })
                  .catch((error: unknown) =>
                    onError(
                      error instanceof Error
                        ? error.message
                        : t("settings.devices.importFail"),
                    ),
                  );
              }}
            />
          </div>
        </div>
      </section>
      <section className="settings-hub-group is-danger">
        <h2 className="settings-section-label">
          {t("settings.design.danger")}
        </h2>
        <p className="settings-group-help">{t("settings.design.dangerHelp")}</p>
        <div className="settings-card">
          {" "}
          <div className="settings-row">
            <div>
              <span>{t("settings.data.wipe")}</span>
              <p>{t("settings.data.wipe.help")}</p>
            </div>
            <button
              className="settings-danger"
              onClick={() => {
                if (!window.confirm(t("settings.data.wipe.confirm"))) return;
                if (!window.confirm(t("settings.data.wipe.confirm2"))) return;
                try {
                  const removed = clearDataGroup("all");
                  let sessionStorageFailed = false;
                  try {
                    sessionStorage.clear();
                  } catch {
                    sessionStorageFailed = true;
                  }
                  refresh();
                  onError(
                    sessionStorageFailed
                      ? t("settings.data.sessionStorageFail")
                      : "",
                  );
                  show(t("settings.data.wiped", { n: removed }));
                  reloadAfterDataChange();
                } catch (error) {
                  onError(
                    error instanceof Error
                      ? error.message
                      : t("settings.data.wipeFail"),
                  );
                }
              }}
            >
              {t("settings.data.wipe.go")}
            </button>
          </div>
        </div>
      </section>
      <section>
        <h2 className="settings-section-label">
          {t("settings.design.accountData")}
        </h2>
        <div className="settings-card">
          {" "}
          <div className="settings-row">
            <div>
              <span>{t("settings.data.cloud")}</span>
              <p>{t("settings.data.cloud.help")}</p>
            </div>
            <button
              onClick={() => {
                closeSettings();
                navigateTo("/profile");
              }}
            >
              {t("settings.data.cloud.go")}
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

/* ---------------------------------- plan ---------------------------------- */

export function PlanUpgradeDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose(): void;
}) {
  const element = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = element.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={element}
      className="settings-plan-dialog"
      aria-labelledby="settings-plan-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <header className="settings-plan-dialog__header">
        <h2 id="settings-plan-dialog-title">付费套餐暂未接入</h2>
        <button
          type="button"
          className="settings-plan-dialog__close"
          aria-label="关闭升级说明"
          onClick={onClose}
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
          onClick={onClose}
        >
          知道了
        </button>
      </div>
    </dialog>
  );
}

function PlanCreditsPanel() {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const t = useSettingsCopy();
  return (
    <>
      <div
        className="settings-edition-card"
        role="region"
        aria-label={t("billing")}
      >
        <span className="settings-edition-icon">
          <HomeIcon name="bolt" size={23} />
        </span>
        <div>
          <span className="settings-status-tag">Free</span>
          <h3>{t("billing")}</h3>
          <p>{t("billingHelp")}</p>
        </div>
        <button
          className="settings-button"
          onClick={() => setUpgradeOpen(true)}
        >
          {t("planInfo")}
        </button>
      </div>
      <div
        className="settings-credit-status"
        role="region"
        aria-label={t("credits")}
      >
        <div>
          <span>{t("credits")}</span>
          <strong>—</strong>
        </div>
        <span className="settings-status-tag">{t("notConnected")}</span>
        <p>{t("creditsHelp")}</p>
      </div>
      <PlanUpgradeDialog
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
      />
    </>
  );
}

export function PlanSettings() {
  const [stats, setStats] = useState(usageStats);
  const t = useT();
  return (
    <>
      <section aria-labelledby="settings-plan-credits-title">
        <h2 className="settings-section-label" id="settings-plan-credits-title">
          {t("settings.plan.current")}
        </h2>
        <PlanCreditsPanel />
      </section>
      <section aria-labelledby="settings-plan-title">
        <h2 className="settings-section-label" id="settings-plan-title">
          {t("settings.plan.title")}{" "}
          <SourceBadge sourceKey="settings.source.local" />
        </h2>
        <div className="settings-card">
          <div className="settings-row">
            <div>
              <span>{t("settings.plan.current")}</span>
              <p>{t("settings.plan.current.help")}</p>
            </div>
            <button onClick={() => setStats(usageStats())}>
              {t("settings.plan.refresh")}
            </button>
          </div>
          <dl className="settings-shortcut-list settings-usage-list">
            <div>
              <dt>{t("settings.plan.projects")}</dt>
              <dd>
                {t("settings.plan.count.projects", { n: stats.projects })}
              </dd>
            </div>
            <div>
              <dt>{t("settings.plan.conversations")}</dt>
              <dd>
                {t("settings.plan.count.conversations", {
                  n: stats.conversations,
                })}
              </dd>
            </div>
            <div>
              <dt>{t("settings.plan.copies")}</dt>
              <dd>
                {t("settings.plan.count.copies", { n: stats.templateDrafts })}
              </dd>
            </div>
            <div>
              <dt>{t("settings.plan.edits")}</dt>
              <dd>
                {t("settings.plan.count.edits", { n: stats.templateStates })}
              </dd>
            </div>
            <div>
              <dt>{t("settings.plan.models")}</dt>
              <dd>
                {t("settings.plan.count.models", { n: stats.customModels })}
              </dd>
            </div>
            <div>
              <dt>{t("settings.plan.storage")}</dt>
              <dd>{formatBytes(stats.storageBytes)}</dd>
            </div>
          </dl>
          <p className="settings-card-foot">{t("settings.plan.footnote")}</p>
        </div>
      </section>
    </>
  );
}
