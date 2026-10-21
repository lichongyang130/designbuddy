import { useEffect, useRef, useState } from "react";
import { apiFetch, apiJSON } from "../../apps/web/src/api/client";
import type { RuntimeSkill, SkillRun } from "../../shared/skillRuntime";
import { useRuntimeActivity } from "./runtimeActivity";
import { expertCatalog } from "./expertCatalog";
import "./skill-workbench.css";
import PosterLayoutEditor from "./PosterLayoutEditor";
import SmartSkillPlanner, { identifySkillFile } from "./SmartSkillPlanner";

const labels = { queued: "等待执行", running: "正在执行", succeeded: "执行成功", failed: "执行失败", cancelled: "已取消" };
const terminal = (run: SkillRun) => !["running", "queued"].includes(run.status);
export default function SkillWorkbench({ expertId, taskId, initialGoal = "", model, permission, allowedSkillIds, initialSkillId, onSkillExecute, onArtifactHandoff, autoContent }: { expertId?: string; taskId?: string; initialGoal?: string; model?: string; permission?: string; allowedSkillIds?: string[]; initialSkillId?: string; onSkillExecute?: (skillId: string, skillName: string) => void; onArtifactHandoff?: (handoff: { name: string; content: string; skillId: string; runId: string }) => void; autoContent?: string }) {
  const scopeQuery = taskId ? `?taskId=${encodeURIComponent(taskId)}` : "";
  const mutations = useRef(0);
  const epoch = useRef(0);
  const submission = useRef<{ signature: string; id: string } | null>(null);
  const sending = useRef(false);
  const submissionController = useRef<AbortController | null>(null);
  const removedRuns = useRef(new Set<string>());
  const [catalog, setCatalog] = useState<RuntimeSkill[]>([]);
  const [runs, setRuns] = useState<SkillRun[]>([]);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState(initialSkillId || "");
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [parameters, setParameters] = useState<Record<string, string>>({ title: "", subtitle: "", action: "" });
  const [deduplicate, setDeduplicate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [focusId, setFocusId] = useState("");
  const [preview, setPreview] = useState<{ url: string; kind: string } | null>(null);
  useEffect(() => {
    const changed = () => { epoch.current++; submissionController.current?.abort(); removedRuns.current.clear(); submission.current = null; sending.current = false; mutations.current++; setRuns([]); setCatalog([]); setPreview(null); setFile(null); setConsent(false); setParameters({ title: "", subtitle: "", action: "" }); setBusy(false); setRefresh(value => value + 1); };
    window.addEventListener("designbuddy:server-identity", changed);
    return () => window.removeEventListener("designbuddy:server-identity", changed);
  }, []);
  useEffect(() => {
    const controller = new AbortController(); epoch.current++; submissionController.current?.abort(); submission.current = null; sending.current = false; setBusy(false); setLoaded(false); setCatalog([]); setRuns([]); setError(""); setFile(null); setConsent(false); setFocusId("");
    Promise.all([apiJSON<{ skills: RuntimeSkill[] }>("/skill-runtime", { signal: controller.signal }), apiJSON<{ runs: SkillRun[] }>(`/skill-runs${scopeQuery}`, { signal: controller.signal })]).then(([c, r]) => {
      if (controller.signal.aborted) return;
      setCatalog(c.skills); setRuns(r.runs); setLoaded(true);
      const first = c.skills.find(s => s.id === initialSkillId && s.status === "ready" && (!expertId || s.expertIds.includes(expertId))) || c.skills.find(s => s.status === "ready" && (!expertId || s.expertIds.includes(expertId)));
      setSelected(first?.id || "");
      setParameters(Object.fromEntries((first?.parameterFields || []).map(f => [f.name, f.defaultValue || ""])));
    }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "技能后台不可用。"); });
    return () => { controller.abort(); submissionController.current?.abort(); };
  }, [expertId, taskId, refresh, initialSkillId]);
  const pending = runs.some(r => !terminal(r));
  useRuntimeActivity(busy || pending);
  useEffect(() => {
    if (!pending) return;
    let stopped = false; let timer: ReturnType<typeof setTimeout>; const controller = new AbortController();
    const poll = async () => {
      try {
        const before = mutations.current;
        const r = await apiJSON<{ runs: SkillRun[] }>(`/skill-runs${scopeQuery}`, { signal: controller.signal });
        if (!stopped) {
          if (before !== mutations.current) { timer = setTimeout(poll, 600); return; }
          setRuns(r.runs); if (r.runs.some(r => !terminal(r))) timer = setTimeout(poll, 1000);
        }
      } catch (e) { if (!stopped) setError(`运行状态读取失败，请点击重新连接；不要重复提交。${e instanceof Error ? e.message : ""}`); }
    };
    timer = setTimeout(poll, 600);
    return () => { stopped = true; controller.abort(); clearTimeout(timer); };
  }, [pending, taskId, refresh]);
  
  // Auto-populate file from AI-generated content
  useEffect(() => {
    if (autoContent && !file) {
      const blob = new Blob([autoContent], { type: 'text/markdown' });
      const autoFile = new File([blob], 'ai-content.md', { type: 'text/markdown' });
      setFile(autoFile);
      setConsent(true); // Auto-consent when content is provided
    }
  }, [autoContent, file]);
  
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);
  useEffect(() => { setPreview(null); }, [focusId, expertId]);
  const scoped = catalog.filter(s => (!expertId || s.expertIds.includes(expertId)) && (!allowedSkillIds || allowedSkillIds.includes(s.id)));
  const relevant = scoped.filter(s => s.status === "ready");
  const unavailable = scoped.filter(s => s.status !== "ready");
  const available = relevant;
  const skill = available.find(s => s.id === selected);
  const visibleRuns = runs.filter(r => (!taskId || r.taskId === taskId) && (!expertId || r.expertId === expertId) && (!allowedSkillIds || allowedSkillIds.includes(r.skillId)));
  const current = visibleRuns.find(r => r.id === focusId) || visibleRuns[0];
  async function execute() {
    if (!file || !skill || !consent || busy || sending.current) return;
    sending.current = true;
    const identity = epoch.current;
    setBusy(true); setError(""); setPreview(null);
    
    // Notify parent about skill execution
    if (onSkillExecute) {
      onSkillExecute(skill.id, skill.name);
    }
    
    try {
      if (file.size > 2000000 || !file.size) throw Error("请选择不超过 2 MB 的非空文件。");
      const metadata = await identifySkillFile(file);
      if (identity !== epoch.current) return;
      const signature = JSON.stringify({ metadata, taskId, skillId: skill.id, expertId, deduplicate: skill.id === "table.analyze" && deduplicate, parameters: skill.parameterFields ? parameters : undefined });
      if (submission.current?.signature !== signature) submission.current = { signature, id: crypto.randomUUID() };
      const form = new FormData(); form.set("requestId", submission.current.id); form.set("file", file); form.set("skillId", skill.id); form.set("expertId", expertId || skill.expertIds[0]); form.set("consent", "true"); form.set("deduplicate", String(skill.id === "table.analyze" && deduplicate));
      if (taskId) form.set("taskId", taskId);
      if (permission) form.set("permission", permission);
      if (skill.parameterFields) form.set("parameters", JSON.stringify(parameters));
      submissionController.current = new AbortController();
      const run = await apiJSON<SkillRun>("/skill-runs", { method: "POST", body: form, signal: submissionController.current.signal, retryOnIdentityChange: false });
      if (identity !== epoch.current) return;
      mutations.current++; setRuns(old => [run, ...old.filter(r => r.id !== run.id)]); setFocusId(run.id);
    } catch (e) { if (identity === epoch.current) setError(e instanceof Error ? e.message : "提交失败。请检查运行记录，勿重复提交。"); }
    finally { if (identity === epoch.current) { sending.current = false; setBusy(false); } }
  }
  async function action(run: SkillRun, deleting: boolean) {
    if (deleting && !window.confirm("删除此运行的原始文件、处理记录和全部成果？此操作不可撤销，其他历史任务不受影响。")) return;
    const identity = epoch.current;
    setBusy(true); setError("");
    try {
      const result = await apiJSON<SkillRun>(`/skill-runs/${run.id}${deleting ? "" : "/cancel"}`, { method: deleting ? "DELETE" : "POST", retryOnIdentityChange: false });
      if (identity !== epoch.current) return;
      if (deleting) removedRuns.current.add(run.id);
      mutations.current++; setRuns(old => deleting ? old.filter(r => r.id !== run.id) : old.map(r => r.id === run.id ? result : r)); setPreview(null);
    } catch (e) { if (identity === epoch.current) setError(e instanceof Error ? e.message : "操作失败。"); }
    finally { if (identity === epoch.current) setBusy(false); }
  }
  async function resume(run: SkillRun) {
    if (!window.confirm("将校验并复用此运行的有效页级检查点；未检查点的当前页及后续页会重新处理。若没有有效检查点，则从第1页开始。继续？")) return;
    const identity = epoch.current; setBusy(true); setError("");
    try { const result = await apiJSON<SkillRun>(`/skill-runs/${run.id}/resume`, { method: "POST", retryOnIdentityChange: false }); if (identity !== epoch.current) return; mutations.current++; setRuns(old => old.map(r => r.id === run.id ? result : r)); setFocusId(run.id); setPreview(null); }
    catch (e) { if (identity === epoch.current) setError(e instanceof Error ? e.message : "重新处理请求失败。"); }
    finally { if (identity === epoch.current) setBusy(false); }
  }
  async function handoffArtifactToChat(run: SkillRun, id: string) {
    if (!onArtifactHandoff) return;
    const identity = epoch.current;
    const meta = run.artifacts.find(a => a.id === id);
    if (!meta) return;
    setError("");
    try {
      const res = await apiFetch(`/skill-runs/${run.id}/artifacts/${id}`);
      if (!res.ok) throw Error(`成果读取失败（HTTP ${res.status}）。`);
      const text = (await res.text()).slice(0, 48_000);
      if (identity !== epoch.current) return;
      onArtifactHandoff({ name: meta.name, content: text, skillId: run.skillId, runId: run.id });
    } catch (e) {
      if (identity === epoch.current) setError(e instanceof Error ? e.message : "无法读取成果文本。");
    }
  }
  async function artifact(run: SkillRun, id: string, show: boolean) {
    const identity = epoch.current;
    const meta = run.artifacts.find(a => a.id === id)!; setError("");
    try {
      const res = await apiFetch(`/skill-runs/${run.id}/artifacts/${id}`);
      if (!res.ok) throw Error(`成果读取失败（HTTP ${res.status}）。`);
      const blob = await res.blob(); if (identity !== epoch.current) return; const url = URL.createObjectURL(blob);
      if (show) setPreview({ url, kind: meta.mime });
      else { const link = document.createElement("a"); link.href = url; link.download = meta.name; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500); }
    } catch (e) { if (identity === epoch.current) setError(e instanceof Error ? e.message : "无法下载成果。"); }
  }
  return <section className="skill-workbench" aria-label="真实技能执行台">
    <header><div><span className="skill-workbench-eyebrow">后台技能 · 实际文件交付</span><h2>{expertId ? "已接通技能" : "技能执行与运行记录"}</h2></div><button type="button" disabled={busy} onClick={() => setRefresh(r => r + 1)}>重新连接</button></header>
    <p className="skill-workbench-intro">{taskId && "当前仅展示本任务的方案与运行；任务标识不授予其他账号访问权限。"}这里真正处理上传文件，不只是给聊天添加提示词。大多数技能使用固定程序；仅“文档语义摘要”会在单次明确授权后把正文发送给服务端配置的第三方AI模型。OCR/离线转写使用所列本地识别模型。具体文件和执行边界以技能清单为准；未接通的外部业务操作不会执行。</p>
    {error && <p className="skill-workbench-error" role="alert">{error}</p>}
    {!loaded && !error && <p role="status">正在检查后台技能与运行记录…</p>}
    <details className="skill-runtime-registry" open={!!expertId}><summary>已接入执行器 · {available.length} 项{unavailable.length ? ` · 另有 ${unavailable.length} 项未接入能力` : ""}</summary><div className="skill-runtime-catalog">{relevant.map(s => <div key={s.id} className={`skill-runtime-item ${s.status}`}><div><b>{s.name}</b><span>{s.status === "ready" ? "可执行" : s.executorState === "connected" ? "缺服务端凭据" : "未支持"}</span></div><p>{s.description}</p>{!expertId && <small>绑定专家：{s.expertIds.map(id => expertCatalog.find(e => e.id === id)?.name || id).join("、")} · v{s.version}</small>}<details><summary>格式与能力边界</summary><p>{s.limits}</p>{s.outputs.length > 0 && <p>真实交付：{s.outputs.join("、")}</p>}</details>{s.requires?.length ? <details className="skill-runtime-requires"><summary>需要你提供（{s.requires.length}）</summary><ul>{s.requires.map(item => <li key={`${item.kind}-${item.label}`}><b>{item.label}</b><span>{item.detail}</span></li>)}</ul></details> : null}</div>)}</div></details>
    {loaded && unavailable.length > 0 && <p className="skill-workbench-note">
      {(() => {
        const connected = unavailable.filter(s => s.executorState === "connected");
        const missing = unavailable.filter(s => s.executorState !== "connected");
        return <>{connected.length > 0 && <>执行器已接入、但服务端还没配置依赖，暂不提供执行入口：{connected.map(s => s.name).join("、")}。</>}{missing.length > 0 && <>以下能力尚未实现后台执行器，不计为技能，也不会提供执行入口：{missing.map(s => s.name).join("、")}。</>}</>;
      })()}
    </p>}
    {loaded && !relevant.length && <p className="skill-workbench-note">当前痛点没有已接入的真实技能，因此没有文件处理入口。聊天内容不等于技能执行；新增能力需先实现并验收后台执行器。</p>}
    {loaded && relevant.length > 0 && !available.length && <p className="skill-workbench-note">该类别相关技能目前均未支持执行。不会展示虚假的执行按钮。</p>}
    {loaded && relevant.length > 0 && <SmartSkillPlanner key={`${taskId}-${expertId}-${refresh}`} expertId={expertId} taskId={taskId} initialGoal={initialGoal} model={model} permission={permission} catalog={relevant} skillScope={allowedSkillIds} onRun={run => { if (removedRuns.current.has(run.id) || (taskId && run.taskId !== taskId)) return; mutations.current++; setRuns(old => [run, ...old.filter(r => r.id !== run.id)]); setFocusId(run.id); }} />}
    {available.length > 0 && <form className="skill-runtime-form" onSubmit={e => { e.preventDefault(); void execute(); }}>
      {autoContent && file && (
        <div className="skill-auto-content-notice">
          <strong>✓ AI 已生成内容</strong>
          <p>内容已自动填充，技能已预选。点击下方按钮即可生成文件。</p>
        </div>
      )}
      <label>执行技能<select value={selected} disabled={busy} onChange={e => { setSelected(e.target.value); setFile(null); setConsent(false); setParameters(Object.fromEntries((available.find(s => s.id === e.target.value)?.parameterFields || []).map(f => [f.name, f.defaultValue || ""]))); }}>{available.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      {selected !== "image.layout" && <label>上传实际材料<input key={`${selected}-${expertId}-${refresh}`} type="file" disabled={busy} accept={skill?.accepts.join(",")} onChange={e => { setFile(e.target.files?.[0] || null); setConsent(false); if(selected === "audio.transcribe-en") setParameters({englishConfirmed:""}); submission.current = null; }} /></label>}
      {selected === "image.layout" && <><PosterLayoutEditor key={`${taskId}-${expertId}-${refresh}`} disabled={busy} onInvalidate={() => { setFile(null); setConsent(false); submission.current = null; }} onPrepare={prepared => { setFile(prepared); setConsent(false); submission.current = null; }} /><p className="skill-workbench-note">{file ? `当前已准备 ${file.name}（${file.size}字节），尚未上传；请核对后勾选同意并执行。` : "尚未准备画布输入；编辑后点击“将当前画布准备为输入”。"}</p></>}
      <p className="skill-workbench-note">{skill?.limits}</p>
      <p className="skill-workbench-note">{selected === "document.summarize" ? "此技能会将提取后的完整正文发送至服务端配置的第三方AI模型，模型服务的数据留存/训练政策由服务商决定；文件也会保存在本应用后台。只有选择下方单次正文处理授权并另行同意后台执行后才会发送。需要人工对照原文复核摘要。" : ["pdf.ocr", "pdf.ocr-batch"].includes(selected) ? "PDF OCR任务本地处理；每完成一页就持久化页图、文字和识别证据。服务重启/限时恢复会复用已校验检查点，仅重新处理未完成页；失败/取消后可由你显式继续或重试。每次运行仍有明确时限与资源上限。" : "多数手动技能不调用模型；识别类技能使用所列本地模型。同一材料与参数重复提交会返回原任务；需要新任务或重试失败任务，请重新选择文件并确认。"}</p>
      {skill?.exampleFile && <><p className="skill-workbench-note">{skill.exampleFile.hint}</p><button type="button" onClick={() => { const a = document.createElement("a"); a.href = skill.exampleFile!.path; a.download = skill.exampleFile!.filename; a.click(); }}>{skill.exampleFile.buttonLabel || (skill.id === "table.join" ? "下载双表示例XLSX（不会执行）" : "下载公式示例XLSX（不会执行）")}</button>{skill.exampleFile.licensePath && <a href={skill.exampleFile.licensePath} download>下载示例来源与许可</a>}</>}
      {skill?.example && <button type="button" onClick={() => {
        const sample = skill.example!; const url = URL.createObjectURL(new Blob([sample.content], { type: "text/plain;charset=utf-8" }));
        const a = document.createElement("a"); a.href = url; a.download = sample.filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1500);
      }}>下载输入格式示例（不会执行）</button>}
      {skill?.parameterFields && <div className="skill-poster-fields">
        {skill.parameterFields.map(field => <label key={field.name}>{field.label}{field.choices
          ? <select disabled={busy} required={field.required} value={parameters[field.name] || field.defaultValue || ""} onChange={e => setParameters(p => ({ ...p, [field.name]: e.target.value }))}>{field.choices.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select>
          : <input disabled={busy} required={field.required} maxLength={field.maxLength} value={parameters[field.name] || ""} onChange={e => setParameters(p => ({ ...p, [field.name]: e.target.value }))} />}</label>)}
      </div>}
      {selected === "table.analyze" && <label className="skill-runtime-check"><input type="checkbox" disabled={busy} checked={deduplicate} onChange={e => setDeduplicate(e.target.checked)} />去除所有字段完全相同的重复行（默认保留，记录来源行号）</label>}
      <label className="skill-runtime-check"><input type="checkbox" disabled={busy} checked={consent} onChange={e => setConsent(e.target.checked)} />我同意上传材料至应用后台并执行。这不是“仅浏览器本地”模式；文件和成果将保存在后台，直到我删除此运行。最多保存 100 次运行。</label>
      <button className="skill-runtime-primary" type="submit" disabled={!consent || !file || !skill || busy}>{busy ? "正在提交…" : "上传并执行技能"}</button>
    </form>}
    <div className="skill-runtime-history"><h3>我的运行记录</h3><p className="skill-workbench-note">记录按当前服务端身份隔离；切换账号或清除浏览器会话会影响访问，请及时下载重要成果。</p>{loaded && !visibleRuns.length && <p>暂无运行记录。点击执行后才会创建真实任务。</p>}
      {!!visibleRuns.length && <label>选择运行<select aria-label="选择技能运行记录" value={current?.id || ""} onChange={e => setFocusId(e.target.value)}>{visibleRuns.map(r => <option key={r.id} value={r.id}>{r.filename} · {labels[r.status]} · {new Date(r.createdAt).toLocaleString()}</option>)}</select></label>}
      {current && <article className="skill-run-result"><div className="skill-run-heading"><b>{current.filename}</b><span role="status">{labels[current.status]}</span></div><p>{current.summary || current.error || "仅显示后台已发生的步骤，不模拟进度。"}</p>
        <small>技能 {current.skillId} · v{current.version} · 运行 {current.id}{current.events.length > 1 ? ` · 总耗时 ${Math.max(1, new Date(current.events[current.events.length - 1].at).getTime() - new Date(current.events[0].at).getTime())}ms` : ""}</small>
        <details><summary>执行证据与来源</summary>{current.plan && <p>已确认方案：{current.plan.id}<br/>任务：{current.plan.goal}<br/>模型建议理由：{current.plan.reason}<br/>用户确认时间：{new Date(current.plan.confirmedAt).toLocaleString()}<br/>方案摘要：<code>{current.plan.approvalDigest}</code></p>}<p>输入 SHA-256：<code>{current.inputHash}</code></p><ol>{current.events.map((e, i) => <li key={i}><time>{new Date(e.at).toLocaleTimeString()}</time> <span>(+{i === 0 ? 0 : Math.max(0, new Date(e.at).getTime() - new Date(current.events[i - 1].at).getTime())}ms)</span> {e.message}</li>)}</ol></details>
        {!!current.artifacts.length && <ul className="skill-artifact-list">{current.artifacts.map(a => <li key={a.id}><div><b>{a.name}</b><small>{Math.ceil(a.size / 1024)} KB · SHA-256 {a.sha256.slice(0, 12)}…</small></div><button onClick={() => void artifact(current, a.id, false)}>下载 {a.name}</button>{["image/svg+xml", "image/png", "image/jpeg", "text/html; charset=utf-8"].includes(a.mime) && <button onClick={() => void artifact(current, a.id, true)}>预览 {a.name.endsWith("html") ? "页面内容" : (a.mime === "image/svg+xml" ? "图表" : a.name)}</button>}{onArtifactHandoff && /\.(txt|md|json|csv|html?|svg|xml)$/i.test(a.name) && <button type="button" onClick={() => void handoffArtifactToChat(current, a.id)}>带入当前对话继续分析</button>}</li>)}</ul>}
        {preview && <div className="skill-artifact-preview"><button onClick={() => setPreview(null)}>关闭预览</button>{preview.kind.startsWith("image/") ? <img src={preview.url} alt={current.skillId === "image.layout" ? "后台实际生成的图层排版" : current.skillId === "infographic.compose" ? "实际生成的信息图" : preview.kind === "image/svg+xml" ? "程序生成的字段概览图" : "实际处理后的图片预览"} /> : <iframe title={current.skillId === "audio.transcribe-en" ? "英语音频转写核对（须人工复核）" : current.skillId === "document.structure" ? "DOCX正文结构预览（非Word渲染）" : "演示文稿内容预览（非 PowerPoint 截图）"} src={preview.url} sandbox="" />}</div>}
        <div className="skill-run-actions">{!terminal(current) && <button disabled={busy} onClick={() => void action(current, false)}>取消执行</button>}{["failed", "cancelled"].includes(current.status) && ["pdf.ocr", "pdf.ocr-batch"].includes(current.skillId) && <button disabled={busy} onClick={() => void resume(current)}>继续/重试PDF OCR</button>}<button disabled={busy} onClick={() => void action(current, true)}>删除运行与文件</button></div>
      </article>}
    </div>
  </section>;
}
