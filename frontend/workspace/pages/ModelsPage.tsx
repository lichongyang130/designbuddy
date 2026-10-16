import { useCallback, useEffect, useState } from "react";
import { HomeIcon } from "../../../apps/web/src/components/HomeIcon";
import { WorkBuddySidebar } from "../../../apps/web/src/components/WorkBuddySidebar";
import { MarketNavigation } from "../MarketNavigation";
import { fetchAiQuota, fetchAiUsage, fetchModelRegistry, type AiUsageReport, type ModelRegistry, type QuotaProbe } from "../api/models";
import { modelOptions as productModels } from "../taskModels";
import { navigateTo } from "../workspaceRoutes";
import "./models.css";

const optionFields: { platform: string; wire: string; note: string }[] = [
  { platform: "temperature", wire: "temperature", note: "采样温度，0–2。服务端默认 0.4。" },
  { platform: "maxTokens", wire: "max_tokens", note: "单次回复上限，1–128000。" },
  { platform: "topP", wire: "top_p", note: "核采样，0–1（不含 0）。" },
  { platform: "responseFormat", wire: "response_format", note: "只支持 json_object，其余取值会被拒绝并回报。" },
];

function time(value: number): string {
  return new Date(value).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/**
 * Model registry and real usage.
 *
 * Everything on this page comes from the server: the registered models, the
 * parameters the implemented protocol can carry, whether the provider confirmed
 * a model id, and the usage the provider reported. Nothing here is estimated.
 */
export default function ModelsPage() {
  const [registry, setRegistry] = useState<ModelRegistry | null>(null);
  const [usage, setUsage] = useState<AiUsageReport | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [quota, setQuota] = useState<QuotaProbe | null>(null);
  const [quotaBusy, setQuotaBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [modelRegistry, usageReport] = await Promise.all([fetchModelRegistry(), fetchAiUsage()]);
      setRegistry(modelRegistry);
      setUsage(usageReport);
      setError("");
    } catch (cause) {
      setRegistry(null);
      setUsage(null);
      setError(cause instanceof Error && cause.message.length < 200 ? cause.message : "模型服务暂不可用，请确认后端已启动。");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function checkQuota() {
    setQuotaBusy(true);
    try {
      setQuota(await fetchAiQuota());
    } catch (cause) {
      setQuota({
        provider: "—",
        supported: false,
        balance: null,
        unit: null,
        detail: cause instanceof Error && cause.message.length < 200 ? cause.message : "额度查询失败。",
        error: "额度查询失败。",
      });
    } finally {
      setQuotaBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setNotice("");
    try {
      const next = await fetchModelRegistry(true);
      setRegistry(next);
      setNotice(next.live?.error ? `核验未完成：${next.live.error}` : `核验完成：服务商返回了 ${next.live?.ids.length ?? 0} 个模型标识。`);
    } catch (cause) {
      setNotice(cause instanceof Error && cause.message.length < 200 ? cause.message : "核验请求失败。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="workbuddy-app models-workspace">
      <WorkBuddySidebar active="plugins" go={navigateTo} setNotice={setNotice} projectCount={0} />
      <main className="models-main" aria-label="模型与用量" data-loaded={registry || usage ? "true" : "false"}>
        <header className="models-topbar">
          <MarketNavigation active="connectors" className="models-nav" />
          <div className="models-actions">
            <button className="models-button" type="button" onClick={() => void load()}>刷新</button>
            <button className="models-button is-primary" type="button" onClick={() => void verify()} disabled={busy}>
              {busy ? "核验中…" : "向服务商核验模型列表"}
            </button>
          </div>
        </header>
        <div className="models-content">
          <section className="models-hero">
            <div>
              <span className="models-eyebrow">服务端登记 · 真实用量</span>
              <h1>模型与用量</h1>
              <p>这里只显示服务端真正知道的事：登记的模型、协议能承载的参数、服务商确认过的标识，以及服务商回报的真实用量。</p>
            </div>
          </section>

          {(error || notice) && <p className={error ? "models-message is-error" : "models-message"} role="status">{error || notice}</p>}

          <section className="models-card" aria-label="服务配置">
            <h2>服务配置</h2>
            <dl className="models-facts">
              <div><dt>协议</dt><dd>{registry?.protocol ?? "—"}</dd></div>
              <div><dt>凭据</dt><dd>{registry ? (registry.configured ? "已配置（AI_API_KEY / OPENAI_API_KEY）" : "未配置：模型调用会直接失败") : "—"}</dd></div>
              <div><dt>接口地址</dt><dd>{registry?.baseUrl ?? "—"}</dd></div>
              <div><dt>默认模型</dt><dd>{registry?.defaultModel ?? "—"}</dd></div>
            </dl>
            {registry?.note && <p className="models-note">{registry.note}</p>}
          </section>

          <section className="models-card" aria-label="额度">
            <div className="models-card-head">
              <h2>额度</h2>
              <button className="models-button" type="button" onClick={() => void checkQuota()} disabled={quotaBusy}>
                {quotaBusy ? "查询中…" : "向服务商查询额度"}
              </button>
            </div>
            {quota ? (
              <div data-quota="ready">
                <dl className="models-facts">
                  <div><dt>服务商</dt><dd>{quota.provider}</dd></div>
                  <div><dt>剩余额度</dt><dd>{quota.balance === null ? "未知" : `${quota.balance} ${quota.unit ?? ""}`}</dd></div>
                  <div><dt>接口支持</dt><dd>{quota.supported ? "服务商提供额度查询接口" : "服务商没有公开的额度接口"}</dd></div>
                </dl>
                <p className="models-note">{quota.detail}</p>
              </div>
            ) : (
              <p className="models-note">额度只在点击查询时向服务商发起；平台不会展示估算的余额。</p>
            )}
          </section>

          <section className="models-card" aria-label="已登记模型">
            <h2>已登记模型</h2>
            <table className="models-table">
              <thead>
                <tr><th>模型标识</th><th>服务商</th><th>上下文窗口</th><th>图片输入</th><th>核验状态</th></tr>
              </thead>
              <tbody>
                {(registry?.catalog ?? []).map((model) => (
                  <tr key={`${model.provider}:${model.id}`}>
                    <td><code>{model.id}</code></td>
                    <td>{model.provider}</td>
                    <td>{model.contextWindow === null ? "未核验" : model.contextWindow.toLocaleString("zh-CN")}</td>
                    <td>{model.acceptsImages === null ? "未核验" : model.acceptsImages ? "支持" : "不支持"}</td>
                    <td>
                      <span className={`models-tag ${model.verified ? "is-ok" : "is-warn"}`}>
                        {model.verified ? "服务商已确认" : "未核验"}
                      </span>
                    </td>
                  </tr>
                ))}
                {!registry?.catalog.length && <tr><td colSpan={5}>没有登记任何模型。</td></tr>}
              </tbody>
            </table>
            {registry?.live?.ids.length ? (
              <p className="models-note">服务商返回的模型标识：{registry.live.ids.slice(0, 12).join("、")}{registry.live.ids.length > 12 ? ` 等 ${registry.live.ids.length} 个` : ""}。</p>
            ) : null}
          </section>

          <section className="models-card" aria-label="产品可选模型">
            <h2>产品可选模型</h2>
            <p className="models-note">对话菜单里的模型会按标识原样发给服务商。下面的倍率是产品声明，未经服务商核验；服务端核验的只是它返回的模型列表。</p>
            <table className="models-table">
              <thead>
                <tr><th>模型</th><th>标识</th><th>产品倍率</th><th>优惠标签</th><th>服务端核验</th></tr>
              </thead>
              <tbody>
                {productModels.map((model) => (
                  <tr key={model.name}>
                    <td>{model.name}</td>
                    <td><code>{model.id || "（空标识）"}</code></td>
                    <td>{model.cost || "—"}</td>
                    <td>{model.badge || "—"}</td>
                    <td>
                      <span className="models-tag is-warn">
                        {registry?.catalog.some((item) => item.id === model.id) ? "登记为服务端默认模型" : "需服务商确认"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="models-card" aria-label="参数映射">
            <h2>参数映射</h2>
            <table className="models-table">
              <thead>
                <tr><th>平台参数</th><th>协议字段</th><th>说明</th></tr>
              </thead>
              <tbody>
                {optionFields.map((field) => (
                  <tr key={field.platform}>
                    <td><code>{field.platform}</code></td>
                    <td><code>{field.wire}</code></td>
                    <td>{field.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="models-note">服务商不支持的参数会被服务端拒绝并明确回报，不会被悄悄丢掉。当前实现的协议是 OpenAI 兼容格式。</p>
          </section>

          <section className="models-card" aria-label="真实用量">
            <h2>真实用量</h2>
            {usage ? (
              <>
                <dl className="models-facts">
                  <div><dt>调用次数</dt><dd>{usage.totals.calls}</dd></div>
                  <div><dt>服务商回报用量的调用</dt><dd>{usage.totals.reportedCalls}</dd></div>
                  <div><dt>失败调用</dt><dd>{usage.totals.failedCalls}</dd></div>
                  <div><dt>输入 token</dt><dd>{usage.totals.promptTokens.toLocaleString("zh-CN")}</dd></div>
                  <div><dt>输出 token</dt><dd>{usage.totals.completionTokens.toLocaleString("zh-CN")}</dd></div>
                  <div><dt>合计 token</dt><dd>{usage.totals.totalTokens.toLocaleString("zh-CN")}</dd></div>
                </dl>
                <p className="models-note">{usage.note}</p>
                <table className="models-table">
                  <thead>
                    <tr><th>时间</th><th>模型</th><th>服务商</th><th>用量</th><th>耗时</th><th>结果</th></tr>
                  </thead>
                  <tbody>
                    {usage.usage.map((row) => (
                      <tr key={row.id}>
                        <td>{time(row.createdAt)}</td>
                        <td><code>{row.model}</code></td>
                        <td>{row.provider}</td>
                        <td>{row.reported ? `${row.totalTokens ?? 0} token` : "服务商未回报"}</td>
                        <td>{row.latencyMs} ms</td>
                        <td>
                          <span className={`models-tag ${row.status === "succeeded" ? "is-ok" : "is-warn"}`}>
                            {row.status === "succeeded" ? "成功" : "失败"}
                          </span>
                          {row.error ? <span className="models-row-error">{row.error}</span> : null}
                        </td>
                      </tr>
                    ))}
                    {!usage.usage.length && <tr><td colSpan={6}>还没有调用记录。</td></tr>}
                  </tbody>
                </table>
              </>
            ) : (
              <p className="models-note">用量统计暂不可用。</p>
            )}
          </section>

          <p className="models-footnote">
            <HomeIcon name="help" size={12} /> 用量只统计本次登录账号的调用；未回报用量的调用不会被估算成数字。
          </p>
        </div>
      </main>
    </div>
  );
}
