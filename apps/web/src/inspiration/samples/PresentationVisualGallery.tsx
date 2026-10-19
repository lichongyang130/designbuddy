import { useEffect, useState } from "react";
import {
  presentationVisualStyles,
  type PresentationVisualStyle,
} from "../../../../../shared/presentationDesign";
import { navigateTo } from "../../../../../frontend/workspace/workspaceRoutes";
import SkillWorkbench from "../../../../../frontend/workspace/SkillWorkbench";
import "./leader-decision-report.css";
import "./presentation-visual-gallery.css";
const base = `${import.meta.env.BASE_URL}presentation-examples/visual-directions/`;
type Content = {
  title: string;
  speakerNotes: string;
  subtitle?: string;
  body?: string;
  bullets?: string[];
  headers?: string[];
  rows?: string[][];
  columns?: { heading: string; bullets: string[] }[];
  items?: { label: string; value?: string; note?: string; body?: string }[];
  categories?: string[];
  series?: { name: string; values: number[] }[];
};
type Report = {
  style: string;
  versionId: string;
  sourceSnapshotNotice: string;
  missingInformation: string[];
  qualitySummary: { criticalIssues: number; releaseStatus: string };
  pages: {
    id: string;
    classification: string;
    suggestedSeconds: number;
    preview: string;
    sourceRefs: string[];
    chartSuggestion: string;
    content: Content;
  }[];
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
};
type Plan = {
  engineVersion: string;
  method: string;
  assets: {
    id: string;
    alt: string;
    usage: string;
    source: string;
    license: string;
    sha256: string;
  }[];
  pages: {
    slideId: string;
    composition: string;
    image: { assetId: string; fit: string; usage: string } | null;
  }[];
};
function lines(c: Content) {
  return [
    c.subtitle,
    c.body,
    ...(c.bullets || []),
    ...(c.columns || []).flatMap((x) => [x.heading, ...x.bullets]),
    ...(c.items || []).flatMap((x) => [x.label, x.value, x.body, x.note]),
    ...(c.headers
      ? [c.headers.join(" / "), ...(c.rows || []).map((r) => r.join(" / "))]
      : []),
    ...(c.categories || []).map(
      (v, i) =>
        `${v}：${(c.series || []).map((s) => `${s.name} ${s.values[i]}`).join("；")}`,
    ),
  ].filter((v): v is string => !!v);
}
export default function PresentationVisualGallery(_props: {
  draftId?: string;
}) {
  const [style, choose] = useState<PresentationVisualStyle>("consulting"),
    [index, select] = useState(0),
    [data, setData] = useState<{ report: Report; plan: Plan } | null>(null),
    [error, setError] = useState(""),
    [attempt, retry] = useState(0),
    [generator, openGenerator] = useState(false);
  const dir = `${base}${style}/`,
    direction = presentationVisualStyles.find((d) => d.id === style)!;
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError("");
    Promise.all(
      ["report.json", "visual-plan.json"].map(async (file) => {
        const r = await fetch(`${base}${style}/${file}`, {
          signal: controller.signal,
        });
        if (!r.ok) throw Error("视觉案例载入失败，请重试。");
        return r.json();
      }),
    )
      .then((values) => {
        const [report, plan] = values as [Report, Plan];
        if (
          report.style !== style ||
          !Array.isArray(report.pages) ||
          report.pages.length !== 12 ||
          !Array.isArray(report.sourceCatalog) ||
          !Array.isArray(report.missingInformation) ||
          !report.qualitySummary ||
          !Array.isArray(plan.assets) ||
          plan.assets.some(
            (a) => !/^asset-[a-z0-9][a-z0-9-]{0,30}$/.test(a.id),
          ) ||
          !Array.isArray(plan.pages) ||
          plan.pages.length !== 12 ||
          report.pages.some(
            (p) =>
              !p.content ||
              typeof p.content.title !== "string" ||
              typeof p.content.speakerNotes !== "string" ||
              !/^slides\/\d{2}\.jpg$/.test(p.preview) ||
              !Array.isArray(p.sourceRefs) ||
              p.sourceRefs.some(
                (r) =>
                  !report.sourceCatalog.some((s) => s.id === r) &&
                  !plan.assets.some((a) => a.id === r),
              ),
          )
        )
          throw Error("案例元数据不完整或路径不安全。");
        if (!controller.signal.aborted) setData({ report, plan });
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "案例载入失败");
      });
    return () => controller.abort();
  }, [style, attempt]);
  const page = data?.report.pages[index],
    pagePlan = data?.plan.pages[index];
  return (
    <main className="leader-report visual-gallery">
      <header className="leader-report-header">
        <button type="button" onClick={() => navigateTo("/inspiration")}>
          ← 返回模板库
        </button>
        <div>
          <p>M2 / VISUAL DIRECTIONS</p>
          <h1>同一份材料，三种视觉叙事</h1>
        </div>
        <nav aria-label="下载当前视觉风格">
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
            onClick={() => openGenerator((v) => !v)}
          >
            {generator ? "收起生成工作台" : "用此风格生成自己的汇报"}
          </button>
        </nav>
      </header>
      <section className="visual-direction-cards" aria-label="选择艺术方向">
        {presentationVisualStyles.map((d) => (
          <button
            type="button"
            key={d.id}
            aria-pressed={style === d.id}
            onClick={() => choose(d.id)}
          >
            <img
              src={`${base}${d.id}/cover.jpg`}
              alt={`${d.label}实际PPTX封面`}
            />
            <strong>{d.label}</strong>
            <span>{d.composition}</span>
          </button>
        ))}
      </section>
      <section className="leader-report-intro">
        <span className="leader-report-kicker">
          不是换色演示 · 同正文 / 同数据 / 同讲稿 / 同页序
        </span>
        <h2>先定视觉意图，再决定图片与版式。</h2>
        <p>
          12页 /
          15分钟领导决策汇报。三套实际PPTX均由本机真实渲染为PDF和全页图。封面与图文页构图不同；文字、图表、表格、图注和讲稿仍原生可编辑，图片为可替换栅格。
        </p>
        <p>
          概念雕塑由本次会话的Arena图像工具实际生成，不是应用自动生图；截图取自已冻结V2第04页并完整显示；DB
          / CONCEPT是脚本绘制的示例标识，不冒充第三方Logo。
        </p>
        <p>
          视觉规划目前是依据内容类型与素材元数据的规则策划，不发送图片像素、不自动OCR、不声称看懂图片。历史源码与测试材料没有重做审计；真实后台模型规划和目标Office编辑仍待单独验收。字体未嵌入。
        </p>
        <button
          type="button"
          onClick={() => navigateTo("/inspiration/leader-decision")}
        >
          查看保留的 V1 / V2 对照
        </button>
      </section>

      {generator && (
        <section
          className="leader-report-pending"
          aria-label="视觉风格生成工作台"
        >
          <h2>用自己的材料与已授权图片生成</h2>
          <p>
            这是独立任务，不会上传示例材料。打开时采用当前所选风格；后续请在工作台内调整。素材来源和许可必须声明，再分别确认上传与本次正文/素材元数据处理授权。模型未配置时不会假生成。
          </p>
          <SkillWorkbench
            expertId="slides"
            allowedSkillIds={["slides.create"]}
            initialSkillId="slides.create"
            presentationBrief={{
              audience: "项目决策领导",
              scenario: "business-report",
              theme: "consulting",
              slideCount: 12,
              layoutStyle: "adaptive",
              visualStyle: style,
            }}
            initialGoal="生成15分钟领导决策汇报；结论先行，事实、分析、建议分开。仅使用本次材料和已授权图片，不从未OCR图片推断数字，不编造预算、人员或批准日期。"
          />
        </section>
      )}
      {error ? (
        <section role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => retry((v) => v + 1)}>
            重新载入视觉案例
          </button>
        </section>
      ) : !data || !page ? (
        <p role="status">正在载入实际导出与视觉策划…</p>
      ) : (
        <>
          <div className="leader-report-status">
            <span>
              {direction.label} · 第 {index + 1} / 12 页
            </span>
            <span>
              技术检查：{data.report.qualitySummary.criticalIssues}项关键问题
            </span>
            <strong>待人工复核 · 非商业认证</strong>
          </div>
          <div className="leader-report-layout">
            <aside className="leader-report-pages" aria-label="选择视觉汇报页">
              {data.report.pages.map((p, i) => (
                <button
                  type="button"
                  key={p.id}
                  aria-current={index === i ? "page" : undefined}
                  aria-label={`第${i + 1}页：${p.content.title}`}
                  onClick={() => select(i)}
                >
                  <img loading="lazy" src={`${dir}${p.preview}`} alt="" />
                  <span>
                    <b>{String(i + 1).padStart(2, "0")}</b> {p.content.title}
                  </span>
                </button>
              ))}
            </aside>
            <section
              className="leader-report-stage"
              aria-label="当前视觉汇报页"
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
                  第 {index + 1} / 12 页 · {page.classification} · 建议{" "}
                  {page.suggestedSeconds} 秒
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
                alt={`${direction.label}第${index + 1}页，来自实际PPTX渲染`}
              />
              <h2>{page.content.title}</h2>
              <details className="leader-report-transcript">
                <summary>本页正文（无障碍文字版）</summary>
                <ul>
                  {lines(page.content).map((v, i) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
              </details>
              <section className="leader-report-notes" aria-label="本页讲稿">
                <h3>讲稿与视觉意图</h3>
                <p>{page.content.speakerNotes}</p>
                <p className="leader-report-visual">
                  构图：{pagePlan?.composition}。
                  {pagePlan?.image
                    ? `本页图片：${pagePlan.image.usage === "evidence" ? "证据素材 · 完整显示 · 未自动OCR" : "装饰素材 · 不支持事实主张"}`
                    : "本页保持原生内容，不强行塞图。"}
                </p>
              </section>
              <section
                className="leader-report-sources"
                aria-label="本页事实来源"
              >
                <h3>证据与来源位置</h3>
                {page.sourceRefs.map((id) => {
                  const source = data.report.sourceCatalog.find(
                    (s) => s.id === id,
                  );
                  const asset = data.plan.assets.find((a) => a.id === id);
                  return (
                    <details key={id}>
                      <summary>
                        {id} · {source?.label || asset?.alt}
                      </summary>
                      {source ? (
                        <>
                          <p>{source.summary}</p>
                          {source.locations.map((l, i) => (
                            <div key={i}>
                              <code>
                                {l.path}:L{l.startLine}–L{l.endLine}
                              </code>
                              <pre>{l.excerpt}</pre>
                            </div>
                          ))}
                        </>
                      ) : (
                        <p>
                          {asset?.source}
                          ；完整截图只作历史文件示范，不是当前代码审计。
                        </p>
                      )}
                    </details>
                  );
                })}
              </section>
            </section>
          </div>
          <section
            className="leader-report-pending"
            aria-label="素材可追溯记录"
          >
            <h2>素材与交付边界</h2>
            <p>{data.report.sourceSnapshotNotice}</p>
            {data.plan.assets.map((a) => (
              <details key={a.id}>
                <summary>
                  {a.alt} · {a.usage === "evidence" ? "证据（待核对）" : "装饰"}
                </summary>
                <p>来源：{a.source}</p>
                <p>许可声明：{a.license}；不是独立版权核验。</p>
                <p className="leader-report-hash">规范化SHA-256：{a.sha256}</p>
                <a href={`${dir}assets/${a.id}.png`} download>
                  下载完整规范化素材
                </a>
              </details>
            ))}
            <ul>
              {data.report.missingInformation.map((v) => (
                <li key={v}>{v}</li>
              ))}
            </ul>
            <div>
              <a href={`${dir}visual-plan.json`} download>
                逐页视觉策划
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
