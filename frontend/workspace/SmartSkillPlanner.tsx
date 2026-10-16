import { useEffect, useRef, useState } from "react";
import { apiJSON } from "../../apps/web/src/api/client";
import type { RuntimeSkill, SkillRun } from "../../shared/skillRuntime";
import type { SkillPlan, SkillFileIdentity } from "../../shared/skillPlanning";
import { getAIProviderCredentials } from "./AIProviderSettings";
import { expertCatalog } from "./expertCatalog";

const labels: Record<SkillPlan["status"], string> = { planning: "模型规划中 · 未执行", review: "待你确认 · 未执行", clarify: "需要澄清 · 未执行", unsupported: "当前不支持 · 未执行", failed: "规划失败 · 未执行", cancelled: "已取消方案 · 未执行", executed: "已提交真实执行" };
const normalizedName = (name: string) => name.replace(/[\x00-\x1f\x7f/\\]/g, "_").slice(0, 120);
export async function identifySkillFile(file: File): Promise<SkillFileIdentity> {
  if (!file.size || file.size > 2_000_000) throw Error("请选择不超过2MB的非空文件。");
  const hash = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return { name: normalizedName(file.name), size: file.size, sha256: [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("") };
}
export default function SmartSkillPlanner({ expertId, taskId, initialGoal = "", model, permission, catalog, skillScope, onRun }: { expertId?: string; taskId?: string; initialGoal?: string; model?: string; permission?: string; catalog: RuntimeSkill[]; skillScope?: string[]; onRun: (run: SkillRun) => void }) {
  const [goal, setGoal] = useState(initialGoal);
  const scopeQuery = taskId ? `?taskId=${encodeURIComponent(taskId)}` : "";
  const [file, setFile] = useState<{ value: File; identity: SkillFileIdentity } | null>(null);
  const [plans, setPlans] = useState<SkillPlan[]>([]), [selected, setSelected] = useState("");
  const [consent, setConsent] = useState(false), [approval, setApproval] = useState(false);
  const [busy, setBusy] = useState(""), [error, setError] = useState("");
  const [ready, setReady] = useState(false), [configured, setConfigured] = useState(false), [refresh, setRefresh] = useState(0);
  const [inputVersion, setInputVersion] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const epoch = useRef(0), revision = useRef(0), lock = useRef(false), fileSequence = useRef(0);
  const controllers = useRef(new Set<AbortController>());
  const onRunRef = useRef(onRun); onRunRef.current = onRun;
  const attempt = useRef<{ signature: string; id: string } | null>(null);
  const request = <T,>(path: string, init: RequestInit = {}) => {
    const controller = new AbortController(); controllers.current.add(controller);
    return apiJSON<T>(path, { ...init, signal: controller.signal, retryOnIdentityChange: false }).finally(() => controllers.current.delete(controller));
  };
  const scopeKey = skillScope ? [...skillScope].sort().join("\u0000") : "";
  const visible = plans.filter(p => (!expertId || p.expertScope === expertId || (p.decision?.kind === "plan" && p.decision.expertId === expertId)) && (!skillScope || (p.skillScope || []).slice().sort().join("\u0000") === scopeKey));
  const current = visible.find(p => p.id === selected);
  const expired = !!current && Date.parse(current.expiresAt) <= clock;
  const matches = !!file && !!current && file.identity.sha256 === current.file.sha256 && file.identity.name === current.file.name && file.identity.size === current.file.size;
  const decision = current?.decision?.kind === "plan" ? current.decision : undefined;
  const skill = catalog.find(s => s.id === decision?.skillId);
  const pending = plans.some(p => p.status === "planning");
  function upsert(plan: SkillPlan) { revision.current++; setPlans(old => [plan, ...old.filter(p => p.id !== plan.id)]); setSelected(plan.id); setApproval(false); }
  useEffect(() => {
    const reset = () => { epoch.current++; fileSequence.current++; revision.current++; lock.current = false; for (const c of controllers.current) c.abort(); controllers.current.clear(); attempt.current = null; setBusy(""); setInputVersion(n => n + 1); setFile(null); setPlans([]); setSelected(""); setGoal(""); setConsent(false); setApproval(false); setReady(false); setRefresh(n => n + 1); };
    window.addEventListener("designbuddy:server-identity", reset);
    return () => { window.removeEventListener("designbuddy:server-identity", reset); epoch.current++; for (const c of controllers.current) c.abort(); };
  }, []);
  useEffect(() => {
    let stopped = false; const identity = epoch.current; const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      const version = revision.current;
      try {
        const value = await apiJSON<{ plans: SkillPlan[]; serverConfigured: boolean }>(`/skill-plans${scopeQuery}`, { signal: controller.signal });
        if (stopped || identity !== epoch.current) return;
        setConfigured(value.serverConfigured); setReady(true);
        if (revision.current === version) {
          setPlans(value.plans);
          const own = value.plans.filter(p => (!expertId || p.expertScope === expertId || (p.decision?.kind === "plan" && p.decision.expertId === expertId)) && (!skillScope || (p.skillScope || []).slice().sort().join("\u0000") === scopeKey));
          setSelected(id => own.find(p => p.requestId === attempt.current?.id)?.id || (own.some(p => p.id === id) ? id : own[0]?.id || ""));
        }
      } catch (e) { if (!stopped && identity === epoch.current) setError(e instanceof Error ? e.message : "无法读取方案记录。"); }
      if (!stopped) timer = setTimeout(load, pending || busy === "planning" ? 1200 : 10000);
    };
    void load(); return () => { stopped = true; controller.abort(); clearTimeout(timer); };
  }, [refresh, pending, busy === "planning", expertId, taskId, scopeKey]);
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => setApproval(false), [selected]);
  useEffect(() => {
    if (current?.status !== "executed" || !current.runId) return;
    const identity = epoch.current; const controller = new AbortController();
    apiJSON<SkillRun>(`/skill-runs/${current.runId}`, { signal: controller.signal, retryOnIdentityChange: false }).then(run => {
      if (!controller.signal.aborted && identity === epoch.current) onRunRef.current(run);
    }).catch(e => { if (!controller.signal.aborted && identity === epoch.current) setError(e instanceof Error ? e.message : "运行记录读取失败；不会自动重新执行。"); });
    return () => controller.abort();
  }, [current?.status, current?.runId]);
  async function chooseFile(value?: File) {
    if (lock.current) return;
    const sequence = ++fileSequence.current, identity = epoch.current;
    setFile(null); setApproval(false); setError(""); attempt.current = null;
    if (!value) return;
    setBusy("hash"); lock.current = true;
    try { const metadata = await identifySkillFile(value); if (sequence === fileSequence.current && identity === epoch.current) setFile({ value, identity: metadata }); }
    catch (e) { if (identity === epoch.current) setError(e instanceof Error ? e.message : "文件校验失败。"); }
    finally { if (identity === epoch.current) { lock.current = false; setBusy(""); } }
  }
  async function propose() {
    if (lock.current || !file || !consent || !goal.trim()) return;
    lock.current = true; setBusy("planning"); setError(""); setApproval(false); setSelected(""); revision.current++;
    const version = revision.current;
    const identity = epoch.current;
    const credentials = getAIProviderCredentials();
    const signature = JSON.stringify({ goal: goal.trim(), file: file.identity, expertId, skillScope: skillScope || null, taskId, model, provider: credentials.provider || "server" });
    if (attempt.current?.signature !== signature) attempt.current = { signature, id: crypto.randomUUID() };
    try {
      const plan = await request<SkillPlan>("/skill-plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: attempt.current.id, goal: goal.trim(), file: file.identity, ...(expertId ? { expertScope: expertId } : {}), ...(skillScope ? { skillScope } : {}), consent: true, ...(taskId ? { taskId } : {}), ...(model ? { model } : {}), ...(permission ? { permission } : {}), ...credentials }) });
      if (identity !== epoch.current) return;
      if (version !== revision.current) { setRefresh(n => n + 1); return; }
      upsert(plan); if (plan.status !== "planning") attempt.current = null;
    } catch (e) { if (identity === epoch.current) setError(`${e instanceof Error ? e.message : "规划请求失败。"} 请先刷新方案记录；相同任务重试会沿用请求标识。`); }
    finally { if (identity === epoch.current) { lock.current = false; setBusy(""); } }
  }
  async function approve() {
    if (lock.current || !current || current.status !== "review" || !matches || !approval || expired || !file) return;
    lock.current = true; setBusy("approve"); setError(""); revision.current++; const identity = epoch.current;
    try {
      const form = new FormData(); form.set("file", file.value); form.set("planId", current.id); form.set("approvalDigest", current.approvalDigest!); form.set("consent", "true");
      const run = await request<SkillRun>("/skill-runs", { method: "POST", body: form });
      if (identity !== epoch.current) return;
      upsert({ ...current, status: "executed", runId: run.id }); onRun(run);
    } catch (e) { if (identity === epoch.current) { setError(`${e instanceof Error ? e.message : "提交结果未知。"} 请检查方案及运行记录；重复确认同一方案不会新建第二个任务。`); setRefresh(n => n + 1); } }
    finally { if (identity === epoch.current) { lock.current = false; setBusy(""); } }
  }
  async function changePlan(deleting: boolean) {
    if (!current || (lock.current && busy !== "planning")) return;
    if (deleting && !window.confirm("删除这份方案？不会删除已提交的运行及文件，也不会允许原请求再次执行。")) return;
    const identity = epoch.current; const id = current.id; revision.current++;
    try {
      const result = await request<SkillPlan>(`/skill-plans/${id}${deleting ? "" : "/cancel"}`, { method: deleting ? "DELETE" : "POST" });
      if (identity !== epoch.current) return;
      revision.current++;
      if (deleting) { setPlans(old => old.filter(p => p.id !== id)); setSelected(""); setApproval(false); } else upsert(result);
    } catch (e) { if (identity === epoch.current) setError(e instanceof Error ? e.message : "方案操作失败。"); }
  }
  return <details className="skill-smart-planner" open={taskId ? true : undefined}>
    <summary><strong>描述任务，让模型建议技能</strong><span>先看方案 · 确认后才执行</span></summary>
    <section aria-label="模型技能规划" className="skill-planner-body">
      <p className="skill-workbench-note">仅建议一个已接通的工具，不是自动多步代理。模型仅接收任务描述、文件名与大小，不读取文件正文；SHA-256用于后台绑定文件。文件正文仅在你确认执行后上传应用后台，不交给规划模型。格式和内容仍需执行器实际校验。</p>
      <p className="skill-workbench-note">{expertId ? `固定专家：${expertCatalog.find(e => e.id === expertId)?.name || expertId}，不会自动切换。` : "在内置专家已接通的技能中选择一位主专家。"} {ready && !configured && !getAIProviderCredentials().apiKey ? "当前未配置模型，可在左下角账号菜单 → 设置 → AI Provider中配置；也可直接使用下方手动执行。" : "模型是否可用以实际规划结果为准。"}</p>
      <label>任务描述<textarea rows={3} maxLength={4000} value={goal} disabled={!!busy} onChange={e => { setGoal(e.target.value); setApproval(false); attempt.current = null; }} placeholder="例如：计算CSV各数值字段的合计，并去除所有字段相同的重复行。不要填写密码或密钥。" /></label>
      <label>选择规划材料（先在浏览器校验）<input key={inputVersion} type="file" disabled={!!busy} onChange={e => void chooseFile(e.target.files?.[0])} /></label>
      {file && <p className="skill-workbench-note">已在浏览器校验：{file.identity.name} · {file.identity.size} 字节 · SHA-256 <code>{file.identity.sha256}</code></p>}
      <label className="skill-runtime-check"><input type="checkbox" checked={consent} disabled={!!busy} onChange={e => setConsent(e.target.checked)} />允许将任务描述、文件名和大小发送给已配置模型用于建议技能（不是“仅本地”操作）；不代表同意上传正文或执行。方案保存在后台，可单独删除；模型服务的数据留存以其政策为准。</label>
      <div className="skill-planner-actions"><button type="button" className="skill-runtime-primary" disabled={!ready || !!busy || !file || !consent || !goal.trim()} onClick={() => void propose()}>{busy === "planning" ? "正在请求真实模型…" : "生成技能方案（不执行）"}</button><button type="button" disabled={busy === "approve"} onClick={() => setRefresh(n => n + 1)}>刷新方案记录</button></div>
      {error && <p role="alert" className="skill-workbench-error">{error}</p>}
      <label>已保存方案<select aria-label="选择技能方案" disabled={busy === "approve"} value={selected} onChange={e => { setSelected(e.target.value); setApproval(false); }}>{!selected && <option value="">请选择方案</option>}{visible.map(p => <option key={p.id} value={p.id}>{p.file.name} · {labels[p.status]} · {new Date(p.createdAt).toLocaleString()}</option>)}</select></label>
      {!visible.length && <p className="skill-workbench-note">还没有方案。每用户最多50份、24小时20次模型规划；不影响手动选择技能。</p>}
      {current && <article className="skill-plan-review" aria-label="待确认技能方案">
        <div className="skill-run-heading"><b>{current.file.name}</b><span role="status">{current.status === "review" && expired ? "方案已过期 · 未执行" : labels[current.status]}</span></div>
        <p className="skill-plan-goal">原始任务：{current.goal}</p>
        {current.error && <p role="alert" className="skill-workbench-error">{current.error}</p>}
        {current.decision?.kind === "unsupported" && <p>{current.decision.reason} 不会用较弱工具冒充完成；可以改写任务或使用手动入口。</p>}
        {current.decision?.kind === "clarify" && <div><b>{current.decision.question}</b><div className="skill-planner-actions">{current.decision.options.map(option => <button type="button" key={option} disabled={!!busy} onClick={() => { setGoal(`${current.goal}\n补充：${option}`.slice(0,4000)); attempt.current = null; }}>{option}（补充任务，不发送）</button>)}</div><p className="skill-workbench-note">也可自行修改任务描述，再点击生成；回答不会自动执行。</p></div>}
        {decision && <>
          <dl><dt>主专家</dt><dd>{expertCatalog.find(e => e.id === decision.expertId)?.name || decision.expertId}</dd><dt>单次技能</dt><dd>{skill?.name || decision.skillId} · v{current.skillVersion}</dd><dt>建议理由</dt><dd>{decision.reason}</dd><dt>真实交付</dt><dd>{skill?.outputs.join("、")}</dd><dt>能力边界</dt><dd>{skill?.limits}</dd><dt>冻结参数</dt><dd>{decision.skillId === "table.analyze" ? `全字段相同的重复行：${decision.options.deduplicate ? "去除" : "保留"}` : "不启用表格去重"}{decision.options.parameters && <ul>{Object.entries(decision.options.parameters).map(([key,value]) => { const field = skill?.parameterFields?.find(f => f.name === key); return <li key={key}>{field?.label || key}：{field?.choices?.find(c => c.value === value)?.label || value || "（空）"}</li>; })}</ul>}</dd></dl>
          <p className="skill-workbench-note">绑定文件：{current.file.name} · {current.file.size} 字节<br/>SHA-256：<code>{current.file.sha256}</code><br/>有效至：{new Date(current.expiresAt).toLocaleString()}（15分钟）。修改任务或参数后必须重新规划，不能覆盖这份已保存方案。</p>
          {current.status === "review" && <>
            {!matches && <p className="skill-workbench-note">请重新选择与方案完全相同的文件；刷新页面后不会保留浏览器文件。当前文件不匹配，不能确认执行。</p>}
            <label className="skill-runtime-check"><input type="checkbox" checked={approval} disabled={!!busy || !matches || expired} onChange={e => setApproval(e.target.checked)} />我已核对以上冻结方案，同意上传绑定文件到应用后台，并执行这一项技能。文件、运行与成果保存在后台，直到删除运行；不会自动调用其他工具或外部业务服务。</label>
            <button type="button" className="skill-runtime-primary" disabled={!!busy || !approval || !matches || expired} onClick={() => void approve()}>{busy === "approve" ? "正在确认提交…" : "确认方案并执行一次"}</button>
          </>}
        </>}
        {current.status === "executed" && <p className="skill-workbench-note">运行编号：<code>{current.runId}</code>。执行结果以“我的运行记录”为准；取消或删除运行不会自动重新执行此方案。</p>}
        <div className="skill-planner-actions">{["planning","review"].includes(current.status) && <button type="button" disabled={!!busy && busy !== "planning"} onClick={() => void changePlan(false)}>取消此方案</button>}<button type="button" disabled={!!busy && busy !== "planning"} onClick={() => void changePlan(true)}>删除此方案</button></div>
      </article>}
      <p className="skill-workbench-note">方案失败、取消、过期或任务不适合时，下面的手动执行入口始终保留。手动执行不会调用模型。</p>
    </section>
  </details>;
}
