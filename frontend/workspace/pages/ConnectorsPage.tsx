import { useEffect, useMemo, useState, type FormEvent } from "react";
import { HomeIcon } from "../../../apps/web/src/components/HomeIcon";
import { WorkBuddySidebar } from "../../../apps/web/src/components/WorkBuddySidebar";
import { MarketNavigation } from "../MarketNavigation";
import { beginConnectorOAuth, disconnectConnector, listConnectors } from "../api/connectors";
import { connectorCatalog, type CatalogConnector } from "../connectorCatalog";
import type { Connector } from "../models/workspace";
import { listProjects } from "../projectStore";
import { useWorkspaceStore } from "../store";
import { navigateTo, resolveWorkspaceRoute, workspaceRoutes } from "../workspaceRoutes";
import "./connectors.css";

function ConnectorIcon({ connector }: { connector: CatalogConnector }) {
  return connector.icon ? <img className="connector-tile-icon" src={connector.icon} alt="" width={50} height={50} />
    : <span className="connector-tile-icon connector-icon-fallback" aria-hidden="true"><HomeIcon name="link" size={26} /></span>;
}

function apiError(error: unknown) {
  if (error instanceof SyntaxError) return "接口未返回有效数据，请确认连接器 API 已部署。";
  if (error instanceof Error && !error.message.includes("<") && error.message.length < 240) return error.message;
  return "连接器服务暂不可用，请确认后端接口与授权配置。";
}

