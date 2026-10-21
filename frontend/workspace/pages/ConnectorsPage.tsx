import { useEffect, useMemo, useState, type FormEvent } from "react";
import { HomeIcon } from "../../../apps/web/src/components/HomeIcon";
import { WorkBuddySidebar } from "../../../apps/web/src/components/WorkBuddySidebar";
import { MarketNavigation } from "../MarketNavigation";
import {
  assertExpectedOAuthUrl,
  beginConnectorOAuth,
  connectConnector,
  configureConnector,
  createConnector,
  deleteConnector,
  disconnectConnector,
  fetchConnectorCatalog,
  fetchConnectorEvents,
  listConnectors,
  testConnector,
  type ConnectorCatalogEntry,
  type ConnectorEvent,
  type ConnectorTestResult,
} from "../api/connectors";
import { connectorAuthLabels, connectorCatalog, type CatalogConnector } from "../connectorCatalog";
import type { Connector, ConnectorAuthType } from "../models/workspace";
import { listProjects } from "../projectStore";
import { useWorkspaceStore } from "../store";
import { navigateTo, resolveWorkspaceRoute, workspaceRoutes } from "../workspaceRoutes";
import "./connectors.css";

function ConnectorIcon({ connector }: { connector: CatalogConnector }) {
  return connector.icon ? (
    <img className="connector-tile-icon" src={connector.icon} alt="" width={50} height={50} />
  ) : (
    <span className="connector-tile-icon connector-icon-fallback" aria-hidden="true">
      <HomeIcon name="link" size={26} />
    </span>
  );
}

function apiError(error: unknown) {
  if (error instanceof SyntaxError) return "接口未返回有效数据，请确认连接器 API 已部署。";
  if (error instanceof Error && !error.message.includes("<") && error.message.length < 240) return error.message;
  return "连接器服务暂不可用，请确认后端接口与授权配置。";
}

function statusLabel(record: Connector | undefined, verified: boolean) {
  if (!verified) return "尚未向服务端核验";
  if (!record) return "未连接";
  if (record.status === "connected") return "已连接（服务端已真实校验）";
  if (record.status === "error") return "连接异常";
  if (record.status === "pending") return "等待授权完成";
  return record.configured ? "已保存配置，尚未连接" : "未连接";
}

function catalogEntryOf(entry: CatalogConnector, record?: Connector): CatalogConnector {
  return { ...entry, name: record?.name || entry.name, description: record?.description || entry.description };
}

