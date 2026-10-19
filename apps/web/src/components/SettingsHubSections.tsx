import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { HomeIcon, type HomeIconName } from "./HomeIcon";
import {
  translate,
  type I18nParams,
} from "../../../../frontend/workspace/i18n";
import {
  closeSettings,
  usePreferences,
  setExpertConfiguration,
  resetExpertConfiguration,
  setAssistantPreferences,
} from "../../../../frontend/workspace/settingsStore";
import { navigateTo } from "../../../../frontend/workspace/workspaceRoutes";
import {
  fetchAccount,
  updateAccountProfile,
  changeAccountPassword,
  fetchAccountAudit,
} from "../../../../frontend/workspace/api/account";
import {
  fetchProfile,
  addProfileMemory,
  deleteProfileMemory,
  clearProfileMemories,
} from "../../../../frontend/workspace/api/profile";
import {
  expertCatalog,
  customExpertCatalog,
  configureExpert,
} from "../../../../frontend/workspace/expertCatalog";
import { useWorkspaceStore } from "../../../../frontend/workspace/store";
import {
  fetchPluginBundles,
  setPluginBundleStatus,
  installPluginBundle,
  uninstallPluginBundle,
} from "../../../../frontend/workspace/api/plugins";
import { connectorCatalog } from "../../../../frontend/workspace/connectorCatalog";
import type { Connector } from "../../../../frontend/workspace/models/workspace";
import {
  beginConnectorOAuth,
  disconnectConnector,
  listConnectors,
} from "../../../../frontend/workspace/api/connectors";

export function useSettingsCopy() {
  const locale = usePreferences((state) => state.locale);
  return (key: string, params?: I18nParams) =>
    translate(locale, `settings.design.${key}`, params);
}

function go(path: string) {
  closeSettings();
  navigateTo(path);
}

/** Discards stale reads after navigation, and exposes errors instead of empty fake data. */
function useResource<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    loader()
      .then((value) => {
        if (active) setData(value);
      })
      .catch((cause: unknown) => {
        if (active) {
          setData(null);
          setUnavailable(
            Boolean(
              cause &&
                typeof cause === "object" &&
                "code" in cause &&
                cause.code === "NOT_CONFIGURED",
            ),
          );
          setError("failure");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loader, revision]);
  return { data, error, unavailable, loading, reload };
}

function ResourceState({
  resource,
  children,
}: {
  resource: { loading: boolean; error: string; reload(): void };
  children: ReactNode;
}) {
  const t = useSettingsCopy();
  if (resource.loading)
    return (
      <div className="settings-loading" role="status">
        <span />
        {t("loading")}
      </div>
    );
  if (resource.error)
    return (
      <div className="settings-empty">
        <HomeIcon name="help" size={25} />
        <p role="alert">{t(resource.error)}</p>
        <button className="settings-button" onClick={resource.reload}>
          {t("retry")}
        </button>
      </div>
    );
  return <>{children}</>;
}

export function SettingsEmpty({
  icon,
  title,
  help,
  children,
}: {
  icon: HomeIconName;
  title: string;
  help?: string;
  children?: ReactNode;
}) {
  return (
    <div className="settings-empty">
      <span className="settings-empty-icon">
        <HomeIcon name={icon} size={24} />
      </span>
      <h3>{title}</h3>
      {help && <p>{help}</p>}
      {children}
    </div>
  );
}

export function SettingsGroup({
  title,
  help,
  children,
  danger = false,
}: {
  title: string;
  help?: string;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <section
      className={danger ? "settings-hub-group is-danger" : "settings-hub-group"}
    >
      <h2 className="settings-section-label">{title}</h2>
      {help && <p className="settings-group-help">{help}</p>}
      <div className="settings-card">{children}</div>
    </section>
  );
}

function Feedback({ error, notice }: { error: string; notice: string }) {
  return (
    <>
      {error && (
        <p className="settings-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="settings-notice" role="status">
          {notice}
        </p>
      )}
    </>
  );
}