export default function ConnectorsPage({ pathname }: { pathname: string }) {
  const route = resolveWorkspaceRoute(pathname);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [transport, setTransport] = useState<NonNullable<Connector["transport"]>>("streamable-http");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  // Local records alone do not prove that an external authorization is still valid.
  const [verified, setVerified] = useState<Connector[] | null>(null);
  const connectors = useWorkspaceStore((state) => state.connectors);
  const setConnectors = useWorkspaceStore((state) => state.setConnectors);
  const upsertConnector = useWorkspaceStore((state) => state.upsertConnector);
  const custom = useMemo<CatalogConnector[]>(() => connectors.filter((item) => item.provider === "custom" && !connectorCatalog.some((entry) => entry.id === item.id)).map((item) => ({ ...item, custom: true })), [connectors]);
  const catalog = useMemo(() => [...connectorCatalog, ...custom], [custom]);
  const query = search.trim().toLocaleLowerCase();
  const visible = catalog.filter((item) => `${item.name} ${item.description}`.toLocaleLowerCase().includes(query));
  const selected = catalog.find((item) => item.id === route.id);
  const selectedState = verified?.find((item) => item.id === selected?.id);

  function applyVerification(items: Connector[]) {
    const local = useWorkspaceStore.getState().connectors.filter((item) => item.provider === "custom");
    const remote = items.map((item) => item.provider === "custom" ? { ...local.find((saved) => saved.id === item.id), ...item } : item);
    setConnectors([...local.filter((item) => !items.some((remote) => remote.id === item.id)), ...remote]);
    setVerified(items);
  }

  async function refresh(signal?: AbortSignal) {
    setBusy("refresh"); setError(""); setNotice("");
    try {
      const items = await listConnectors(signal);
      if (signal?.aborted) return;
      applyVerification(items);
      setNotice(`服务端状态已核验：${items.filter((item) => item.status === "connected").length} 个连接器已连接。`);
    } catch (cause) {
      if (!signal?.aborted) { setVerified(null); setError(apiError(cause)); }
    } finally { if (!signal?.aborted) setBusy(""); }
  }

  useEffect(() => {
    setNotice(""); setError(""); setSearch(""); setBusy("");
    if (route.page === "create") { setName(""); setDescription(""); setEndpoint(""); setTransport("streamable-http"); }
    if (route.page !== "oauth") return;
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [pathname, route.page]);

  async function authorize(connector: CatalogConnector) {
    if (!connector.oauthProvider) return;
    setBusy("authorize"); setError("");
    try {
      const callback = new URL(`${import.meta.env.BASE_URL}connectors/oauth`, window.location.origin).href;
      const { authorizationUrl } = await beginConnectorOAuth(connector.oauthProvider, callback);
      const url = new URL(authorizationUrl);
      const expected = connector.oauthProvider === "github"
        ? { host: "github.com", path: "/login/oauth/authorize" }
        : { host: "api.notion.com", path: "/v1/oauth/authorize" };
      if (url.protocol !== "https:" || url.hostname !== expected.host || url.pathname !== expected.path || url.username || url.password || url.port) throw new Error("授权服务返回了非预期的授权地址，已阻止跳转。");
      window.location.assign(url.href);
    } catch (cause) { setError(apiError(cause)); }
    finally { setBusy(""); }
  }

  async function disconnect(connector: CatalogConnector) {
    if (!window.confirm(`断开“${connector.name}”的授权连接？`)) return;
    setBusy("disconnect"); setError("");
    try {
      await disconnectConnector(connector.id);
      const disconnected = (item: Connector): Connector => item.id === connector.id ? { ...item, status: "disconnected", connectedAt: undefined } : item;
      setConnectors(useWorkspaceStore.getState().connectors.map(disconnected));
      setVerified((items) => items?.map(disconnected) ?? null);
      setNotice(`已断开“${connector.name}”。`);
    } catch (cause) { setError(apiError(cause)); }
    finally { setBusy(""); }
  }

  function saveCustom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (!name.trim()) { setError("请填写连接器名称。"); return; }
    let url: URL;
    try { url = new URL(endpoint.trim()); }
    catch { setError("请填写有效的 HTTPS 服务地址。"); return; }
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
      setError("服务地址必须使用 HTTPS，且不能包含账号、密码、查询参数或片段。请勿在地址中填写密钥。"); return;
    }
    try {
      const id = `custom-${crypto.randomUUID()}`;
      upsertConnector({ id, name: name.trim(), description: description.trim() || "自定义 MCP 连接器配置", provider: "custom", status: "disconnected", scopes: [], endpoint: url.href, transport });
      navigateTo(workspaceRoutes.connectorDetail(id));
    } catch { setError("无法保存配置，请检查浏览器本地存储权限。"); }
  }

  function removeCustom(connector: CatalogConnector) {
    if (!window.confirm(`删除“${connector.name}”的本地配置？`)) return;
    try {
      setConnectors(useWorkspaceStore.getState().connectors.filter((item) => item.id !== connector.id));
      navigateTo(workspaceRoutes.connectors);
    } catch { setError("无法删除配置，请检查浏览器本地存储权限。"); }
  }

  return <div className="workbuddy-app connectors-workspace">
    <WorkBuddySidebar active="connectors" projectCount={listProjects().length} go={navigateTo} setNotice={setNotice} />
    <div className="connectors-main">
      <header className="connectors-topbar">
        <MarketNavigation active="connectors" />
        <div className="connectors-header-actions">
          <label className="connectors-search"><HomeIcon name="search" /><input type="search" aria-label="搜索连接器" placeholder="搜索连接器" value={search} disabled={route.page !== "marketplace"} onChange={(event) => setSearch(event.target.value)} /></label>
          <button className="connectors-custom-control" onClick={() => navigateTo(workspaceRoutes.createConnector)}><HomeIcon name="pencil" />自定义连接器</button>
        </div>
      </header>
      <main className="connectors-content" aria-label="连接器市场">
        {notice && <div className="connectors-message" role="status"><span>{notice}</span><button aria-label="关闭提示" onClick={() => setNotice("")}>×</button></div>}
        {error && <div className="connectors-message is-error" role="alert"><span>{error}</span><button aria-label="关闭错误" onClick={() => setError("")}>×</button></div>}

        {route.page === "marketplace" && <>
          <div className="connectors-grid">{visible.map((connector) => {
            const connected = verified?.some((item) => item.id === connector.id && item.status === "connected");
            return <article className="connector-tile" key={connector.id}>
              <button className="connector-tile-open" aria-label={`查看${connector.name}`} onClick={() => navigateTo(workspaceRoutes.connectorDetail(connector.id))}><ConnectorIcon connector={connector} /><span className="connector-tile-copy"><span className="connector-tile-title" title={connector.name}>{connector.name}</span><span className="connector-tile-description" title={connector.description}>{connector.description}</span></span></button>
              {(connected || connector.id === "github") && <span className={`connector-status-dot ${connected ? "is-connected" : "is-unverified"}`} role="img" aria-label={connected ? "服务端已确认连接" : "授权状态待核验"} title={connected ? "服务端已确认连接" : "授权状态待核验"} />}
              <button className="connector-configure-button" aria-label={`配置${connector.name}`} title="查看接入说明与连接配置" onClick={() => navigateTo(workspaceRoutes.connectorDetail(connector.id))}><HomeIcon name={connected ? "check" : "plus"} size={16} /></button>
            </article>;
          })}</div>
          {visible.length === 0 && <div className="connectors-empty" role="status"><HomeIcon name="link" size={32} /><h1>没有找到匹配的连接器</h1><p>试试其他关键词，或添加自己的连接器配置。</p><button className="connectors-secondary" onClick={() => setSearch("")}>清除搜索</button></div>}
        </>}

        {route.page === "create" && <form className="connector-detail-panel" onSubmit={saveCustom}>
          <button type="button" className="connectors-back" onClick={() => navigateTo(workspaceRoutes.connectors)}>← 返回连接器市场</button>
          <h1>自定义连接器</h1><p>保存你自己的 MCP 服务配置。不会请求该地址或自动建立连接。</p>
          <label>连接器名称<input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：团队知识库" /></label>
          <label>连接器说明<textarea rows={3} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="描述这个服务的用途" /></label>
          <label>服务地址<input type="url" required maxLength={2048} value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder="https://your-server.example/mcp" aria-describedby="connector-endpoint-note" /></label>
          <small id="connector-endpoint-note">仅保存不含凭据、查询参数的 HTTPS 地址。请勿填写 API 密钥或访问令牌。</small>
          <label>传输协议<select aria-label="传输协议" value={transport} onChange={(event) => setTransport(event.target.value as NonNullable<Connector["transport"]>)}><option value="streamable-http">Streamable HTTP</option><option value="sse">SSE</option></select></label>
          <button className="connectors-primary" type="submit">保存配置</button>
        </form>}

        {route.page === "detail" && <section className="connector-detail-panel">
          <button className="connectors-back" onClick={() => navigateTo(workspaceRoutes.connectors)}>← 返回连接器市场</button>
          {selected ? <>
            <ConnectorIcon connector={selected} /><h1>{selected.name}</h1><p>{selected.description}</p>
            <div className="connector-service-note"><strong>{selected.custom ? (selectedState?.status === "connected" ? "自定义服务配置" : "本地配置，尚未建立连接") : selected.oauthProvider ? "授权接入说明" : "该服务尚未接入"}</strong><p>{selected.custom ? "配置保存在当前浏览器，不含密钥。保存配置不会发送网络请求，实际连接需服务端适配与身份验证，状态以服务端核验为准。" : selected.oauthProvider ? "授权由后端接口启动。只有服务端确认后才会显示已连接；客户端不收集或保存第三方密码、令牌。" : "卡片展示参考目录中的服务用途。本项目尚未接入该服务的 API、CLI 或 MCP 运行时，点击加号不会安装程序、授权账号或执行外部操作。"}</p></div>
            {selected.custom && <dl className="connector-config-values"><dt>服务地址</dt><dd>{selected.endpoint || "旧配置未填写服务地址"}</dd><dt>传输协议</dt><dd>{selected.transport === "sse" ? "SSE" : "Streamable HTTP"}</dd></dl>}
            {(selected.oauthProvider || selectedState) && <p className="connector-verified-status" role="status">连接状态：{verified === null ? "尚未向服务端核验" : selectedState?.status === "connected" ? "已连接（服务端确认）" : selectedState?.status === "pending" ? "等待授权完成" : selectedState?.status === "error" ? "连接异常" : "未连接"}</p>}
            <div className="connector-detail-actions">
              {selected.oauthProvider && <><button className="connectors-primary" disabled={!!busy} onClick={() => void authorize(selected)}>{busy === "authorize" ? "正在获取授权地址…" : "授权连接"}</button><button className="connectors-secondary" disabled={!!busy} onClick={() => void refresh()}>{busy === "refresh" ? "核验中…" : "刷新连接状态"}</button></>}
              {selectedState?.status === "connected" && <button className="connectors-secondary" disabled={!!busy} onClick={() => void disconnect(selected)}>{busy === "disconnect" ? "断开中…" : "断开连接"}</button>}
              {selected.custom && selectedState?.status !== "connected" && <button className="connectors-secondary" onClick={() => removeCustom(selected)}>删除本地配置</button>}
              {!selected.custom && !selected.oauthProvider && <button className="connectors-secondary" onClick={() => navigateTo(workspaceRoutes.createConnector)}>添加自定义服务配置</button>}
            </div>
          </> : <><h1>未找到该连接器</h1><p>该配置可能已删除，或不在当前浏览器中。</p></>}
        </section>}

        {route.page === "oauth" && <section className="connector-detail-panel"><h1>验证授权结果</h1><p>本页面只采用服务端返回的连接状态，不会根据地址栏参数判定授权成功。</p><div className="connector-detail-actions"><button className="connectors-primary" disabled={!!busy} onClick={() => void refresh()}>{busy ? "核验中…" : "重新核验"}</button><button className="connectors-secondary" onClick={() => navigateTo(workspaceRoutes.connectors)}>返回连接器市场</button></div></section>}
      </main>
    </div>
  </div>;
}
