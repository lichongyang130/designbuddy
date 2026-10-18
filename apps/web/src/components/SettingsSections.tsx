import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_KEYBINDINGS,
  KEYBINDING_ACTIONS,
  bindingFromEvent,
  formatBinding,
  resetHomeScenes,
  resetKeybindings,
  setComposerDefaults,
  setDensity,
  setHomeScenes,
  setKeybinding,
  setTheme,
  useModelOptions,
  usePreferences,
  type DensityMode,
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
import { translate, type I18nParams } from "../../../../frontend/workspace/i18n";
import { apiJSON, resetAPISession } from "../api/client";
import { modeLabels, quickActionCatalog } from "./homeScenes";

type T = (key: string, params?: I18nParams) => string;
function useT(): T {
  const locale = usePreferences((state) => state.locale);
  return (key, params) => translate(locale, key, params);
}

/** Where a setting lives. Everything new here is local-first and honest. */
export function SourceBadge({ sourceKey }: { sourceKey: "settings.source.local" | "settings.source.server" }) {
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

export function AppearanceSettings({ onError }: { onError(message: string): void }) {
  const theme = usePreferences((state) => state.theme);
  const density = usePreferences((state) => state.density);
  const t = useT();
  const change = (callback: () => void) => {
    try {
      callback();
      onError("");
    } catch {
      onError(t("settings.storageError"));
    }
  };
  const themes: { id: ThemeMode; labelKey: string; hintKey: string }[] = [
    { id: "system", labelKey: "settings.appearance.theme.system", hintKey: "settings.appearance.theme.system.hint" },
    { id: "light", labelKey: "settings.appearance.theme.light", hintKey: "settings.appearance.theme.light.hint" },
    { id: "dark", labelKey: "settings.appearance.theme.dark", hintKey: "settings.appearance.theme.dark.hint" },
  ];
  const densities: { id: DensityMode; labelKey: string; hintKey: string }[] = [
    { id: "comfortable", labelKey: "settings.appearance.density.comfort", hintKey: "settings.appearance.density.comfort.hint" },
    { id: "compact", labelKey: "settings.appearance.density.compact", hintKey: "settings.appearance.density.compact.hint" },
  ];
  return (
    <section aria-labelledby="settings-appearance-title">
      <h2 className="settings-section-label" id="settings-appearance-title">
        {t("settings.appearance.title")} <SourceBadge sourceKey="settings.source.local" />
      </h2>
      <div className="settings-card">
        <div className="settings-row">
          <div>
            <span id="settings-theme-label">{t("settings.appearance.theme")}</span>
            <p>{t("settings.appearance.theme.help")}</p>
          </div>
          <div className="settings-radio-group" role="radiogroup" aria-labelledby="settings-theme-label">
            {themes.map((item) => (
              <button
                key={item.id}
                role="radio"
                aria-checked={theme === item.id}
                className={theme === item.id ? "is-active" : ""}
                title={t(item.hintKey)}
                onClick={() => change(() => setTheme(item.id))}
              >
                <span>{t(item.labelKey)}</span>
                <small>{t(item.hintKey)}</small>
              </button>
            ))}
          </div>
        </div>
        <div className="settings-row">
          <div>
            <span id="settings-density-label">{t("settings.appearance.density")}</span>
            <p>{t("settings.appearance.density.help")}</p>
          </div>
          <div className="settings-radio-group" role="radiogroup" aria-labelledby="settings-density-label">
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
    </section>
  );
}

/* -------------------------------- shortcuts ------------------------------- */

const FIXED_SHORTCUTS: [string, string][] = [
  ["settings.shortcuts.fixed.send", "settings.shortcuts.fixed.send.keys"],
  ["settings.shortcuts.fixed.newline", "settings.shortcuts.fixed.newline.keys"],
  ["settings.shortcuts.fixed.close", "settings.shortcuts.fixed.close.keys"],
];

export function ShortcutsSettings({ onError }: { onError(message: string): void }) {
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
        show(t("settings.shortcuts.bound", { binding: formatBinding(binding) }));
      } catch (error) {
        onError(error instanceof Error ? error.message : t("settings.shortcuts.err.fail"));
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
    <section aria-labelledby="settings-shortcuts-title">
      <h2 className="settings-section-label" id="settings-shortcuts-title">
        {t("settings.shortcuts.title")} <SourceBadge sourceKey="settings.source.local" />
      </h2>
      {view}
      <div className="settings-card">
        {KEYBINDING_ACTIONS.map((action) => (
          <div className="settings-row" key={action.id}>
            <div>
              <span>{t(action.labelKey)}</span>
              <p>{t(action.hintKey)}</p>
            </div>
            <div className="settings-keybinding">
              <kbd className="settings-keycap">{formatBinding(keybindings[action.id])}</kbd>
              <button onClick={() => setRecording(action.id)}>
                {recording === action.id ? t("settings.shortcuts.recording") : t("settings.shortcuts.rerecord")}
              </button>
            </div>
          </div>
        ))}
        <div className="settings-row">
          <div>
            <span>{t("settings.shortcuts.reset")}</span>
            <p>
              {t("settings.shortcuts.default")}{KEYBINDING_ACTIONS.map((action) => `${t(action.labelKey)} ${formatBinding(DEFAULT_KEYBINDINGS[action.id])}`).join("；")}
            </p>
          </div>
          <button
            onClick={() => {
              try {
                resetKeybindings();
                onError("");
                show(t("settings.shortcuts.restored"));
              } catch {
                onError(t("settings.storageErrorShort"));
              }
            }}
          >
            {t("settings.shortcuts.reset")}
          </button>
        </div>
      </div>
      <h2 className="settings-section-label">{t("settings.shortcuts.fixed")}</h2>
      <div className="settings-card">
        <dl className="settings-shortcut-list">
          {FIXED_SHORTCUTS.map(([nameKey, keysKey]) => (
            <div key={nameKey}>
              <dt>{t(nameKey)}</dt>
              <dd>{t(keysKey)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ------------------------------ personalization ------------------------------ */

export function PersonalSettings({ onError }: { onError(message: string): void }) {
  const prefs = usePreferences();
  const modelOptions = useModelOptions();
  const { show, view } = useNotice();
  const t = useT();
  const change = (callback: () => void, done = t("settings.personal.savedDefault")) => {
    try {
      callback();
      onError("");
      show(done);
    } catch (error) {
      onError(error instanceof Error ? error.message : t("settings.storageErrorShort"));
    }
  };
  const pickScene = (slot: number, id: string) => {
    const next = prefs.homeScenes.map((current, i) => (i === slot ? id : current));
    change(() => setHomeScenes(next), t("settings.personal.scenesUpdated"));
  };
  return (
    <>
      <section aria-labelledby="settings-personal-defaults-title">
        <h2 className="settings-section-label" id="settings-personal-defaults-title">
          {t("settings.personal.defaults")} <SourceBadge sourceKey="settings.source.local" />
        </h2>
        {view}
        <div className="settings-card">
          <div className="settings-row">
            <div>
              <label htmlFor="settings-default-model">{t("settings.personal.model")}</label>
              <p>{t("settings.personal.model.help")}</p>
            </div>
            <select
              id="settings-default-model"
              value={prefs.defaultModel}
              onChange={(event) => change(() => setComposerDefaults({ defaultModel: event.target.value }))}
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
              <label htmlFor="settings-default-mode">{t("settings.personal.workmode")}</label>
              <p>{t("settings.personal.workmode.help")}</p>
            </div>
            <select
              id="settings-default-mode"
              value={prefs.defaultMode}
              onChange={(event) =>
                change(() => setComposerDefaults({ defaultMode: event.target.value as "office" | "code" | "design" }))
              }
            >
              {(Object.keys(modeLabels) as ("office" | "code" | "design")[]).map((mode) => (
                <option key={mode} value={mode}>
                  {t(`home.mode.${mode}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="settings-row">
            <div>
              <label htmlFor="settings-default-workspace">{t("settings.personal.workspace")}</label>
              <p>{t("settings.personal.workspace.help")}</p>
            </div>
            <input
              id="settings-default-workspace"
              maxLength={40}
              placeholder={t("settings.personal.workspace.ph")}
              value={prefs.defaultWorkspace}
              onChange={(event) => change(() => setComposerDefaults({ defaultWorkspace: event.target.value }), t("settings.personal.saved"))}
              onBlur={(event) => change(() => setComposerDefaults({ defaultWorkspace: event.currentTarget.value.trim() }), t("settings.personal.saved"))}
            />
          </div>
          <div className="settings-row">
            <div>
              <label htmlFor="settings-default-permission">{t("settings.personal.permission")}</label>
              <p>{t("settings.personal.permission.help")}</p>
            </div>
            <input
              id="settings-default-permission"
              maxLength={40}
              placeholder={t("settings.personal.permission.ph")}
              value={prefs.defaultPermission}
              onChange={(event) => change(() => setComposerDefaults({ defaultPermission: event.target.value }), t("settings.personal.saved"))}
              onBlur={(event) => change(() => setComposerDefaults({ defaultPermission: event.currentTarget.value.trim() }), t("settings.personal.saved"))}
            />
          </div>
        </div>
      </section>
      <section aria-labelledby="settings-personal-scenes-title">
        <h2 className="settings-section-label" id="settings-personal-scenes-title">
          {t("settings.personal.scenes")}
        </h2>
        <div className="settings-card">
          {prefs.homeScenes.map((id, slot) => (
            <div className="settings-row" key={slot}>
              <label htmlFor={`settings-scene-${slot}`}>{t("settings.personal.slot", { n: slot + 1 })}</label>
              <select id={`settings-scene-${slot}`} value={id} onChange={(event) => pickScene(slot, event.target.value)}>
                {quickActionCatalog.map((item) => (
                  <option key={item.id} value={item.id} disabled={prefs.homeScenes.includes(item.id) && item.id !== id}>
                    {item.title} · {t(`home.mode.${item.mode}`)}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <div className="settings-row">
            <div>
              <span>{t("settings.personal.restore")}</span>
              <p>{t("settings.personal.restore.help")}</p>
            </div>
            <button onClick={() => change(() => resetHomeScenes(), t("settings.personal.scenesRestored"))}>{t("settings.shortcuts.reset")}</button>
          </div>
        </div>
      </section>
    </>
  );
}

/* --------------------------------- devices --------------------------------- */

type SessionInfo = { kind: string; username: string | null; id: string } | null;

export function DevicesSettings({ onError }: { onError(message: string): void }) {
  const [session, setSession] = useState<SessionInfo | undefined>(undefined);
  const [sessionError, setSessionError] = useState("");
  const { show, view } = useNotice();
  const fileRef = useRef<HTMLInputElement>(null);
  const t = useT();
  const refresh = async () => {
    setSessionError("");
    try {
      const data = await apiJSON<{ user: { kind: string; username: string | null; id: string } }>("/auth/me");
      setSession(data.user);
    } catch (error) {
      setSession(null);
      setSessionError(error instanceof Error ? error.message : t("settings.devices.identityFailMsg"));
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
      onError(sessionStorageFailed ? t("settings.data.sessionStorageFail") : "");
    } catch (error) {
      onError(error instanceof Error ? error.message : t("settings.data.wipeFail"));
    } finally {
      reloadAfterDataChange();
    }
  };
  const identity = sessionError ||
    (session === undefined
      ? t("settings.devices.loading")
      : session
        ? `${session.kind === "account" ? t("settings.devices.account", { name: session.username ?? "" }) : t("settings.devices.guest")} · ${session.id}`
        : t("settings.devices.identityFail"));
  return (
    <>
      <section aria-labelledby="settings-devices-session-title">
        <h2 className="settings-section-label" id="settings-devices-session-title">
          {t("settings.devices.session")} <SourceBadge sourceKey="settings.source.server" />
        </h2>
        {view}
        <div className="settings-card">
          <div className="settings-row">
            <div>
              <span>{t("settings.devices.identity")}</span>
              <p>{identity}</p>
            </div>
            <button onClick={() => void refresh()}>{t("settings.devices.refresh")}</button>
          </div>
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
      <section aria-labelledby="settings-devices-migrate-title">
        <h2 className="settings-section-label" id="settings-devices-migrate-title">
          {t("settings.devices.transfer")} <SourceBadge sourceKey="settings.source.local" />
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
                    .catch((error: unknown) => onError(error instanceof Error ? error.message : t("settings.devices.importFail")));
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
  const max = Math.max(1, ...inventory.rows.map((row) => row.bytes), inventory.otherBytes);
  return (
    <>
      <section aria-labelledby="settings-data-usage-title">
        <h2 className="settings-section-label" id="settings-data-usage-title">
          {t("settings.data.usage")} <SourceBadge sourceKey="settings.source.local" />
        </h2>
        {view}
        <div className="settings-card">
          {inventory.rows.map((row) => (
            <div className="settings-row" key={row.group.id}>
              <div>
                <span>
                  {t(row.group.labelKey)} · {t("settings.data.items", { n: row.keys })} · {formatBytes(row.bytes)}
                </span>
                <p>{t(row.group.hintKey)}</p>
                <div className="settings-meter" aria-hidden="true">
                  <i style={{ width: `${Math.max(row.bytes > 0 ? 2 : 0, (row.bytes / max) * 100)}%` }} />
                </div>
              </div>
              <button
                disabled={row.keys === 0}
                onClick={() => {
                  const label = t(row.group.labelKey);
                  if (!window.confirm(t("settings.data.clearGroup.confirm", { label, n: row.keys }))) return;
                  try {
                    const removed = clearDataGroup(row.group.id);
                    refresh();
                    onError("");
                    show(t("settings.data.cleared", { label, n: removed }));
                    reloadAfterDataChange();
                  } catch (error) {
                    onError(error instanceof Error ? error.message : t("settings.data.clearFail"));
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
                {t("settings.data.total")} · {t("settings.data.items", { n: inventory.totalKeys })} · {formatBytes(inventory.totalBytes)}
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
                  .catch((error: unknown) => onError(error instanceof Error ? error.message : t("settings.devices.importFail")));
              }}
            />
          </div>
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
                  onError(sessionStorageFailed ? t("settings.data.sessionStorageFail") : "");
                  show(t("settings.data.wiped", { n: removed }));
                  reloadAfterDataChange();
                } catch (error) {
                  onError(error instanceof Error ? error.message : t("settings.data.wipeFail"));
                }
              }}
            >
              {t("settings.data.wipe.go")}
            </button>
          </div>
          <div className="settings-row">
            <div>
              <span>{t("settings.data.cloud")}</span>
              <p>{t("settings.data.cloud.help")}</p>
            </div>
            <button
              onClick={() => {
                window.location.assign("/profile");
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

export function PlanSettings() {
  const [stats, setStats] = useState(usageStats);
  const t = useT();
  return (
    <section aria-labelledby="settings-plan-title">
      <h2 className="settings-section-label" id="settings-plan-title">
        {t("settings.plan.title")} <SourceBadge sourceKey="settings.source.local" />
      </h2>
      <div className="settings-card">
        <div className="settings-row">
          <div>
            <span>{t("settings.plan.current")}</span>
            <p>{t("settings.plan.current.help")}</p>
          </div>
          <button onClick={() => setStats(usageStats())}>{t("settings.plan.refresh")}</button>
        </div>
        <dl className="settings-shortcut-list settings-usage-list">
          <div>
            <dt>{t("settings.plan.projects")}</dt>
            <dd>{t("settings.plan.count.projects", { n: stats.projects })}</dd>
          </div>
          <div>
            <dt>{t("settings.plan.conversations")}</dt>
            <dd>{t("settings.plan.count.conversations", { n: stats.conversations })}</dd>
          </div>
          <div>
            <dt>{t("settings.plan.copies")}</dt>
            <dd>{t("settings.plan.count.copies", { n: stats.templateDrafts })}</dd>
          </div>
          <div>
            <dt>{t("settings.plan.edits")}</dt>
            <dd>{t("settings.plan.count.edits", { n: stats.templateStates })}</dd>
          </div>
          <div>
            <dt>{t("settings.plan.models")}</dt>
            <dd>{t("settings.plan.count.models", { n: stats.customModels })}</dd>
          </div>
          <div>
            <dt>{t("settings.plan.storage")}</dt>
            <dd>{formatBytes(stats.storageBytes)}</dd>
          </div>
        </dl>
        <p className="settings-card-foot">{t("settings.plan.footnote")}</p>
      </div>
    </section>
  );
}