export function ProfileSettings() {
  const resource = useResource(fetchAccount);
  const t = useSettingsCopy();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ displayName: "", email: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const account = resource.data;
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await updateAccountProfile({
        displayName: draft.displayName.trim(),
        email: draft.email.trim(),
      });
      setEditing(false);
      setNotice(t("saved"));
      resource.reload();
      window.dispatchEvent(new Event("designbuddy:server-identity"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("failure"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <ResourceState resource={resource}>
        {account && (
          <SettingsGroup title={t("identity")}>
            <div className="settings-profile-identity">
              <span className="settings-profile-avatar">
                {(account.displayName || account.username || "D")
                  .slice(0, 1)
                  .toUpperCase()}
              </span>
              <div>
                <h3>{account.displayName || account.username || t("guest")}</h3>
                <p>{account.username ? `@${account.username}` : t("guest")}</p>
              </div>
              <span className="settings-status-tag">
                {t(account.kind === "account" ? "account" : "guest")}
              </span>
            </div>
            {editing ? (
              <form className="settings-edit-form" onSubmit={save}>
                <label>
                  {t("displayName")}
                  <input
                    maxLength={40}
                    value={draft.displayName}
                    onChange={(event) =>
                      setDraft({ ...draft, displayName: event.target.value })
                    }
                  />
                </label>
                <label>
                  {t("email")}
                  <input
                    type="email"
                    maxLength={120}
                    value={draft.email}
                    onChange={(event) =>
                      setDraft({ ...draft, email: event.target.value })
                    }
                  />
                </label>
                <div className="settings-form-actions">
                  <button
                    type="button"
                    className="settings-button"
                    disabled={busy}
                    onClick={() => {
                      setEditing(false);
                      setError("");
                    }}
                  >
                    {t("cancel")}
                  </button>
                  <button
                    className="settings-button is-primary"
                    disabled={busy}
                  >
                    {t(busy ? "busy" : "save")}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <dl className="settings-detail-list">
                  <div>
                    <dt>{t("username")}</dt>
                    <dd>{account.username || "—"}</dd>
                  </div>
                  <div>
                    <dt>{t("email")}</dt>
                    <dd>{account.email || "—"}</dd>
                  </div>
                </dl>
                <div className="settings-form-actions">
                  {account.kind === "account" ? (
                    <button
                      className="settings-button"
                      onClick={() => {
                        setDraft({
                          displayName: account.displayName,
                          email: account.email,
                        });
                        setEditing(true);
                        setNotice("");
                      }}
                    >
                      {t("edit")}
                    </button>
                  ) : (
                    <p className="settings-group-help">{t("guestHelp")}</p>
                  )}
                </div>
              </>
            )}
          </SettingsGroup>
        )}
      </ResourceState>
      <Feedback error={error} notice={notice} />
      <SettingsGroup title={t("accountData")} help={t("accountHelp")}>
        <div className="settings-link-row">
          <HomeIcon name="shield" size={20} />
          <span>{t("accountData")}</span>
          <button className="settings-button" onClick={() => go("/profile")}>
            {t("accountData")} <HomeIcon name="chevron" size={13} />
          </button>
        </div>
        <div className="settings-link-row">
          <HomeIcon name="devices" size={20} />
          <span>{t("connection")}</span>
          <button
            className="settings-button"
            onClick={() => {
              closeSettings();
              requestAnimationFrame(() =>
                window.dispatchEvent(new Event("designbuddy:open-server")),
              );
            }}
          >
            {t("connection")}
          </button>
        </div>
      </SettingsGroup>
    </>
  );
}

export function MemorySettings() {
  const resource = useResource(fetchProfile);
  const t = useSettingsCopy();
  const [content, setContent] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function act(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      resource.reload();
      setNotice(t("memoryUpdated"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("failure"));
    } finally {
      setBusy(false);
    }
  }
  const memories = resource.data?.memories ?? [];
  return (
    <>
      <SettingsGroup title={t("memoryList")} help={t("memoryHelp")}>
        <ResourceState resource={resource}>
          {memories.length ? (
            <ul className="settings-memory-list">
              {memories.map((item) => (
                <li key={item.id}>
                  <div>
                    <p>{item.content}</p>
                    <small>
                      {item.source} ·{" "}
                      {new Date(item.createdAt).toLocaleDateString()}
                    </small>
                  </div>
                  <button
                    className="settings-button settings-danger"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(t("memoryRemoveConfirm")))
                        void act(() => deleteProfileMemory(item.id));
                    }}
                  >
                    {t("remove")}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <SettingsEmpty
              icon="bulb"
              title={t("memoryEmpty")}
              help={t("memoryEmptyHelp")}
            />
          )}
        </ResourceState>
      </SettingsGroup>
      <div className="settings-form-actions">
        <button className="settings-button" onClick={() => go("/profile")}>
          {t("accountData")}
        </button>
      </div>
      <SettingsGroup title={t("memoryAdd")}>
        <form
          className="settings-edit-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!consent || !content.trim()) return;
            void act(async () => {
              await addProfileMemory({
                content: content.trim(),
                source: "Settings",
                kind: "note",
              });
              setContent("");
              setConsent(false);
            });
          }}
        >
          <label>
            {t("memoryContent")}
            <textarea
              maxLength={2000}
              required
              rows={3}
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
          </label>
          <label className="settings-checkbox-label">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
            />
            {t("memoryConsent")}
          </label>
          <div className="settings-form-actions">
            <button
              className="settings-button is-primary"
              disabled={busy || !consent || !content.trim() || !resource.data}
            >
              {t(busy ? "busy" : "memoryAdd")}
            </button>
          </div>
        </form>
      </SettingsGroup>
      <Feedback error={error} notice={notice} />
      <SettingsGroup title={t("danger")} help={t("dangerHelp")} danger>
        <div className="settings-row">
          <span>{t("memoryClear")}</span>
          <button
            className="settings-button settings-danger"
            disabled={busy || !memories.length}
            onClick={() => {
              if (window.confirm(t("memoryClearConfirm")))
                void act(clearProfileMemories);
            }}
          >
            {t("memoryClear")}
          </button>
        </div>
      </SettingsGroup>
    </>
  );
}

