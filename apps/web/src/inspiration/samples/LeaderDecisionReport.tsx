import { useEffect, useRef, useState } from "react";
import { navigateTo } from "../../../../../frontend/workspace/workspaceRoutes";
import "./leader-decision-report.css";
import SkillWorkbench from "../../../../../frontend/workspace/SkillWorkbench";

export const leaderDecisionBase = `${import.meta.env.BASE_URL}presentation-examples/leader-decision/`;
type Content = {
  title: string; subtitle?: string; speakerNotes: string; body?: string; bullets?: string[];
  columns?: { heading: string; bullets: string[] }[];
  items?: { label: string; value?: string; note?: string; body?: string }[];
  categories?: string[]; series?: { name: string; values: number[] }[];
  headers?: string[]; rows?: string[][];
};
type Source = {
  id: string; label: string; classification: string; summary: string;
  locations: { path: string; startLine: number; endLine: number; fileSHA256: string; excerpt: string }[];
};
type Report = {
  sourceSnapshotNotice?: string; layoutVersion?: string; preparedOn: string; durationMinutes: number; versionId: string; recommendation: string; missingInformation: string[];
  qualitySummary: { releaseStatus: string; commercialApproval: boolean; criticalIssues: number };
  sourceCatalog: Source[];
  pages: { id: string; classification: string; suggestedSeconds: number; preview: string; chartSuggestion: string; sourceRefs: string[]; content: Content }[];
};
function readable(p: Content) {
  return [p.subtitle, p.body, ...(p.bullets || []), ...(p.columns || []).flatMap(c => [c.heading, ...c.bullets]), ...(p.items || []).flatMap(i => [i.label, i.value, i.note, i.body]), ...(p.headers ? [p.headers.join(" / "), ...(p.rows || []).map(r => r.join(" / "))] : []), ...(p.categories || []).map((c,i) => `${c}：${(p.series || []).map(s => `${s.name} ${s.values[i]}`).join("；")}`)].filter((s): s is string => !!s);
}
export default function LeaderDecisionReport(_props: { draftId?: string }) {
  const [version, changeVersion] = useState<"adaptive" | "classic">("adaptive");
  const artifactBase = `${leaderDecisionBase}${version === "adaptive" ? "adaptive/" : ""}`;
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [attempt, retry] = useState(0);
  const [index, select] = useState(0);
  const [generatorOpen, openGenerator] = useState(false);
  const generatorRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    setError(""); setReport(null);
    fetch(`${leaderDecisionBase}${version === "adaptive" ? "report-v2.json" : "report.json"}`, { signal: controller.signal }).then(async r => {
      if (!r.ok) throw Error("案例资源读取失败，请重试。");
      const value = await r.json() as Report;
      if (!Array.isArray(value.pages) || value.pages.length !== 12 || !Array.isArray(value.sourceCatalog) || !Array.isArray(value.missingInformation) || !value.qualitySummary || value.pages.some(p => !p.content || typeof p.content.title !== "string" || typeof p.content.speakerNotes !== "string" || !/^(?:adaptive\/)?slides\/\d{2}\.jpg$/.test(p.preview) || !Array.isArray(p.sourceRefs) || p.sourceRefs.some(id => !value.sourceCatalog.some(s => s.id === id)))) throw Error("案例资源不完整，请重试。");
      if (!controller.signal.aborted) setReport(value);
    }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "案例读取失败"); });
    return () => controller.abort();
  }, [attempt, version]);
  const page = report?.pages[index];
  return <main className="leader-report">
    <header className="leader-report-header">
      <button type="button" onClick={() => navigateTo("/inspiration")}>← 返回模板库</button>
      <div><p>汇报PPT / 汇报没有清晰主线</p><h1>领导决策汇报 · PPT引擎试点建议</h1></div>
      <nav aria-label="下载真实案例文件">
        <a href={`${artifactBase}leader-decision.pptx`} download>下载可编辑PPTX</a>
        <a href={`${artifactBase}leader-decision.pdf`} download>下载PDF</a>
        <a href={`${artifactBase}leader-decision-package.zip`} download>下载完整证据包</a>
        <button type="button" aria-expanded={generatorOpen} onClick={() => { openGenerator(!generatorOpen); if (!generatorOpen) requestAnimationFrame(() => generatorRef.current?.scrollIntoView({ block: "start", behavior: "instant" })); }}>{generatorOpen ? "收起生成工作台" : "用自己的材料生成"}</button>
      </nav>
    </header>
    <section className="leader-report-intro" aria-label="案例边界">
      <div className="leader-report-versions" role="group" aria-label="新旧排版对照"><button type="button" aria-pressed={version === "adaptive"} onClick={() => changeVersion("adaptive")}>自适应商务 V2</button><button type="button" aria-pressed={version === "classic"} onClick={() => changeVersion("classic")}>经典 V1 对照</button><span>同内容、同数据、同页序，只比较排版</span></div>
      <span className="leader-report-kicker">源码实证案例 · 内置示例 · 不发布外部社区</span>
      <h2>建议有条件批准，而不是宣布商业就绪。</h2>
      <p>12页 / 15分钟建议讲述。由助手基于实际源码与历史测试编排，经项目原生编译器和本机LibreOffice真实导出；未调用后台外部模型。</p>
      <p>这里查看的是同一份PPTX的全页渲染，不是网页模拟稿。浏览器仅供查看；下载PPTX可编辑原生文字、图表、表格与讲稿。字体未嵌入，接收端需安装Noto Sans SC。</p>
      <p>V2新增内容密度适配、图表与结论分栏、推荐行强调和原生表格重排；沿用原案例的历史证据，不将重排冒充当前源码重新审计。真实模型自动规划仍待单独验收。</p>
    </section>
    {generatorOpen && <section ref={generatorRef} className="leader-report-pending" aria-label="基于此模板重新生成"><h2>新建一份领导决策汇报</h2><p>这是独立的新运行，不会修改本例或自动上传示例材料。请补充你自己的决策目标、受众和来源材料，再分别确认上传与正文处理授权。后台模型必须由服务端配置；未配置时不会用模板冒充AI结果。</p><SkillWorkbench expertId="slides" allowedSkillIds={["slides.create"]} initialSkillId="slides.create" presentationBrief={{ audience: "项目决策领导", scenario: "business-report", theme: "consulting", slideCount: 12, layoutStyle: "adaptive" }} initialGoal="为项目决策领导生成15分钟领导决策汇报；结论先行，对比方案，说明成本和风险。仅用我选择的材料，不虚构预算、人员、日期或已批准决定；事实、分析、建议分开，提供来源和讲稿。" /></section>}
    {error ? <section role="alert"><p>{error}</p><button type="button" onClick={() => retry(n => n+1)}>重新载入案例</button></section> : !report || !page ? <p role="status">正在载入真实案例…</p> : <>
      <div className="leader-report-status"><span>技术检查：{report.qualitySummary.criticalIssues === 0 ? "未发现关键项" : `${report.qualitySummary.criticalIssues}项关键问题`}</span><strong>待人工复核 · 非商业验收通过</strong><span>历史材料快照 {report.preparedOn}</span></div>
      <div className="leader-report-layout">
        <aside className="leader-report-pages" aria-label="选择汇报页面">
          {report.pages.map((p,i) => <button type="button" key={p.id} aria-current={i === index ? "page" : undefined} aria-label={`第${i+1}页：${p.content.title}`} onClick={() => select(i)}>
            <img src={`${leaderDecisionBase}${p.preview}`} alt="" loading="lazy" />
            <span><b>{String(i+1).padStart(2,"0")}</b> {p.content.title}</span>
          </button>)}
        </aside>
        <section className="leader-report-stage" aria-label="当前汇报页">
          <div className="leader-report-pagination"><button type="button" disabled={index === 0} onClick={() => select(n => n-1)}>上一页</button><p aria-live="polite">第 {index+1} / {report.pages.length} 页 · {page.classification} · 建议 {page.suggestedSeconds} 秒</p><button type="button" disabled={index === report.pages.length-1} onClick={() => select(n => n+1)}>下一页</button></div>
          <img className="leader-report-slide" src={`${leaderDecisionBase}${page.preview}`} alt={`第${index+1}页：${page.content.title}，来自实际PPTX渲染`} />
          <h2>{page.content.title}</h2>
          <details className="leader-report-transcript"><summary>本页正文（无障碍文字版）</summary><ul>{readable(page.content).map((s,i) => <li key={i}>{s}</li>)}</ul></details>
          <section className="leader-report-notes" aria-label="本页讲稿"><h3>讲稿与图示</h3><p>{page.content.speakerNotes}</p><p className="leader-report-visual">图示依据：{page.chartSuggestion}</p></section>
          <section className="leader-report-sources" aria-label="本页来源"><h3>证据、口径与来源位置</h3>
            {page.sourceRefs.map(id => {
              const s = report.sourceCatalog.find(s => s.id === id)!;
              return <details key={id}><summary>{s.id} · {s.label} <small>【{s.classification}】</small></summary><p>{s.summary}</p>{s.locations.map((l,i) => <div key={i}><code>{l.path}:L{l.startLine}–L{l.endLine}</code><p className="leader-report-hash">文件SHA-256：{l.fileSHA256}</p><pre>{l.excerpt}</pre></div>)}</details>;
            })}
          </section>
        </section>
      </div>
      <section className="leader-report-pending"><h2>请你审阅和确认</h2><ul>{report.missingInformation.map(s => <li key={s}>{s}</li>)}</ul><p>240 / 25 / 19 / 4引用上一轮保存的不同范围测试，不冒称本次新测或全仓通过；三种方案、成本口径和风险处置为明确标注的定性分析/建议。</p><p>质量报告保留未检查项；目标Office编辑、图表内部标签和来源语义仍需人工验收。</p><div><a href={`${artifactBase}quality-report.json`} download>质量报告</a><a href={`${artifactBase}README.md`} download>逐页正文与讲稿</a><a href={`${leaderDecisionBase}authoring-plan.json`} download>复用逐页规划</a><a href={`${artifactBase}manifest.json`} download>文件哈希清单</a></div></section>
    </>}
  </main>;
}