export default function ConnectorsPage({ pathname }: { pathname: string }) {
  const route = resolveWorkspaceRoute(pathname);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  // Server state is the only source of truth for "connected"; local records
  // are a cache of what the server last confirmed.
  const [records, setRecords] = useState<Connector[] | null>(null);
  const [catalog, setCatalog] = useState<ConnectorCatalogEntry[]>([]);
  const connectors = useWorkspaceStore((state) => state.connectors);
  const setConnectors = useWorkspaceStore((state) => state.setConnectors);

  function applyRecords(items: Connector[]) {
    const local = useWorkspaceStore.getState().connectors.filter((item) => item.custom);
    const merged = items.map((item) => {
      const saved = local.find((entry) => entry.id === item.id);
      return saved ? { ...saved, ...item } : item;
    });
    const orphans = local.filter((item) => !items.some((remote) => remote.id === item.id));
    setConnectors([...orphans, ...merged]);
    setRecords(items);
  }

  /** `silent` keeps the market pixel-identical while it loads in the background. */
  async function refresh(signal?: AbortSignal, silent = false) {
    setBusy("refresh");
    setError("");
    try {
      const [items, catalogEntries] = await Promise.all([
        listConnectors(signal),
        fetchConnectorCatalog(signal),
      ]);
      if (signal?.aborted) return;
      applyRecords(items);
      setCatalog(catalogEntries);
      if (!silent)
        setNotice(
          `服务端状态已核验：${items.filter((item) => item.status === "connected").length} 个连接器已连接。`,
        );
    } catch (cause) {
      if (!signal?.aborted) {
        setRecords(null);
        setError(apiError(cause));
      }
    } finally {
      if (!signal?.aborted) setBusy("");
    }
  }

  useEffect(() => {
    setNotice("");
    setError("");
    setSearch("");
    const controller = new AbortController();
    void refresh(controller.signal, true);
    return () => controller.abort();
    // The route id is part of the key so the detail form reloads its server state.
  }, [pathname, route.page, route.id]);

  const catalogEntries = useMemo<CatalogConnector[]>(() => {
    const fromServer = new Map<string, CatalogConnector>(
      catalog.map((entry) => [
        entry.id,
        {
          id: entry.id,
          name: entry.name,
          description: entry.description,
          provider: entry.provider,
          authTypes: entry.authTypes,
          note: entry.note,
          docsUrl: entry.docsUrl,
          ...(entry.authTypes.includes("oauth") ? { oauthProvider: entry.provider } : {}),
          custom: !connectorCatalog.some((item) => item.id === entry.id),
        },
      ]),
    );
    for (const entry of connectorCatalog) if (!fromServer.has(entry.id)) fromServer.set(entry.id, entry);
    for (const record of records ?? [])
      if (!fromServer.has(record.id))
        fromServer.set(record.id, {
          id: record.id,
          name: record.name,
          description: record.description,
          provider: record.provider,
          authTypes: record.authTypes?.length ? record.authTypes : ["mcp"],
          note: record.note ?? "自定义连接器配置。",
          docsUrl: record.docsUrl ?? "https://modelcontextprotocol.io/",
          custom: true,
        });
    return [...fromServer.values()];
  }, [catalog, records]);

  const query = search.trim().toLocaleLowerCase();
  const visible = catalogEntries.filter((item) =>
    `${item.name} ${item.description}`.toLocaleLowerCase().includes(query),
  );
  const selected = catalogEntries.find((item) => item.id === route.id);
  const selectedRecord = records?.find((item) => item.id === selected?.id);

  async function removeLocal(id: string) {
    setConnectors(useWorkspaceStore.getState().connectors.filter((item) => item.id !== id));
  }

  async function onDeleted(id: string, name: string) {
    removeLocal(id);
    setRecords((items) => items?.filter((item) => item.id !== id) ?? null);
    setNotice(`已删除“${name}”的服务端配置。`);
    navigateTo(workspaceRoutes.connectors);
  }

  return (
    <div className="workbuddy-app connectors-workspace">
      <WorkBuddySidebar active="connectors" projectCount={listProjects().length} go={navigateTo} setNotice={setNotice} />
      <div className="connectors-main">
        <header className="connectors-topbar">
          <MarketNavigation active="connectors" />
          <div className="connectors-header-actions">
            <label className="connectors-search">
              <HomeIcon name="search" />
              <input
                type="search"
                aria-label="搜索连接器"
                placeholder="搜索连接器"
                value={search}
                disabled={route.page !== "marketplace"}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <button className="connectors-custom-control" onClick={() => navigateTo(workspaceRoutes.createConnector)}>
              <HomeIcon name="pencil" />
              自定义连接器
            </button>
          </div>
        </header>
        <main className="connectors-content" aria-label="连接器市场">
          {notice && (
            <div className="connectors-message" role="status">
              <span>{notice}</span>
              <button aria-label="关闭提示" onClick={() => setNotice("")}>
                ×
              </button>
            </div>
          )}
          {error && (
            <div className="connectors-message is-error" role="alert">
              <span>{error}</span>
              <button aria-label="关闭错误" onClick={() => setError("")}>
                ×
              </button>
            </div>
          )}

          {route.page === "marketplace" && (
            <>
              <div className="connectors-grid">
                {visible.map((connector) => {
                  const record = records?.find((item) => item.id === connector.id);
                  const state = record?.status === "connected" ? "is-connected" : record?.status === "error" ? "is-error" : null;
                  return (
                    <article className="connector-tile" key={connector.id}>
                      <button
                        className="connector-tile-open"
                        aria-label={`查看${connector.name}`}
                        onClick={() => navigateTo(workspaceRoutes.connectorDetail(connector.id))}
                      >
                        <ConnectorIcon connector={connector} />
                        <span className="connector-tile-copy">
                          <span className="connector-tile-title" title={connector.name}>
                            {connector.name}
                          </span>
                          <span className="connector-tile-description" title={connector.description}>
                            {connector.description}
                          </span>
                        </span>
                      </button>
                      {state && (
                        <span
                          className={`connector-status-dot ${state}`}
                          role="img"
                          aria-label={state === "is-connected" ? "服务端已确认连接" : "连接异常"}
                          title={state === "is-connected" ? "服务端已确认连接" : "连接异常"}
                        />
                      )}
                      <button
                        className="connector-configure-button"
                        aria-label={`配置${connector.name}`}
                        title="查看接入说明与连接配置"
                        onClick={() => navigateTo(workspaceRoutes.connectorDetail(connector.id))}
                      >
                        <HomeIcon name={state === "is-connected" ? "check" : "plus"} size={16} />
                      </button>
                    </article>
                  );
                })}
              </div>
              {visible.length === 0 && (
                <div className="connectors-empty" role="status">
                  <HomeIcon name="link" size={32} />
                  <h1>没有找到匹配的连接器</h1>
                  <p>试试其他关键词，或添加自己的连接器配置。</p>
                  <button className="connectors-secondary" onClick={() => setSearch("")}>
                    清除搜索
                  </button>
                </div>
              )}
            </>
          )}

          {route.page === "create" && (
            <CreateConnectorForm
              onError={setError}
              onNotice={setNotice}
              onCreated={(record) => {
                setRecords((items) => (items ? [...items.filter((item) => item.id !== record.id), record] : [record]));
                navigateTo(workspaceRoutes.connectorDetail(record.id));
              }}
            />
          )}

          {route.page === "detail" &&
            (selected ? (
              <ConnectorDetail
                entry={catalogEntryOf(selected, selectedRecord)}
                record={selectedRecord}
                fields={catalog.find((item) => item.id === selected.id)?.fields}
                verified={records !== null}
                busy={busy}
                onBusy={setBusy}
                onError={setError}
                onNotice={setNotice}
                onChanged={(record) => {
                  setRecords((items) =>
                    items ? items.map((item) => (item.id === record.id ? record : item)) : items,
                  );
                  const store = useWorkspaceStore.getState();
                  setConnectors([
                    ...store.connectors.filter((item) => item.id !== record.id),
                    { ...(store.connectors.find((item) => item.id === record.id) ?? {}), ...record },
                  ] as Connector[]);
                }}
                onDeleted={(name) => void onDeleted(selected.id, name)}
              />
            ) : (
              <section className="connector-detail-panel">
                <button className="connectors-back" onClick={() => navigateTo(workspaceRoutes.connectors)}>
                  ← 返回连接器市场
                </button>
                <h1>未找到该连接器</h1>
                <p>该配置可能已删除，或不在当前账号下。</p>
              </section>
            ))}

          {route.page === "oauth" && (
            <OAuthCallback
              records={records}
              verified={records !== null}
              busy={busy}
              onRefresh={() => void refresh()}
            />
          )}
        </main>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function CreateConnectorForm({
  onError,
  onNotice,
  onCreated,
}: {
  onError: (message: string) => void;
  onNotice: (message: string) => void;
  onCreated: (record: Connector) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [transport, setTransport] = useState<"streamable-http" | "sse">("streamable-http");
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onError("");
    if (!name.trim()) {
      onError("请填写连接器名称。");
      return;
    }
    let url: URL;
    try {
      url = new URL(endpoint.trim());
    } catch {
      onError("请填写有效的 HTTPS 服务地址。");
      return;
    }
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
      onError("服务地址必须使用 HTTPS，且不能包含账号、密码、查询参数或片段。请勿在地址中填写密钥。");
      return;
    }
    setSaving(true);
    try {
      const record = await createConnector({
        name: name.trim(),
        description: description.trim(),
        authType: "mcp",
        endpoint: url.href,
        transport,
      });
      onNotice(`已创建“${record.name}”。接下来填写凭据并测试连接。`);
      onCreated(record);
    } catch (cause) {
      onError(apiError(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="connector-detail-panel" onSubmit={save}>
      <button type="button" className="connectors-back" onClick={() => navigateTo(workspaceRoutes.connectors)}>
        ← 返回连接器市场
      </button>
      <h1>自定义连接器</h1>
      <p>
        保存一个 MCP 服务配置到服务端。保存配置不会访问该地址；只有你点击“测试连接”或“保存并连接”时，服务端才会向它发起真实握手。
      </p>
      <label>
        连接器名称
        <input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：团队知识库" />
      </label>
      <label>
        连接器说明
        <textarea rows={3} maxLength={400} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="描述这个服务的用途" />
      </label>
      <label>
        服务地址
        <input
          type="url"
          required
          maxLength={2048}
          value={endpoint}
          onChange={(event) => setEndpoint(event.target.value)}
          placeholder="https://your-server.example/mcp"
          aria-describedby="connector-endpoint-note"
        />
      </label>
      <small id="connector-endpoint-note">
        仅保存不含凭据、查询参数的 HTTPS 地址。请勿填写 API 密钥或访问令牌；令牌请填写在下一步的凭据字段里，浏览器不会保存它。
      </small>
      <label>
        传输协议
        <select
          aria-label="传输协议"
          value={transport}
          onChange={(event) => setTransport(event.target.value as "streamable-http" | "sse")}
        >
          <option value="streamable-http">Streamable HTTP</option>
          <option value="sse">SSE</option>
        </select>
      </label>
      <button className="connectors-primary" type="submit" disabled={saving}>
        {saving ? "保存中…" : "保存配置"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------

function ConnectorDetail({
  entry,
  record,
  fields,
  verified,
  busy,
  onBusy,
  onError,
  onNotice,
  onChanged,
  onDeleted,
}: {
  entry: CatalogConnector;
  record: Connector | undefined;
  fields: ConnectorCatalogEntry["fields"] | undefined;
  verified: boolean;
  busy: string;
  onBusy: (value: string) => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
  onChanged: (record: Connector) => void;
  onDeleted: (name: string) => void;
}) {
  const authTypes: ConnectorAuthType[] = entry.authTypes.length ? entry.authTypes : ["mcp"];
  const [authType, setAuthType] = useState<ConnectorAuthType>(
    record?.authType && authTypes.includes(record.authType) ? record.authType : authTypes[0],
  );
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ConnectorTestResult | null>(null);
  const [events, setEvents] = useState<ConnectorEvent[]>([]);

  useEffect(() => {
    setAuthType(record?.authType && authTypes.includes(record.authType) ? record.authType : authTypes[0]);
    setValues({});
    setResult(null);
  }, [entry.id]);

  useEffect(() => {
    let current = true;
    fetchConnectorEvents(entry.id)
      .then((items) => {
        if (current) setEvents(items.slice(0, 8));
      })
      .catch(() => {
        /* the event trail is a convenience, never the source of truth */
      });
    return () => {
      current = false;
    };
  }, [entry.id, record?.status, record?.lastCheckedAt]);

  const activeFields = useMemo(() => fields?.[authType] ?? [], [fields, authType]);

  function payload() {
    const body: Record<string, string> = { authType };
    for (const [key, value] of Object.entries(values)) if (value.trim()) body[key] = value.trim();
    return body;
  }

  async function runTest() {
    onBusy("test");
    onError("");
    try {
      const outcome = await testConnector(entry.id, payload());
      setResult(outcome);
      onNotice(outcome.ok ? `连通性校验通过：${outcome.detail}` : `连通性校验失败：${outcome.detail}`);
    } catch (cause) {
      onError(apiError(cause));
    } finally {
      onBusy("");
    }
  }

  async function connect() {
    onBusy("connect");
    onError("");
    try {
      const { connector, result: outcome } = await connectConnector(entry.id, payload());
      setResult(outcome);
      onChanged(connector);
      onNotice(
        outcome.ok
          ? `已连接：${outcome.detail}`
          : `未能连接：${outcome.detail}。凭据不会保存，请修正后重试。`,
      );
    } catch (cause) {
      onError(apiError(cause));
    } finally {
      onBusy("");
    }
  }

  async function saveOnly() {
    onBusy("save");
    onError("");
    try {
      const saved = await configureConnector(entry.id, payload());
      onChanged(saved);
      onNotice("配置已保存到服务端；尚未连接，请点击测试连接确认可用。");
    } catch (cause) {
      onError(apiError(cause));
    } finally {
      onBusy("");
    }
  }

  async function authorize() {
    onBusy("authorize");
    onError("");
    try {
      const callback = new URL(`${import.meta.env.BASE_URL}connectors/oauth`, window.location.origin);
      callback.searchParams.set("connector", entry.id);
      const { authorizationUrl } = await beginConnectorOAuth(entry.id, callback.href);
      window.location.assign(assertExpectedOAuthUrl(entry.id, authorizationUrl));
    } catch (cause) {
      onError(apiError(cause));
    } finally {
      onBusy("");
    }
  }

  async function disconnect() {
    if (!window.confirm(`断开“${entry.name}”的连接？服务端会删除保存的凭据。`)) return;
    onBusy("disconnect");
    onError("");
    try {
      const updated = await disconnectConnector(entry.id);
      if (updated) onChanged(updated);
      setResult(null);
      onNotice(`已断开“${entry.name}”。`);
    } catch (cause) {
      onError(apiError(cause));
    } finally {
      onBusy("");
    }
  }

  async function remove() {
    if (!window.confirm(`删除“${entry.name}”的服务端配置？此操作不可撤销。`)) return;
    onBusy("delete");
    onError("");
    try {
      await deleteConnector(entry.id);
      onDeleted(entry.name);
    } catch (cause) {
      onError(apiError(cause));
    } finally {
      onBusy("");
    }
  }

  const connected = record?.status === "connected";
  return (
    <section className="connector-detail-panel">
      <button className="connectors-back" onClick={() => navigateTo(workspaceRoutes.connectors)}>
        ← 返回连接器市场
      </button>
      <ConnectorIcon connector={entry} />
      <h1>{entry.name}</h1>
      <p>{entry.description}</p>

      <p className="connector-verified-status" role="status">
        连接状态：{statusLabel(record, verified)}
        {record?.credentialHint ? `（已保存凭据 ${record.credentialHint}）` : ""}
      </p>
      {record?.lastError && <p className="connector-last-error">上次校验：{record.lastError}</p>}

      <div className="connector-service-note">
        <strong>{connected ? "连接已由服务端校验" : "接入说明"}</strong>
        <p>{entry.note}</p>
        <p>
          凭据只发送给服务端并加密保存，浏览器不会留存，也不会出现在任何响应里。只有服务端真实访问了对方服务并返回成功，这里才会显示已连接。
        </p>
        {entry.docsUrl && (
          <p>
            <a href={entry.docsUrl} target="_blank" rel="noreferrer noopener">
              查看官方接入文档
            </a>
          </p>
        )}
      </div>

      {authTypes.length > 1 && (
        <div className="connector-auth-tabs" role="tablist" aria-label="连接方式">
          {authTypes.map((type) => (
            <button
              key={type}
              role="tab"
              type="button"
              aria-selected={type === authType}
              className={type === authType ? "is-active" : ""}
              onClick={() => {
                setAuthType(type);
                setResult(null);
              }}
            >
              {connectorAuthLabels[type]}
            </button>
          ))}
        </div>
      )}

      {authType !== "oauth" && (
        <form
          className="connector-form"
          onSubmit={(event) => {
            event.preventDefault();
            void connect();
          }}
        >
          {activeFields.map((field) => (
            <label key={field.key}>
              {field.label}
              {field.kind === "select" ? (
                <select
                  aria-label={field.label}
                  value={values[field.key] ?? (field.key === "transport" ? record?.transport ?? field.options?.[0] : field.options?.[0])}
                  onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                >
                  {(field.options ?? []).map((option) => (
                    <option key={option} value={option}>
                      {option === "streamable-http" ? "Streamable HTTP" : option.toUpperCase()}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.kind === "password" ? "password" : field.kind === "url" ? "url" : "text"}
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={field.kind === "url" ? 2048 : 4096}
                  aria-label={field.label}
                  placeholder={field.placeholder}
                  value={
                    values[field.key] ??
                    (field.key === "endpoint" ? record?.endpoint ?? "" : "")
                  }
                  onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                />
              )}
              {field.help && <small>{field.help}</small>}
            </label>
          ))}
          {activeFields.length === 0 && (
            <p className="connector-form-empty">服务端没有为这种连接方式声明字段，请刷新后重试。</p>
          )}
        </form>
      )}

      {result && (
        <div className={`connector-test-result ${result.ok ? "is-ok" : "is-failed"}`} role="status">
          <strong>{result.ok ? "校验通过" : "校验失败"}</strong>
          <span>{result.detail}</span>
          {result.target && <span>校验地址：{result.target}</span>}
          {result.tools && result.tools.length > 0 && <span>可用工具：{result.tools.join("、")}</span>}
        </div>
      )}

      <div className="connector-detail-actions">
        {authType === "oauth" ? (
          <button className="connectors-primary" disabled={!!busy} onClick={() => void authorize()}>
            {busy === "authorize" ? "正在获取授权地址…" : connected ? "重新授权" : "授权连接"}
          </button>
        ) : (
          <>
            <button className="connectors-primary" disabled={!!busy} onClick={() => void connect()}>
              {busy === "connect" ? "正在校验并连接…" : connected ? "重新校验并连接" : "保存并连接"}
            </button>
            <button className="connectors-secondary" disabled={!!busy} onClick={() => void runTest()}>
              {busy === "test" ? "正在校验…" : "测试连接"}
            </button>
            <button className="connectors-secondary" disabled={!!busy} onClick={() => void saveOnly()}>
              仅保存配置
            </button>
          </>
        )}
        {(connected || record?.configured) && (
          <button className="connectors-secondary" disabled={!!busy} onClick={() => void disconnect()}>
            {busy === "disconnect" ? "断开中…" : "断开连接"}
          </button>
        )}
        {entry.custom && (
          <button className="connectors-secondary" disabled={!!busy} onClick={() => void remove()}>
            {busy === "delete" ? "删除中…" : "删除配置"}
          </button>
        )}
      </div>

      {record?.endpoint && (
        <dl className="connector-config-values">
          <dt>服务地址</dt>
          <dd>{record.endpoint}</dd>
          {record.transport && (
            <>
              <dt>传输协议</dt>
              <dd>{record.transport === "sse" ? "SSE" : "Streamable HTTP"}</dd>
            </>
          )}
          {record.scopes.length > 0 && (
            <>
              <dt>{record.authType === "mcp" ? "可用工具" : "授权范围"}</dt>
              <dd>{record.scopes.join("、")}</dd>
            </>
          )}
        </dl>
      )}

      {events.length > 0 && (
        <div className="connector-events">
          <h2>服务端记录</h2>
          <ul>
            {events.map((event, index) => (
              <li key={`${event.createdAt}-${index}`}>
                <span className={event.ok ? "is-ok" : "is-failed"}>{event.action}</span>
                {event.detail ? ` ${event.detail}` : ""}
                <time dateTime={new Date(event.createdAt).toISOString()}>
                  {new Date(event.createdAt).toLocaleString()}
                </time>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------

function OAuthCallback({
  records,
  verified,
  busy,
  onRefresh,
}: {
  records: Connector[] | null;
  verified: boolean;
  busy: string;
  onRefresh: () => void;
}) {
  // Only the server decides whether an authorization really succeeded; the
  // address bar is used for nothing but picking which connector to display.
  const params = new URLSearchParams(window.location.search);
  const connectorId = params.get("connector") || "";
  const hint = params.get("oauth_error") || "";
  const record = records?.find((item) => item.id === connectorId);
  const connected = records?.filter((item) => item.status === "connected") ?? [];
  return (
    <section className="connector-detail-panel">
      <h1>验证授权结果</h1>
      <p>本页面只采用服务端返回的连接状态，不会根据地址栏参数判定授权成功。</p>
      {hint && <p className="connector-last-error">服务端提示：{hint}</p>}
      <p className="connector-verified-status" role="status">
        {connectorId ? `${connectorId} 连接状态：${statusLabel(record, verified)}` : `连接状态：${verified ? `已核验，${connected.length} 个连接器已连接` : "尚未向服务端核验"}`}
      </p>
      <div className="connector-detail-actions">
        <button className="connectors-primary" disabled={!!busy} onClick={onRefresh}>
          {busy ? "核验中…" : "重新核验"}
        </button>
        {connectorId && (
          <button className="connectors-secondary" onClick={() => navigateTo(workspaceRoutes.connectorDetail(connectorId))}>
            返回该连接器
          </button>
        )}
        <button className="connectors-secondary" onClick={() => navigateTo(workspaceRoutes.connectors)}>
          返回连接器市场
        </button>
      </div>
    </section>
  );
}
