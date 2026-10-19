import { lazy, Suspense, useEffect, useState } from "react";
import SkillWorkbench from "../../../../../frontend/workspace/SkillWorkbench";
import { navigateTo } from "../../../../../frontend/workspace/workspaceRoutes";
import "./word-pro-report.css";
const PdfPreview = lazy(
  () => import("../../../../../frontend/workspace/PdfPreview"),
);
const base = `${import.meta.env.BASE_URL}word-examples/word-pro`;
export default function WordProReport() {
  const [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  const [type, setType] = useState("business-report"),
    [quality, setQuality] = useState<any>(null),
    [page, setPage] = useState(1),
    [view, setView] = useState<"images" | "pdf" | "before">("images");
  useEffect(() => {
    let stopped = false;
    setQuality(null);
    setError("");
    setPage(1);
    setView("images");
    fetch(`${base}/${type}/word-quality-report.json`)
      .then((r) => {
        if (!r.ok) throw Error("质量记录读取失败");
        return r.json();
      })
      .then((v) => {
        const hex = (x: unknown) =>
          typeof x === "string" && /^[a-f0-9]{64}$/.test(x);
        const r = v?.renderer;
        if (
          v?.schemaVersion !== 1 ||
          v.documentType !== type ||
          v.commercialApproval !== false ||
          !["blocked", "needs-human-review"].includes(v.releaseStatus) ||
          !r ||
          r.rasterEngine !== "libreoffice" ||
          !Number.isInteger(r.pageCount) ||
          r.pageCount < 1 ||
          r.pageCount > 20 ||
          !hex(v.finalDocxSHA256) ||
          !hex(v.finalPdfSHA256) ||
          r.sourceSHA256 !== v.finalDocxSHA256 ||
          r.pdfSHA256 !== v.finalPdfSHA256 ||
          !Array.isArray(r.pages) ||
          r.pages.length !== r.pageCount ||
          r.pages.some(
            (p: any, i: number) =>
              p.page !== i + 1 ||
              p.file !== `pages/${String(i + 1).padStart(2, "0")}.jpg` ||
              !hex(p.sha256),
          ) ||
          !Array.isArray(v.issues) ||
          !Array.isArray(v.limitations) ||
          v.limitations.some((x: any) => typeof x !== "string") ||
          !Array.isArray(v.repairRounds) ||
          v.repairRounds.length < 1 ||
          v.repairRounds.length > 3 ||
          v.repairRounds.some(
            (x: any, i: number) =>
              x.round !== i ||
              !hex(x.docxSHA256) ||
              !hex(x.pdfSHA256) ||
              !Array.isArray(x.issues) ||
              !Array.isArray(x.actions),
          )
        )
          throw Error("质量记录版本、哈希或页面清单无效；未把它当作成功结果。");
        if (!stopped) setQuality(v);
      })
      .catch((e) => {
        if (!stopped) setError(e.message || "质量记录读取失败");
      });
    return () => {
      stopped = true;
    };
  }, [type, retry]);
  const dir = `${base}/${type}`,
    count = quality?.renderer?.pageCount || 0;
  return (
    <main className="word-pro-report">
      <button onClick={() => navigateTo("/inspiration")}>← 返回模版库</button>
      <header>
        <small>WORD PRO / REAL PAGINATION / BOUNDED REPAIR</small>
        <h1>Word专业排版 · 从文件生成到可核对交付</h1>
        <p>
          原生章节、表格、图片、页眉页脚；同一DOCX导出的真实PDF与全页预览。不是HTML模拟分页，也不是商业认证。
        </p>
        <nav>
          <a href={`${dir}/document.docx`} download>
            下载可编辑Word
          </a>
          <a href={`${dir}/document.pdf`} download>
            下载同源PDF
          </a>
          <a href={`${dir}/word-delivery.zip`} download>
            下载完整证据包
          </a>
          <a href="#word-create">用自己的内容生成</a>
        </nav>
      </header>
      <div className="word-case-tabs" role="group" aria-label="Word文档类型">
        <button
          aria-pressed={type === "business-report"}
          onClick={() => setType("business-report")}
        >
          商业报告 · 摘要/分析/建议
        </button>
        <button
          aria-pressed={type === "project-plan"}
          onClick={() => setType("project-plan")}
        >
          项目方案 · 目标/范围/交付/风险/验收
        </button>
      </div>
      <p className="word-case-boundary">
        原创方法示例，不是真实业务或外部模型生成验收。商业报告的输入故意关闭标题保护、重复表头并设置超宽列，以验证有限修复；项目方案使用不同的必需章节。所有结果仍需人工复核。
      </p>
      {error ? (
        <p role="alert">
          {error}{" "}
          <button onClick={() => setRetry((n) => n + 1)}>
            重试读取Word证据
          </button>
        </p>
      ) : !quality ? (
        <p role="status">正在读取实际质量记录…</p>
      ) : (
        <>
          <section
            aria-label="Word质量与修复记录"
            className="word-quality-summary"
          >
            <div>
              <b>{count}页</b>
              <span>真实LibreOffice分页</span>
            </div>
            <div>
              <b>{quality.repairRounds.length - 1}轮</b>
              <span>实际执行的修复</span>
            </div>
            <div>
              <b>
                {
                  quality.issues.filter((i: any) => i.severity === "critical")
                    .length
                }
                项关键问题
              </b>
              <span>限自动检查覆盖范围</span>
            </div>
            <div>
              <b>需人工复核</b>
              <span>综合评分未校准，不显示分数</span>
            </div>
          </section>
          <section className="word-reader" aria-label="Word真实页面">
            <div className="word-reader-toolbar">
              <button
                aria-pressed={view === "images"}
                onClick={() => setView("images")}
              >
                最终逐页图
              </button>
              <button
                aria-pressed={view === "pdf"}
                onClick={() => setView("pdf")}
              >
                实际同源PDF
              </button>
              <button
                aria-pressed={view === "before"}
                onClick={() => setView("before")}
              >
                初始版PDF对照
              </button>
            </div>
            {view === "images" ? (
              <div className="word-image-reader">
                <aside aria-label="Word页面缩略图">
                  {Array.from({ length: count }, (_, i) => (
                    <button
                      key={i}
                      aria-label={`查看Word第${i + 1}页`}
                      aria-pressed={page === i + 1}
                      onClick={() => setPage(i + 1)}
                    >
                      <img
                        loading="lazy"
                        src={`${dir}/pages/${String(i + 1).padStart(2, "0")}.jpg`}
                        alt=""
                      />
                      <span>{i + 1}</span>
                    </button>
                  ))}
                </aside>
                <div>
                  <p>
                    第 {page} / {count} 页 · 最终DOCX的实际渲染
                  </p>
                  <img
                    className="word-actual-page"
                    src={`${dir}/pages/${String(page).padStart(2, "0")}.jpg`}
                    alt={`Word实际渲染第${page}页`}
                  />
                </div>
              </div>
            ) : (
              <Suspense fallback={<p>正在加载PDF…</p>}>
                <PdfPreview
                  key={`${type}-${view}`}
                  url={
                    view === "before"
                      ? `${dir}/iterations/0/document.pdf`
                      : `${dir}/document.pdf`
                  }
                />
              </Suspense>
            )}
          </section>
          <section
            aria-label="每轮检查与修复依据"
            className="word-repair-history"
          >
            <h2>有问题才修复，不为凑分数改内容</h2>
            {quality.repairRounds.map((r: any) => (
              <details key={r.round}>
                <summary>
                  第{r.round}轮 · {r.pageCount}页 · {r.issues.length}项检查信号
                  · {r.actions.length}项动作
                </summary>
                <p>内容清单：{r.contentHash}</p>
                <ul>
                  {r.actions.map((a: any) => (
                    <li key={a.issueId}>
                      {a.nodeId} · {a.action}（只改变版式参数）
                    </li>
                  ))}
                </ul>
                <p>
                  DOCX：<code>{r.docxSHA256}</code>
                  <br />
                  PDF：<code>{r.pdfSHA256}</code>
                </p>
                <a
                  href={`${dir}/iterations/${r.round}/document.pdf`}
                  target="_blank"
                  rel="noreferrer"
                >
                  打开本轮实际PDF
                </a>
              </details>
            ))}
          </section>
          <details>
            <summary>检查范围与未完成项</summary>
            <ul>
              {quality.limitations.map((t: string) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <p>
              章节导航是无页码的原生内部链接；不宣称自动目录字段已刷新。字体：Noto
              Sans SC，DOCX不内嵌字体。渲染后端：{quality.renderer.backend}
              ，不是Microsoft Word。
            </p>
          </details>
        </>
      )}
      <section id="word-create">
        <h2>新建自己的Word文稿</h2>
        <p>
          填写实际内容或载入结构化稿。不会自动上传本页示例，不调用外部AI；准备后仍需单独同意后台执行。
        </p>
        <SkillWorkbench
          expertId="documents"
          taskId="word-pro-independent"
          initialSkillId="document.create"
          allowedSkillIds={["document.create"]}
        />
      </section>
    </main>
  );
}