function RoleSettingsCard({ item }: { item: (typeof expertCatalog)[number] }) {
  const t = useSettingsCopy();
  const settings = usePreferences((state) => state.expertSettings);
  const config = settings[item.id];
  const [draft, setDraft] = useState({
    description: config?.description || "",
    instructions: config?.instructions || "",
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const role = configureExpert(item, settings);
  const save = (patch: Parameters<typeof setExpertConfiguration>[1]) => {
    setNotice("");
    try {
      setExpertConfiguration(item.id, patch);
      setError("");
      setNotice(t("saved"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("failure"));
    }
  };
  return (
    <article className="settings-expert-card" data-role-id={item.id}>
      <div className="settings-expert-top">
        <span className="settings-tile-icon">
          <HomeIcon name={item.icon} size={20} />
        </span>
        <h3>{item.name}</h3>
        <button
          className="settings-switch"
          role="switch"
          aria-label={t("roleEnabled", { name: item.name })}
          aria-checked={config?.enabled !== false}
          onClick={() => save({ enabled: config?.enabled === false })}
        >
          <span />
        </button>
      </div>
      <p>{role.description}</p>
      <details className="settings-role-editor">
        <summary
          onClick={(event) => {
            if (
              !(event.currentTarget.parentElement as HTMLDetailsElement).open
            ) {
              setDraft({
                description: config?.description || "",
                instructions: config?.instructions || "",
              });
              setNotice("");
            }
          }}
        >
          {t("roleConfiguration")}
        </summary>
        <p className="settings-group-help">{t("roleScope")}</p>
        <p className="settings-group-help">{t("publicPreferencesHelp")}</p>
        <form
          className="settings-edit-form"
          onSubmit={(event) => {
            event.preventDefault();
            save(draft);
          }}
        >
          <label>
            {t("roleDescription")}
            <textarea
              rows={3}
              maxLength={1200}
              value={draft.description}
              placeholder={item.description}
              onChange={(event) =>
                setDraft({ ...draft, description: event.target.value })
              }
            />
          </label>
          <label>
            {t("roleInstructions")}
            <textarea
              rows={3}
              maxLength={400}
              value={draft.instructions}
              onChange={(event) =>
                setDraft({ ...draft, instructions: event.target.value })
              }
            />
          </label>
          <div className="settings-form-actions">
            {config && (
              <button
                type="button"
                className="settings-button"
                onClick={() => {
                  const locale = usePreferences.getState().locale;
                  if (
                    !window.confirm(
                      translate(locale, "settings.models.removeConfirm", {
                        name: item.name,
                      }),
                    )
                  )
                    return;
                  setNotice("");
                  try {
                    resetExpertConfiguration(item.id);
                    setDraft({ description: "", instructions: "" });
                    setError("");
                    setNotice(t("saved"));
                  } catch (cause) {
                    setError(
                      cause instanceof Error ? cause.message : t("failure"),
                    );
                  }
                }}
              >
                {translate(
                  usePreferences.getState().locale,
                  "settings.shortcuts.reset",
                )}
              </button>
            )}

            <button
              type="button"
              className="settings-button"
              onClick={() =>
                setDraft({
                  description: config?.description || "",
                  instructions: config?.instructions || "",
                })
              }
            >
              {t("cancel")}
            </button>
            <button className="settings-button is-primary">{t("save")}</button>
          </div>
        </form>
        <ul className="settings-role-methods">
          {role.method.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ul>
      </details>
      <Feedback error={error} notice={notice} />
      <div className="settings-expert-bottom">
        <small>{item.category}</small>
        <button
          className="settings-text-button"
          onClick={() => go(`/experts/${encodeURIComponent(item.id)}`)}
        >
          {t("expertDetails")} <HomeIcon name="chevron" size={12} />
        </button>
      </div>
    </article>
  );
}

export function AgentsSettings() {
  const t = useSettingsCopy();
  const experts = useWorkspaceStore((state) => state.experts);
  const settings = usePreferences((state) => state.expertSettings);
  const [query, setQuery] = useState("");
  const items = [
    ...expertCatalog,
    ...experts
      .filter((item) => !expertCatalog.some((entry) => entry.id === item.id))
      .map(customExpertCatalog),
  ].filter((item) => {
    const role = configureExpert(item, settings);
    return `${role.name} ${role.description} ${role.method.join(" ")}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase());
  });
  return (
    <>
      <div className="settings-pane-toolbar">
        <label className="settings-inline-search">
          <HomeIcon name="search" size={16} />
          <input
            aria-label={t("searchExperts")}
            placeholder={t("searchExperts")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button className="settings-button" onClick={() => go("/experts")}>
          {t("expertManage")}
        </button>
      </div>
      <p className="settings-group-help">{t("expertHelp")}</p>
      <div className="settings-expert-grid">
        {items.map((item) => (
          <RoleSettingsCard key={item.id} item={item} />
        ))}
      </div>
      {!items.length && <SettingsEmpty icon="search" title={t("empty")} />}
    </>
  );
}

function AssistantPreferencesSettings() {
  const t = useSettingsCopy();
  const prefs = usePreferences((state) => state.assistant);
  const [error, setError] = useState("");
  function change(patch: Parameters<typeof setAssistantPreferences>[0]) {
    try {
      setAssistantPreferences(patch);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("failure"));
    }
  }
  return (
    <SettingsGroup title={t("assistantPreferences")}>
      <div className="settings-row">
        <div>
          <label id="settings-auto-match-label">{t("autoMatch")}</label>
          <p>{t("autoMatchHelp")}</p>
        </div>
        <button
          className="settings-switch"
          role="switch"
          aria-labelledby="settings-auto-match-label"
          aria-checked={prefs.autoMatch}
          onClick={() => change({ autoMatch: !prefs.autoMatch })}
        >
          <span />
        </button>
      </div>
      <details className="settings-assistant-advanced">
        <summary>{t("advanced")}</summary>
        <div className="settings-row">
          <label htmlFor="settings-match-delay">{t("matchDelay")}</label>
          <select
            id="settings-match-delay"
            value={prefs.debounceMs}
            onChange={(event) =>
              change({ debounceMs: Number(event.target.value) })
            }
          >
            {[900, 1500, 3000].map((value) => (
              <option key={value} value={value}>
                {value / 1000} s
              </option>
            ))}
          </select>
        </div>
        <div className="settings-row">
          <div>
            <label id="settings-collaborators-label">
              {t("collaborators")}
            </label>
            <p>{t("collaboratorsHelp")}</p>
          </div>
          <button
            className="settings-switch"
            role="switch"
            aria-labelledby="settings-collaborators-label"
            aria-checked={prefs.collaborators}
            onClick={() => change({ collaborators: !prefs.collaborators })}
          >
            <span />
          </button>
        </div>
      </details>
      <Feedback error={error} notice="" />
    </SettingsGroup>
  );
}

export function AssistantSettings() {
  const resource = useResource(fetchPluginBundles);
  const t = useSettingsCopy();
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  async function toggle(id: string, enabled: boolean) {
    setBusy(id);
    setNotice("");
    setError("");
    try {
      await setPluginBundleStatus(id, enabled ? "disabled" : "enabled");
      resource.reload();
      setNotice(t("pluginUpdated"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("failure"));
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <AssistantPreferencesSettings />
      <SettingsGroup title={t("plugins")} help={t("pluginsHelp")}>
        <ResourceState resource={resource}>
          {resource.data?.installed.length ? (
            resource.data.installed.map((item) => (
              <div className="settings-extension-row" key={item.id}>
                <span className="settings-tile-icon">
                  <HomeIcon name="assistant" size={20} />
                </span>
                <div>
                  <h3>
                    {item.name} <small>v{item.version}</small>
                  </h3>
                  <p>{item.description}</p>
                  <details>
                    <summary>{t("advanced")}</summary>
                    <p>{item.skills.join(" · ") || "—"}</p>
                    <p>{item.permissions.join(" · ") || "—"}</p>
                  </details>
                </div>
                <button
                  className="settings-switch"
                  role="switch"
                  aria-label={t("pluginToggle", { name: item.name })}
                  aria-checked={item.status === "enabled"}
                  disabled={!!busy}
                  onClick={() =>
                    void toggle(item.id, item.status === "enabled")
                  }
                >
                  <span />
                </button>
                <small className="settings-extension-state">
                  {t(item.status)}
                </small>
              </div>
            ))
          ) : (
            <SettingsEmpty
              icon="assistant"
              title={t("pluginsEmpty")}
              help={t("pluginsHelp")}
            />
          )}
        </ResourceState>
      </SettingsGroup>
      <SettingsGroup title={t("availablePlugins")}>
        <ResourceState resource={resource}>
          {resource.data?.bundles.map((bundle) => {
            const installed = resource.data?.installed.some(
              (item) => item.id === bundle.id,
            );
            return (
              <div className="settings-extension-row" key={bundle.id}>
                <span className="settings-tile-icon">
                  <HomeIcon name="assistant" size={20} />
                </span>
                <div>
                  <h3>
                    {bundle.name} <small>v{bundle.version}</small>
                  </h3>
                  <p>{bundle.description}</p>
                  <details>
                    <summary>{t("permissions")}</summary>
                    <p>{bundle.permissions.join(" · ") || "—"}</p>
                    <p>
                      {t("requirements")}: {bundle.requires.join(" · ") || "—"}
                    </p>
                    {!bundle.compatible && (
                      <p>
                        {t("incompatible")}: {bundle.compatibleReason}
                      </p>
                    )}
                  </details>
                </div>
                <button
                  className={`settings-button${installed ? " settings-danger" : ""}`}
                  disabled={!!busy || (!installed && !bundle.compatible)}
                  onClick={async () => {
                    if (
                      installed &&
                      !window.confirm(
                        t("uninstallConfirm", { name: bundle.name }),
                      )
                    )
                      return;
                    setBusy(bundle.id);
                    setError("");
                    setNotice("");
                    try {
                      if (installed) await uninstallPluginBundle(bundle.id);
                      else await installPluginBundle(bundle.id);
                      resource.reload();
                      setNotice(t("lifecycleUpdated"));
                    } catch (cause) {
                      setError(
                        cause instanceof Error ? cause.message : t("failure"),
                      );
                    } finally {
                      setBusy("");
                    }
                  }}
                >
                  {t(installed ? "uninstall" : "install")}
                </button>
              </div>
            );
          })}
          {resource.data?.installed
            .filter(
              (item) =>
                !resource.data?.bundles.some((bundle) => bundle.id === item.id),
            )
            .map((item) => (
              <div className="settings-row" key={item.id}>
                <span>{item.name}</span>
                <button
                  className="settings-button settings-danger"
                  disabled={!!busy}
                  onClick={async () => {
                    if (
                      !window.confirm(
                        t("uninstallConfirm", { name: item.name }),
                      )
                    )
                      return;
                    setBusy(item.id);
                    setError("");
                    try {
                      await uninstallPluginBundle(item.id);
                      resource.reload();
                      setNotice(t("lifecycleUpdated"));
                    } catch (cause) {
                      setError(
                        cause instanceof Error ? cause.message : t("failure"),
                      );
                    } finally {
                      setBusy("");
                    }
                  }}
                >
                  {t("uninstall")}
                </button>
              </div>
            ))}
        </ResourceState>
      </SettingsGroup>
      <Feedback error={error} notice={notice} />
      <div className="settings-form-actions">
        <button className="settings-button" onClick={() => go("/plugins")}>
          {t("pluginsManage")} <HomeIcon name="chevron" size={14} />
        </button>
      </div>
    </>
  );
}

function validServiceURL(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !host.includes(".") ||
      /^(?:\d+\.){3}\d+$/.test(host) ||
      /\.(?:local|localhost|internal|lan|home|test|invalid)$/.test(host)
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}

export function AppsSettings() {
  const resource = useResource(listConnectors);
  const t = useSettingsCopy();
  const local = useWorkspaceStore((state) => state.connectors);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    name: "",
    description: "",
    endpoint: "",
    transport: "streamable-http" as NonNullable<Connector["transport"]>,
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const customs = local.filter((item) => item.provider === "custom");
  const remote = resource.data || [];
  const ids = new Set([
    ...remote.map((item) => item.id),
    ...customs.map((item) => item.id),
    ...connectorCatalog
      .filter((item) => item.oauthProvider)
      .map((item) => item.id),
  ]);
  const items = [...ids].map((id) => {
    const config = customs.find((item) => item.id === id);
    const verified = remote.find((item) => item.id === id);
    const catalog = connectorCatalog.find((item) => item.id === id);
    return {
      id,
      name: config?.name || verified?.name || catalog?.name || id,
      description: config?.description || verified?.description || "",
      config,
      verified,
      catalog,
    };
  });
  function persist(next: Connector[]) {
    setNotice("");
    const before = useWorkspaceStore.getState().connectors;
    try {
      useWorkspaceStore.getState().setConnectors(next);
    } catch (cause) {
      try {
        useWorkspaceStore.getState().setConnectors(before);
      } catch {
        /* restore in-memory state too */
      }
      throw cause;
    }
  }
  function edit(id: string) {
    const value = customs.find((item) => item.id === id);
    setDraft({
      name: value?.name || "",
      description: value?.description || "",
      endpoint: value?.endpoint || "",
      transport: value?.transport || "streamable-http",
    });
    setEditing(id);
    setError("");
    setNotice("");
  }
  function save(event: FormEvent) {
    event.preventDefault();
    const endpoint = validServiceURL(draft.endpoint.trim());
    if (!endpoint) {
      setError(t("invalidEndpoint"));
      return;
    }
    if (!draft.name.trim() || !editing) return;
    const id = editing === "new" ? `custom-${crypto.randomUUID()}` : editing;
    try {
      persist([
        ...local.filter((item) => item.id !== id),
        {
          id,
          name: draft.name.trim(),
          description: draft.description.trim(),
          endpoint,
          transport: draft.transport,
          provider: "custom",
          status: "disconnected",
          scopes: [],
        },
      ]);
      setEditing(null);
      setError("");
      setNotice(t("saved"));
    } catch {
      setError(
        translate(usePreferences.getState().locale, "settings.err.storeSave"),
      );
    }
  }
  useEffect(() => {
    const refresh = () => resource.reload();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [resource.reload]);
  async function authorize(provider: Connector["provider"], id: string) {
    // Open synchronously in the click gesture; never trust query parameters as authorization.
    const popup = window.open(
      "about:blank",
      "designbuddy-authorization",
      "popup,width=620,height=760",
    );
    if (!popup) {
      setError(t("popupBlocked"));
      return;
    }
    popup.opener = null;
    setBusy(id);
    setError("");
    setNotice("");
    try {
      const callback = new URL(window.location.href);
      callback.searchParams.set("settings", "apps");
      const result = await beginConnectorOAuth(provider, callback.href);
      const url = new URL(result.authorizationUrl);
      const expected =
        provider === "github"
          ? ["github.com", "/login/oauth/authorize"]
          : provider === "notion"
            ? ["api.notion.com", "/v1/oauth/authorize"]
            : null;
      if (
        !expected ||
        url.protocol !== "https:" ||
        url.hostname !== expected[0] ||
        url.pathname !== expected[1] ||
        url.username ||
        url.password ||
        url.port
      )
        throw new Error(t("unsafeAuthorization"));
      popup.location.href = url.href;
      setNotice(t("authorizationStarted"));
    } catch (cause) {
      popup.close();
      setError(cause instanceof Error ? cause.message : t("failure"));
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <SettingsGroup title={t("connections")} help={t("connectionsHelp")}>
        {resource.loading && (
          <div className="settings-loading" role="status">
            {t("loading")}
          </div>
        )}
        {resource.error && (
          <div className="settings-connection-warning">
            <p role="alert">
              {t(resource.unavailable ? "serviceUnavailable" : "failure")}
            </p>
            <button className="settings-button" onClick={resource.reload}>
              {t("retry")}
            </button>
          </div>
        )}
        {items.map((item) => (
          <div className="settings-app-card" key={item.id}>
            <div className="settings-extension-row">
              <span className="settings-tile-icon">
                <HomeIcon name="link" size={20} />
              </span>
              <div>
                <h3>{item.name}</h3>
                {item.description && <p>{item.description}</p>}
              </div>
              <span
                className={`settings-status-tag ${item.verified?.status === "connected" ? "is-positive" : ""}`}
              >
                {item.verified
                  ? t(`status.${item.verified.status}`)
                  : t("connectionUnverified")}
              </span>
            </div>
            {item.config && (
              <dl className="settings-detail-list">
                <div>
                  <dt>{t("connectorEndpoint")}</dt>
                  <dd>{item.config.endpoint || "—"}</dd>
                </div>
                <div>
                  <dt>{t("connectorTransport")}</dt>
                  <dd>{item.config.transport || "streamable-http"}</dd>
                </div>
              </dl>
            )}
            {item.catalog?.oauthProvider ? (
              <p className="settings-group-help">{t("oauthHelp")}</p>
            ) : (
              <p className="settings-group-help">{t("connectorLocalHelp")}</p>
            )}
            <div className="settings-form-actions">
              {item.config && (
                <button
                  className="settings-button"
                  disabled={!!busy || item.verified?.status === "connected"}
                  onClick={() => edit(item.id)}
                >
                  {t("configure")}
                </button>
              )}
              {item.catalog?.oauthProvider && (
                <button
                  className="settings-button"
                  disabled={!!busy}
                  onClick={() =>
                    void authorize(item.catalog!.oauthProvider!, item.id)
                  }
                >
                  {t("authorize")}
                </button>
              )}
              {item.verified?.status === "connected" && (
                <button
                  className="settings-button settings-danger"
                  disabled={!!busy}
                  onClick={async () => {
                    if (
                      !window.confirm(
                        t("disconnectConfirm", { name: item.name }),
                      )
                    )
                      return;
                    setBusy(item.id);
                    setError("");
                    setNotice("");
                    try {
                      await disconnectConnector(item.id);
                      resource.reload();
                      setNotice(t("saved"));
                    } catch (cause) {
                      setError(
                        cause instanceof Error ? cause.message : t("failure"),
                      );
                    } finally {
                      setBusy("");
                    }
                  }}
                >
                  {t("disconnect")}
                </button>
              )}
              {item.config && (
                <button
                  className="settings-button settings-danger"
                  disabled={!!busy || item.verified?.status === "connected"}
                  onClick={() => {
                    if (
                      !window.confirm(
                        t("deleteConnectorConfirm", { name: item.name }),
                      )
                    )
                      return;
                    try {
                      persist(local.filter((value) => value.id !== item.id));
                      if (editing === item.id) setEditing(null);
                      setError("");
                      setNotice(t("saved"));
                    } catch {
                      setError(
                        translate(
                          usePreferences.getState().locale,
                          "settings.err.storeSave",
                        ),
                      );
                    }
                  }}
                >
                  {t("remove")}
                </button>
              )}
            </div>
          </div>
        ))}
      </SettingsGroup>
      <Feedback error={error} notice={notice} />
      {editing && (
        <SettingsGroup
          title={t(editing === "new" ? "addConnector" : "configure")}
          help={t("connectorLocalHelp")}
        >
          <form className="settings-edit-form" onSubmit={save}>
            <label>
              {t("connectorName")}
              <input
                required
                maxLength={80}
                value={draft.name}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
              />
            </label>
            <label>
              {t("connectorDescription")}
              <textarea
                rows={2}
                maxLength={2000}
                value={draft.description}
                onChange={(event) =>
                  setDraft({ ...draft, description: event.target.value })
                }
              />
            </label>
            <label>
              {t("connectorEndpoint")}
              <input
                type="url"
                required
                maxLength={2048}
                value={draft.endpoint}
                onChange={(event) =>
                  setDraft({ ...draft, endpoint: event.target.value })
                }
              />
            </label>
            <label>
              {t("connectorTransport")}
              <select
                value={draft.transport}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    transport: event.target.value as NonNullable<
                      Connector["transport"]
                    >,
                  })
                }
              >
                <option value="streamable-http">Streamable HTTP</option>
                <option value="sse">SSE</option>
              </select>
            </label>
            <div className="settings-form-actions">
              <button
                type="button"
                className="settings-button"
                onClick={() => {
                  setEditing(null);
                  setError("");
                }}
              >
                {t("cancel")}
              </button>
              <button className="settings-button is-primary">
                {t("save")}
              </button>
            </div>
          </form>
        </SettingsGroup>
      )}
      <div className="settings-form-actions">
        <button className="settings-button" onClick={() => edit("new")}>
          {t("addConnector")}
        </button>
        <button className="settings-button" onClick={resource.reload}>
          {t("retry")}
        </button>
        <button className="settings-button" onClick={() => go("/connectors")}>
          {t("connectionsManage")} <HomeIcon name="chevron" size={14} />
        </button>
      </div>
    </>
  );
}

export function DeviceRecords() {
  const resource = useResource(fetchProfile);
  const t = useSettingsCopy();
  return (
    <SettingsGroup title={t("devices")} help={t("devicesHelp")}>
      <ResourceState resource={resource}>
        {resource.data?.devices.length ? (
          resource.data.devices.map((device) => (
            <div className="settings-extension-row" key={device.id}>
              <span className="settings-tile-icon">
                <HomeIcon name="devices" size={20} />
              </span>
              <div>
                <h3>{device.label}</h3>
                <p>{device.userAgent}</p>
                <small>
                  {t("lastSeen")} · {new Date(device.lastSeen).toLocaleString()}
                </small>
              </div>
            </div>
          ))
        ) : (
          <SettingsEmpty icon="devices" title={t("empty")} />
        )}
      </ResourceState>
    </SettingsGroup>
  );
}

const loadSecurity = async () => {
  const [account, audit] = await Promise.all([
    fetchAccount(),
    fetchAccountAudit(),
  ]);
  return { account, audit };
};
export function SecuritySettings() {
  const resource = useResource(loadSecurity);
  const t = useSettingsCopy();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await changeAccountPassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setNotice(t("passwordUpdated"));
      resource.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("failure"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <ResourceState resource={resource}>
      <SettingsGroup title={t("password")} help={t("passwordHelp")}>
        {resource.data?.account.kind === "account" ? (
          <form className="settings-edit-form" onSubmit={save}>
            <label>
              {t("currentPassword")}
              <input
                required
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </label>
            <label>
              {t("newPassword")}
              <input
                required
                minLength={10}
                maxLength={128}
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </label>
            <div className="settings-form-actions">
              <button
                type="button"
                className="settings-button"
                disabled={busy}
                onClick={() => {
                  setCurrentPassword("");
                  setNewPassword("");
                  setError("");
                }}
              >
                {t("cancel")}
              </button>
              <button className="settings-button is-primary" disabled={busy}>
                {t(busy ? "busy" : "save")}
              </button>
            </div>
          </form>
        ) : (
          <SettingsEmpty icon="shield" title={t("guest")} help={t("guestHelp")}>
            <button className="settings-button" onClick={() => go("/profile")}>
              {t("accountData")}
            </button>
          </SettingsEmpty>
        )}
      </SettingsGroup>
      <Feedback error={error} notice={notice} />
      <SettingsGroup title={t("activity")} help={t("activityHelp")}>
        {resource.data?.audit.length ? (
          <ol className="settings-audit-list">
            {resource.data.audit.slice(0, 10).map((item) => (
              <li key={item.id}>
                <span className="settings-audit-dot" />
                <div>
                  <strong>
                    {[
                      "account.register",
                      "account.profile.update",
                      "account.password.change",
                      "account.oauth.login",
                      "account.oauth.register",
                      "account.enable",
                      "account.disable",
                    ].includes(item.action)
                      ? t(`audit.${item.action}`)
                      : item.detail || item.action}
                  </strong>
                  <p>{item.detail}</p>
                </div>
                <time>{new Date(item.createdAt).toLocaleString()}</time>
              </li>
            ))}
          </ol>
        ) : (
          <SettingsEmpty icon="history" title={t("empty")} />
        )}
      </SettingsGroup>
      <div className="settings-form-actions">
        <button className="settings-button" onClick={resource.reload}>
          {t("retry")}
        </button>
        <button className="settings-button" onClick={() => go("/profile")}>
          {t("accountData")}
        </button>
      </div>
    </ResourceState>
  );
}
