import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  copySample,
  Credits,
  download,
  Notice,
  reportPhotos as researchPhotos,
  handbookPhotos,
  SampleTop,
  useSampleState,
} from "./shared";
import {
  reportPhotoPages,
  reportSections as researchSections,
} from "./reportContent";
import { HandbookPaper, handbookSections } from "./HandbookPaper";
export function ReportPaper({
  index = 0,
  title,
  paragraphs,
}: {
  index?: number;
  title?: string;
  paragraphs?: string[];
}) {
  const reportSections = researchSections,
    reportPhotos = researchPhotos;
  const data = reportSections[index];
  const photo = reportPhotoPages[index];
  return (
    <article
      className={`report-paper paper-${index}`}
      data-report-page={index + 1}
      aria-label={`报告第${index + 1}页`}
    >
      <header>
        <span>FIELD / 开放影像研究</span>
        <span>方法与排版演示 · 2026</span>
      </header>
      <div className="paper-content">
        <p className="paper-eyebrow">{data.eyebrow}</p>
        <h2>{title ?? data.title}</h2>
        {index === 0 ? (
          <>
            <div className="report-cover-rule" />
            <p className="report-cover-sub">从图像来源，到可追溯的观察方法</p>
            <div className="report-cover-grid">
              {reportPhotos.slice(0, 3).map((p) => (
                <img key={p.url} src={p.url} alt={p.label} />
              ))}
            </div>
            <p className="report-cover-meta">
              DESIGNBUDDY RESEARCH SERIES / VOL. 01
              <br />
              方法示范 · 无真实实验结果 · 非医学建议
            </p>
          </>
        ) : null}
        {(paragraphs ?? data.paragraphs).map((text, i) => (
          <p className="paper-paragraph" key={i}>
            {text}
          </p>
        ))}
        {index === 2 && (
          <ol className="paper-contents">
            {reportSections
              .filter((_, i) =>
                [
                  3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
                ].includes(i),
              )
              .map((p) => (
                <li key={p.index}>
                  <span>{p.title}</span>
                  <b>{String(p.index + 1).padStart(2, "0")}</b>
                </li>
              ))}
          </ol>
        )}
        {photo !== undefined && (
          <figure className="paper-figure">
            <img
              src={reportPhotos[photo].url}
              alt={reportPhotos[photo].label}
            />
            <figcaption>
              图 {photo + 1} · {reportPhotos[photo].label}。
              {reportPhotos[photo].credit} / {reportPhotos[photo].license}
              。仅作方法与排版参考。
            </figcaption>
          </figure>
        )}
        {[5, 14].includes(index) && (
          <table className="paper-table">
            <thead>
              <tr>
                <th>编号</th>
                <th>素材</th>
                <th>{index === 5 ? "来源许可" : "主要观察维度"}</th>
              </tr>
            </thead>
            <tbody>
              {reportPhotos.map((p, i) => (
                <tr key={p.url}>
                  <td>F0{i + 1}</td>
                  <td>{p.label}</td>
                  <td>
                    {index === 5
                      ? p.license
                      : [
                          "周期与接缝",
                          "方向与遮挡",
                          "颗粒与边界",
                          "相位与背景",
                          "分支与视场",
                        ][i]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {index === 13 && (
          <figure className="paper-chart">
            <strong>图表A / 描述维度完整度 · 示例数据，非测量结果</strong>
            {["来源登记", "尺度说明", "处理记录", "复核记录"].map((x, i) => (
              <div key={x}>
                <span>{x}</span>
                <i style={{ width: `${[82, 64, 72, 48][i]}%` }} />
                <b>{[82, 64, 72, 48][i]}%</b>
              </div>
            ))}
          </figure>
        )}
        {index === 12 && (
          <ol className="paper-method">
            {[
              "来源核验",
              "文件登记",
              "尺度描述",
              "结构观察",
              "不确定性记录",
            ].map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ol>
        )}
        {index === 18 && (
          <ol className="paper-references">
            {reportPhotos.map((p) => (
              <li key={p.url}>
                <b>{p.label}</b> — {p.credit}. {p.license}.<br />
                <a href={p.source} target="_blank" rel="noopener noreferrer">
                  查看原始资料
                </a>
              </li>
            ))}
          </ol>
        )}
        {index === 19 && (
          <div className="paper-signoff">
            <span>复核人：________________</span>
            <span>日期：________________</span>
          </div>
        )}
      </div>
      <footer>
        <span>OPEN IMAGERY / METHOD TEMPLATE</span>
        <b>{String(index + 1).padStart(2, "0")}</b>
      </footer>
    </article>
  );
}
type ReportState = {
  page: number;
  titles: Record<string, string>;
  bodies: Record<string, string[]>;
  comments: { id: string; page: number; text: string }[];
  continuous: boolean;
};
const initial: ReportState = {
  page: 0,
  titles: {},
  bodies: {},
  comments: [],
  continuous: false,
};
export default function ResearchReport({
  draftId,
  variant = "research",
}: {
  draftId?: string;
  variant?: "research" | "handbook";
}) {
  const reportSections =
      variant === "handbook" ? handbookSections : researchSections,
    reportPhotos = variant === "handbook" ? handbookPhotos : researchPhotos;
  const Paper = variant === "handbook" ? HandbookPaper : ReportPaper;
  const documentTitle =
    variant === "handbook" ? "出发之前 · 旅行行动手册" : "开放影像研究报告";
  const [s, set, error] = useSampleState(variant, draftId, initial);
  const [notice, msg] = useState("");
  const [zoom, scale] = useState(100);
  const [editing, edit] = useState(false);
  const [comment, note] = useState("");
  const [query, search] = useState("");
  const papers = useRef<(HTMLDivElement | null)[]>([]);
  const active = Math.max(0, Math.min(19, s.page));
  const [overset, setOverset] = useState<number[]>([]);
  const overflowPages = () =>
    papers.current.flatMap((wrap, i) => {
      const el = wrap?.querySelector(".paper-content");
      return el && el.scrollHeight > el.clientHeight + 2 ? [i] : [];
    });
  useEffect(() => {
    let active = true;
    const check = () => {
      if (active)
        setOverset((old) => {
          const next = overflowPages();
          return old.join() === next.join() ? old : next;
        });
    };
    const observer = new ResizeObserver(check);
    papers.current.forEach((w) => {
      const el = w?.querySelector(".paper-content");
      if (el) observer.observe(el);
    });
    document.addEventListener("load", check, true);
    void document.fonts.ready.then(check);
    check();
    return () => {
      active = false;
      observer.disconnect();
      document.removeEventListener("load", check, true);
    };
  }, [s.titles, s.bodies, zoom]);
  function printReport() {
    const pages = overflowPages();
    if (pages.length) {
      setOverset(pages);
      set((v) => ({ ...v, page: pages[0] }));
      edit(true);
      msg("内容超出纸张，请精简标记页后再打印，避免正文被裁切。");
      return;
    }
    window.print();
  }
  const jump = (page: number) => {
    set((v) => ({ ...v, page }));
    papers.current[page]?.scrollIntoView({ block: "start", behavior: "auto" });
  };
  function copy() {
    try {
      copySample(variant, s);
    } catch {
      msg("副本保存失败，请下载文稿备份。");
    }
  }
  return (
    <main className={`sample-view report-view ${variant}-view`}>
      <SampleTop
        type="分页文档 · A4 · 20页"
        title={documentTitle}
        draftId={draftId}
        onCopy={copy}
      >
        <button
          onClick={() =>
            download(
              new Blob(
                [
                  JSON.stringify(
                    {
                      format: "DesignBuddy paginated report v2",
                      sections: reportSections.map((p, i) => ({
                        ...p,
                        title: s.titles[i] ?? p.title,
                        paragraphs: s.bodies[i] ?? p.paragraphs,
                      })),
                      comments: s.comments,
                      photoCredits: reportPhotos,
                    },
                    null,
                    2,
                  ),
                ],
                { type: "application/json" },
              ),
              documentTitle + "-文稿.json",
            )
          }
        >
          下载文稿备份
        </button>
        <button onClick={printReport}>打印 / 另存 PDF</button>
      </SampleTop>
      <Notice text={error || notice} />
      <div className="report-toolbar">
        <div>
          <button
            aria-pressed={!s.continuous}
            onClick={() => set((v) => ({ ...v, continuous: false }))}
          >
            分页阅读
          </button>
          <button
            aria-pressed={s.continuous}
            onClick={() => set((v) => ({ ...v, continuous: true }))}
          >
            连续阅读
          </button>
        </div>
        <label>
          缩放
          <select
            aria-label="文档缩放"
            value={zoom}
            onChange={(e) => scale(Number(e.target.value))}
          >
            {[75, 100, 125, 150].map((n) => (
              <option value={n} key={n}>
                {n}%
              </option>
            ))}
          </select>
        </label>
        <button aria-expanded={editing} onClick={() => edit(!editing)}>
          {editing ? "关闭编辑与批注" : "编辑与批注"}
        </button>
      </div>
      <div className={`report-layout ${editing ? "with-editor" : ""}`}>
        <aside className="report-toc">
          <h2>
            目录 <span>20 页</span>
          </h2>
          <input
            aria-label="搜索文档目录"
            value={query}
            onChange={(e) => search(e.target.value)}
            placeholder="查找章节"
          />
          <nav
            aria-label={
              variant === "handbook" ? "旅行手册目录" : "研究报告目录"
            }
          >
            {reportSections
              .filter((p, i) => (s.titles[i] ?? p.title).includes(query))
              .map((p) => (
                <button
                  key={p.index}
                  aria-current={active === p.index ? "page" : undefined}
                  onClick={() => jump(p.index)}
                >
                  <span>{String(p.index + 1).padStart(2, "0")}</span>
                  {(s.titles[p.index] ?? p.title).replace(/\n/g, " ")}
                </button>
              ))}
          </nav>
        </aside>
        <div
          className={`report-pages ${s.continuous ? "is-continuous" : ""}`}
          style={{ "--paper-zoom": zoom / 100 } as CSSProperties}
        >
          {reportSections.map((p, i) => (
            <div
              className="report-sheet-wrap"
              key={i}
              ref={(el) => {
                papers.current[i] = el;
              }}
            >
              <Paper index={i} title={s.titles[i]} paragraphs={s.bodies[i]} />
              <button
                className="report-page-edit"
                aria-label={`编辑或批注第${i + 1}页`}
                onClick={() => {
                  set((v) => ({ ...v, page: i }));
                  edit(true);
                }}
              >
                第 {i + 1} 页 · 编辑 / 批注{" "}
                {s.comments.filter((c) => c.page === i).length
                  ? `(${s.comments.filter((c) => c.page === i).length})`
                  : ""}
              </button>
            </div>
          ))}
        </div>
        {editing && (
          <aside className="report-editor">
            <h2>
              第 {active + 1} 页{" "}
              <button aria-label="关闭文档编辑" onClick={() => edit(false)}>
                ×
              </button>
            </h2>
            <label>
              章节标题
              <input
                aria-label="章节标题"
                maxLength={90}
                value={s.titles[active] ?? reportSections[active].title}
                onChange={(e) =>
                  set((v) => ({
                    ...v,
                    titles: { ...v.titles, [active]: e.target.value },
                  }))
                }
              />
            </label>
            <label>
              章节正文
              <textarea
                aria-label="章节正文"
                maxLength={1600}
                rows={10}
                value={(
                  s.bodies[active] ?? reportSections[active].paragraphs
                ).join("\n\n")}
                onChange={(e) =>
                  set((v) => ({
                    ...v,
                    bodies: {
                      ...v.bodies,
                      [active]: e.target.value.split("\n\n"),
                    },
                  }))
                }
              />
            </label>
            <small>
              实时保存到此浏览器。A4固定版式；过长的标题或正文需要精简后打印。
            </small>
            {overset.length > 0 && (
              <p className="report-overflow-warning" role="alert">
                第 {overset.map((i) => i + 1).join("、")}{" "}
                页内容超出纸张。请精简文字；打印按钮会先检查，避免裁切。
              </p>
            )}
            <h3>页面批注</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (comment.trim()) {
                  set((v) => ({
                    ...v,
                    comments: [
                      ...v.comments,
                      {
                        id: crypto.randomUUID(),
                        page: active,
                        text: comment.trim(),
                      },
                    ].slice(-100),
                  }));
                  note("");
                }
              }}
            >
              <textarea
                aria-label="新增页面批注"
                required
                maxLength={500}
                value={comment}
                onChange={(e) => note(e.target.value)}
                placeholder="记录需要复核的内容"
              />
              <button>添加批注</button>
            </form>
            {s.comments
              .filter((c) => c.page === active)
              .map((c) => (
                <article key={c.id}>
                  <small>本地批注</small>
                  <p>{c.text}</p>
                  <button
                    aria-label={`删除批注：${c.text}`}
                    onClick={() =>
                      set((v) => ({
                        ...v,
                        comments: v.comments.filter((x) => x.id !== c.id),
                      }))
                    }
                  >
                    删除
                  </button>
                </article>
              ))}
          </aside>
        )}
      </div>
      <Credits photos={reportPhotos} />
    </main>
  );
}

export function TravelHandbook({ draftId }: { draftId?: string }) {
  return <ResearchReport variant="handbook" draftId={draftId} />;
}
