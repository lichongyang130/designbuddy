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
} from "../../../../frontend/workspace/expertCatalog";
import { useWorkspaceStore } from "../../../../frontend/workspace/store";
import {
  fetchPluginBundles,
  setPluginBundleStatus,
} from "../../../../frontend/workspace/api/plugins";
import { listConnectors } from "../../../../frontend/workspace/api/connectors";

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
      .catch(() => {
        if (active) {
          setData(null);
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
  return { data, error, loading, reload };
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

export function AgentsSettings() {
  const t = useSettingsCopy();
  const experts = useWorkspaceStore((state) => state.experts);
  const [query, setQuery] = useState("");
  const items = [
    ...expertCatalog,
    ...experts
      .filter((item) => !expertCatalog.some((entry) => entry.id === item.id))
      .map(customExpertCatalog),
  ].filter((item) =>
    `${item.name} ${item.description}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );
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
          <article className="settings-expert-card" key={item.id}>
            <div className="settings-expert-top">
              <span className="settings-tile-icon">
                <HomeIcon name={item.icon} size={20} />
              </span>
              <h3>{item.name}</h3>
            </div>
            <p>{item.description}</p>
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
        ))}
      </div>
      {!items.length && <SettingsEmpty icon="search" title={t("empty")} />}
    </>
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
      <Feedback error={error} notice={notice} />
      <div className="settings-form-actions">
        <button className="settings-button" onClick={() => go("/plugins")}>
          {t("pluginsManage")} <HomeIcon name="chevron" size={14} />
        </button>
      </div>
    </>
  );
}

export function AppsSettings() {
  const resource = useResource(listConnectors);
  const t = useSettingsCopy();
  return (
    <>
      <SettingsGroup title={t("connections")} help={t("connectionsHelp")}>
        <ResourceState resource={resource}>
          {resource.data?.length ? (
            resource.data.map((item) => (
              <div className="settings-extension-row" key={item.id}>
                <span className="settings-tile-icon">
                  <HomeIcon name="link" size={20} />
                </span>
                <div>
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                </div>
                <span
                  className={`settings-status-tag ${item.status === "connected" ? "is-positive" : ""}`}
                >
                  {t(`status.${item.status}`)}
                </span>
              </div>
            ))
          ) : (
            <SettingsEmpty
              icon="link"
              title={t("connectionsEmpty")}
              help={t("connectionsHelp")}
            />
          )}
        </ResourceState>
      </SettingsGroup>
      <div className="settings-form-actions">
        <button className="settings-button" onClick={resource.reload}>
          {t("retry")}
        </button>
        <button
          className="settings-button is-primary"
          onClick={() => go("/connectors")}
        >
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
