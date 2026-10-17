import { useCallback, useEffect, useState } from "react";
import {
  fetchPluginBundles,
  fetchPluginEvents,
  installPluginBundle,
  setPluginBundleStatus,
  uninstallPluginBundle,
  type InstalledPlugin,
  type PluginBundle,
  type PluginEvent,
} from "../api/plugins";
import { HomeIcon } from "../../../apps/web/src/components/HomeIcon";
import { skillPermissionLabels } from "../../../shared/skillRuntime";
import "./plugins.css";

/**
 * The real plugin lifecycle: the server owns the bundles, the install state
 * and the log. Nothing here is a local "add to list" shortcut.
 */
export function PluginLifecyclePanel() {
  const [bundles, setBundles] = useState<PluginBundle[]>([]);
  const [installed, setInstalled] = useState<InstalledPlugin[]>([]);
  const [apiVersion, setApiVersion] = useState("");
  const [events, setEvents] = useState<PluginEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [state, log] = await Promise.all([fetchPluginBundles(), fetchPluginEvents()]);
      setBundles(state.bundles);
      setInstalled(state.installed);
      setApiVersion(state.apiVersion);
      setEvents(log);
      setError("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "插件接口暂时不可用。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function run(id: string, action: () => Promise<string>) {
    setBusy(id);
    setError("");
    setNotice("");
    try {
      setNotice(await action());
      await refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "操作失败。");
    } finally {
      setBusy("");
    }
  }

  const installedById = new Map(installed.map((item) => [item.id, item]));

  return <section className="pm-lifecycle" aria-label="插件生命周期">
    <header className="pm-lifecycle-head">
      <div>
        <span className="pm-lifecycle-eyebrow">服务端真实状态</span>
        <h2>插件包安装与启停</h2>
        <p>插件包是服务端已登记技能的真实组合：安装、停用、卸载都会写进服务器并留下日志。停用只会让它从插件面板消失，技能目录本身不受影响。</p>
      </div>
      <button type="button" className="pm-lifecycle-refresh" onClick={() => void refresh()} disabled={loading}>刷新</button>
    </header>
    {loading && <p className="pm-lifecycle-state" role="status">正在读取服务端插件清单…</p>}
    {error && <p className="pm-lifecycle-state is-error" role="alert">{error}</p>}
    {!loading && !error && (
      <div className="pm-lifecycle-grid">
        {bundles.map((bundle) => {
          const state = installedById.get(bundle.id);
          const disabled = state?.status === "disabled";
          return <article key={bundle.id} className={`pm-lifecycle-card${disabled ? " is-disabled" : ""}`}>
            <h3>{bundle.name}<span>v{bundle.version}</span></h3>
            <p>{bundle.description}</p>
            <div className="pm-lifecycle-meta">
              <span>包含 {bundle.skills.length} 个已注册技能</span>
              <span>权限：{bundle.permissions.map((permission) => skillPermissionLabels[permission] || permission).join("、")}</span>
              <span data-plugin-api={bundle.apiVersion}>插件接口 {bundle.apiVersion}</span>
              {bundle.requires.length > 0 && <span>需要：{bundle.requires.join("；")}</span>}
            </div>
            <p className={bundle.compatible ? "pm-lifecycle-compat" : "pm-lifecycle-compat is-error"}>
              {bundle.compatible
                ? `与当前服务端（插件接口 ${apiVersion}）兼容`
                : bundle.compatibleReason}
            </p>
            {state && state.skillVersions.length > 0 && (
              <p className="pm-lifecycle-versions">安装时解析到的技能版本：{state.skillVersions.join("、")}</p>
            )}
            <ul className="pm-lifecycle-skills">
              {bundle.skills.map((skill) => <li key={skill}>{skill}</li>)}
            </ul>
            <div className="pm-lifecycle-actions">
              {!state && <button type="button" onClick={() => void run(bundle.id, async () => {
                await installPluginBundle(bundle.id);
                return `已安装「${bundle.name}」。`;
              })} disabled={busy === bundle.id || !bundle.compatible}>安装</button>}
              {state && state.status === "enabled" && <button type="button" onClick={() => void run(bundle.id, async () => {
                await setPluginBundleStatus(bundle.id, "disabled");
                return `已停用「${bundle.name}」。`;
              })} disabled={busy === bundle.id}>停用</button>}
              {state && state.status === "disabled" && <button type="button" onClick={() => void run(bundle.id, async () => {
                await setPluginBundleStatus(bundle.id, "enabled");
                return `已启用「${bundle.name}」。`;
              })} disabled={busy === bundle.id}>启用</button>}
              {state && <button type="button" className="is-danger" onClick={() => void run(bundle.id, async () => {
                await uninstallPluginBundle(bundle.id);
                return `已卸载「${bundle.name}」。`;
              })} disabled={busy === bundle.id}>卸载</button>}
              {state && <span className="pm-lifecycle-state-tag">{state.status === "enabled" ? "已启用" : "已停用"}</span>}
            </div>
          </article>;
        })}
      </div>
    )}
    {notice && <p className="pm-lifecycle-state" role="status">{notice}</p>}
    <details className="pm-lifecycle-log">
      <summary>生命周期日志（{events.length}）</summary>
      {events.length === 0 ? <p className="pm-lifecycle-state">还没有安装或启停记录。</p> : <ol>
        {events.map((event) => <li key={event.id}>
          <b>{event.action === "installed" ? "安装" : event.action === "enabled" ? "启用" : event.action === "disabled" ? "停用" : "卸载"}</b>
          <span>{event.pluginId}</span>
          <small>{event.detail}</small>
          <time>{new Date(event.createdAt).toLocaleString("zh-CN")}</time>
        </li>)}
      </ol>}
    </details>
    <p className="pm-lifecycle-foot"><HomeIcon name="shield" size={15} />插件包不执行第三方代码：它只组合服务端已登记并受权限约束的技能。</p>
  </section>;
}
