import { useEffect, useState } from "react";
import {
  directionRoles,
  directionPaces,
  directionExpressions,
  type DirectionPage,
} from "../../../../../shared/presentationDirection";
import { navigateTo } from "../../../../../frontend/workspace/workspaceRoutes";
import SkillWorkbench from "../../../../../frontend/workspace/SkillWorkbench";
import "./leader-decision-report.css";
import "./content-director-report.css";
const base = `${import.meta.env.BASE_URL}presentation-examples/`;
const directories = {
  directed: `${base}content-director/`,
  baseline: `${base}visual-directions/consulting/`,
} as const;
type Content = {
  title: string;
  speakerNotes: string;
  body?: string;
  subtitle?: string;
  bullets?: string[];
  headers?: string[];
  rows?: string[][];
  items?: { label: string; value?: string; body?: string; note?: string }[];
  columns?: { heading: string; bullets: string[] }[];
  categories?: string[];
  series?: { name: string; values: number[] }[];
};
type Report = {
  versionId: string;
  sourceSnapshotNotice: string;
  sourceBlocks?: { id: string; locator: string; text: string }[];
  sourceCatalog: {
    id: string;
    label: string;
    summary: string;
    locations: {
      path: string;
      startLine: number;
      endLine: number;
      excerpt: string;
    }[];
  }[];
  qualitySummary: { criticalIssues: number; releaseStatus: string };
  missingInformation: string[];
  pages: {
    id: string;
    classification: string;
    preview: string;
    sourceRefs: string[];
    historyEvidenceRefs?: string[];
    content: Content;
  }[];
};
type Plan = {
  decision?: string;
  argument?: string;
  origin?: string;
  pages: (Partial<DirectionPage> & {
    slideId: string;
    resolvedLayout?: string;
  })[];
  assets?: { id: string; alt: string; source: string }[];
  flags?: { code: string; message: string }[];
};
function readable(c: Content) {
  return [
    c.subtitle,
    c.body,
    ...(c.bullets || []),
    ...(c.columns || []).flatMap((x) => [x.heading, ...x.bullets]),
    ...(c.items || []).flatMap((x) => [x.label, x.value, x.body, x.note]),
    ...(c.headers
      ? [c.headers.join(" / "), ...(c.rows || []).map((x) => x.join(" / "))]
      : []),
    ...(c.categories || []).map(
      (v, i) =>
        `${v}：${(c.series || []).map((s) => `${s.name} ${s.values[i]}`).join("；")}`,
    ),
  ].filter((v): v is string => !!v);
}
export default function ContentDirectorReport(_props: { draftId?: string }) {
  const [mode, choose] = useState<keyof typeof directories>("directed"),
    [index, select] = useState(0),
    [data, setData] = useState<{ report: Report; plan: Plan } | null>(null),
    [error, setError] = useState(""),
    [attempt, retry] = useState(0),
    [generator, showGenerator] = useState(false);
  const dir = directories[mode];
  useEffect(() => {
    const c = new AbortController();
    setData(null);
    setError("");
    Promise.all(
      [
        "report.json",
        mode === "directed" ? "direction-plan.json" : "visual-plan.json",
      ].map(async (n) => {
        const r = await fetch(`${dir}${n}`, { signal: c.signal });
        if (!r.ok) throw Error("内容导演案例读取失败，请重试。");
        return r.json();
      }),
    )
      .then((values) => {
        const [r, p] = values as [Report, Plan];
        if (
          !r ||
          !Array.isArray(r.pages) ||
          r.pages.length !== 12 ||
          !Array.isArray(r.sourceCatalog) ||
          !r.qualitySummary ||
          !Array.isArray(r.missingInformation) ||
          !Array.isArray(p.pages) ||
          p.pages.length !== 12 ||
          r.pages.some(
            (s, i) =>
              !s.content ||
              typeof s.content.title !== "string" ||
              typeof s.content.speakerNotes !== "string" ||
              s.preview !== `slides/${String(i + 1).padStart(2, "0")}.jpg` ||
              !Array.isArray(s.sourceRefs) ||
              s.sourceRefs.some(
                (id) =>
                  !r.sourceBlocks?.some((b) => b.id === id) &&
                  !r.sourceCatalog.some((b) => b.id === id) &&
                  !p.assets?.some((a) => a.id === id),
              ),
          ) ||
          (mode === "directed" &&
            (!p.decision ||
              !p.argument ||
              p.pages.some(
                (t, i) =>
                  t.message !== r.pages[i].content.title ||
                  !t.evidenceRefs?.every((id) =>
                    r.sourceBlocks?.some((b) => b.id === id),
                  ) ||
                  !Object.hasOwn(directionRoles, t.role || "") ||
                  !Object.hasOwn(directionPaces, t.pace || "") ||
                  !Object.hasOwn(directionExpressions, t.expression || ""),
              )))
        )
          throw Error("案例任务、证据或预览路径不完整/不安全。");
        if (!c.signal.aborted) setData({ report: r, plan: p });
      })
      .catch((e) => {
        if (!c.signal.aborted)
          setError(e instanceof Error ? e.message : "读取失败");
      });
    return () => c.abort();
  }, [mode, attempt, dir]);
  const page = data?.report.pages[index],
    task = data?.plan.pages[index];
  return (
    <main className="leader-report director-report">
      <header className="leader-report-header">
        <button type="button" onClick={() => navigateTo("/inspiration")}>
          ← 返回模板库
        </button>
        <div>
          <p>CONTENT DIRECTOR / NATIVE EXPLANATIONS</p>
          <h1>内容导演 · 让表达由证据决定</h1>
        </div>
        <nav aria-label="下载当前内容表达版本">
          <a href={`${dir}presentation.pptx`} download>
            下载可编辑PPTX
          </a>
          <a href={`${dir}presentation.pdf`} download>
            下载PDF
          </a>
          <a href={`${dir}presentation-package.zip`} download>
            下载完整证据包
          </a>
          <button
            type="button"
            aria-expanded={generator}
            onClick={() => showGenerator((v) => !v)}
          >
            {generator ? "收起导演工作台" : "用内容导演生成自己的汇报"}
          </button>
        </nav>
      </header>
      <section className="leader-report-intro">
        <span className="leader-report-kicker">
          12页 / 15分钟 · 同正文、同数据、同原有讲稿
        </span>
        <h2>一页一个任务，不把并列事实画成因果。</h2>
        <p>
          重点与支撑、并列分支、建议流程、待核对条件——由内容关系选择原生图示，不为好看编造事实，也不把整页拍平成图片。
        </p>
        <div
          className="leader-report-versions"
          role="group"
          aria-label="内容表达对照"
        >
          <button
            type="button"
            aria-pressed={mode === "directed"}
            onClick={() => choose("directed")}
          >
            内容导演 · 原生解释
          </button>
          <button
            type="button"
            aria-pressed={mode === "baseline"}
            onClick={() => choose("baseline")}
          >
            原M2 · 图文对照
          </button>
          <span>切换保留当前页</span>
        </div>
        <p className="director-boundary">
          本例的导演任务由助手编排，并非真实模型自主质量验收；原稿为历史材料快照。生产功能是先调用导演、再写稿，可能增加模型用量。原文关系语义和目标Office编辑仍待人工验收，字体未嵌入。
        </p>
      </section>
      {generator && (
        <section
          className="leader-report-pending"
          aria-label="内容导演生成工作台"
        >
          <h2>新建独立导演任务</h2>
          <p>
            不会上传示例材料。请提供自己的需求与来源，分别确认上传、正文/素材元数据处理授权。导演、写稿各最多一次校验重试，合计最多4次；没有服务端模型配置时不会假生成。
          </p>
          <SkillWorkbench
            expertId="slides"
            allowedSkillIds={["slides.create"]}
            initialSkillId="slides.create"
            presentationBrief={{
              audience: "项目决策领导",
              scenario: "business-report",
              slideCount: 12,
              theme: "consulting",
              layoutStyle: "adaptive",
              visualStyle: "consulting",
              narrativeMode: "directed",
            }}
            initialGoal="制作15分钟领导决策汇报：先明确受众决策、逐页任务、证据、表达理由和事实边界，再写正文与讲稿。优先使用原生解释图示；不从列表臆造顺序或因果，不虚构预算、人员或已批准决定。"
          />
        </section>
      )}
      {error ? (
        <section role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => retry((i) => i + 1)}>
            重新载入导演案例
          </button>
        </section>
      ) : !data || !page ? (
        <p role="status">正在载入逐页任务与实际导出…</p>
      ) : (
        <>
          {mode === "directed" && (
            <section className="director-argument" aria-label="整套论证与节奏">
              <h3>这套稿要推动什么决策？</h3>
              <p>{data.plan.decision}</p>
              <p>{data.plan.argument}</p>
              <ol className="director-rhythm">
                {data.plan.pages.map((p, i) => (
                  <li key={p.slideId} data-pace={p.pace}>
                    <b>{String(i + 1).padStart(2, "0")}</b>
                    <span>{directionRoles[p.role!]}</span>
                    <small>{directionPaces[p.pace!]}</small>
                  </li>
                ))}
              </ol>
              <p>
                节奏按论证任务安排，不机械交替；连续核对页会提示复核，不自动删数据。
              </p>
            </section>
          )}
          <div className="leader-report-status">
            <span>
              技术检查：{data.report.qualitySummary.criticalIssues}项关键问题
            </span>
            <strong>待人工复核 · 非商业认证</strong>
          </div>
          <div className="leader-report-layout">
            <aside
              className="leader-report-pages"
              aria-label="选择内容导演页面"
            >
              {data.report.pages.map((s, i) => (
                <button
                  type="button"
                  key={s.id}
                  aria-current={index === i ? "page" : undefined}
                  aria-label={`第${i + 1}页：${s.content.title}`}
                  onClick={() => select(i)}
                >
                  <img src={`${dir}${s.preview}`} alt="" loading="lazy" />
                  <span>
                    <b>{String(i + 1).padStart(2, "0")}</b> {s.content.title}
                  </span>
                </button>
              ))}
            </aside>
            <section
              className="leader-report-stage"
              aria-label="当前内容导演页"
            >
              <div className="leader-report-pagination">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => select((i) => i - 1)}
                >
                  上一页
                </button>
                <p aria-live="polite">
                  第 {index + 1} / 12 页 · {page.classification}
                </p>
                <button
                  type="button"
                  disabled={index === 11}
                  onClick={() => select((i) => i + 1)}
                >
                  下一页
                </button>
              </div>
              <img
                className="leader-report-slide"
                src={`${dir}${page.preview}`}
                alt={`第${index + 1}页：${page.content.title}，来自实际PPTX渲染`}
              />
              {mode === "directed" && task && (
                <section className="director-task" aria-label="本页视觉任务单">
                  <h3>
                    {directionRoles[task.role!]} / {directionPaces[task.pace!]}
                  </h3>
                  <h2>{task.message}</h2>
                  <dl>
                    <dt>表达方式</dt>
                    <dd>
                      {directionExpressions[task.expression!]} ·{" "}
                      {task.resolvedLayout}
                    </dd>
                    <dt>为什么这样表达</dt>
                    <dd>{task.reason}</dd>
                    <dt>事实边界</dt>
                    <dd>{task.boundary}</dd>
                    <dt>核心证据</dt>
                    <dd>{task.evidenceRefs?.join("；")}</dd>
                    {task.sequence && (
                      <>
                        <dt>顺序依据</dt>
                        <dd>
                          {task.sequence.basis === "proposal"
                            ? "建议顺序，不表示完成、批准或因果"
                            : `原文引用待核验：${task.sequence.quote}`}
                        </dd>
                      </>
                    )}
                  </dl>
                </section>
              )}
              <details className="leader-report-transcript">
                <summary>本页正文（无障碍文字版）</summary>
                <ul>
                  {readable(page.content).map((v, i) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
              </details>
              <section className="leader-report-notes" aria-label="本页讲稿">
                <h3>保留的原有讲稿</h3>
                <p>{page.content.speakerNotes}</p>
              </section>
              <section
                className="leader-report-sources"
                aria-label="本页来源与证据"
              >
                <h3>实际来源位置 · 语义仍需核验</h3>
                {page.sourceRefs.map((id) => {
                  const b = data.report.sourceBlocks?.find((x) => x.id === id),
                    e = data.report.sourceCatalog.find((x) => x.id === id),
                    a = data.plan.assets?.find((x) => x.id === id);
                  return (
                    <details key={id}>
                      <summary>
                        {id} · {b?.locator || e?.label || a?.alt}
                      </summary>
                      {b ? (
                        <pre>{b.text}</pre>
                      ) : e ? (
                        <>
                          <p>{e.summary}</p>
                          {e.locations.map((l, i) => (
                            <div key={i}>
                              <code>
                                {l.path}:L{l.startLine}–L{l.endLine}
                              </code>
                              <pre>{l.excerpt}</pre>
                            </div>
                          ))}
                        </>
                      ) : (
                        <p>{a?.source}</p>
                      )}
                    </details>
                  );
                })}
                {page.historyEvidenceRefs?.map((id) => {
                  const e = data.report.sourceCatalog.find((x) => x.id === id);
                  return e ? (
                    <details key={`history-${id}`}>
                      <summary>
                        历史证据映射 {id} · {e.label}
                      </summary>
                      {e.locations.map((l, i) => (
                        <div key={i}>
                          <code>
                            {l.path}:L{l.startLine}–L{l.endLine}
                          </code>
                          <pre>{l.excerpt}</pre>
                        </div>
                      ))}
                    </details>
                  ) : null;
                })}
              </section>
            </section>
          </div>
          <section className="leader-report-pending">
            <h2>审阅后再决定正式使用</h2>
            <p>{data.report.sourceSnapshotNotice}</p>
            <ul>
              {data.report.missingInformation.map((v) => (
                <li key={v}>{v}</li>
              ))}
            </ul>
            <div>
              <a
                href={`${dir}${mode === "directed" ? "direction-plan.json" : "visual-plan.json"}`}
                download
              >
                逐页策划记录
              </a>
              <a href={`${dir}quality-report.json`} download>
                质量报告
              </a>
              <a href={`${dir}sources-and-notes.json`} download>
                来源与讲稿
              </a>
              <a href={`${dir}manifest.json`} download>
                文件哈希清单
              </a>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
