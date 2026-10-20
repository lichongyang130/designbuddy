import { useMemo, useState } from "react";
import { navigateTo } from "../workspaceRoutes";
import { createPptProject, type PptProject, type PptSlide } from "../pptStore";
import { getFramework } from "../pptFrameworks";

function decodePptShare(): PptProject | null {
  try {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    // support both #ppt-share=xxx and #share=xxx for legacy
    const b64 = params.get("ppt-share") || params.get("ppt_share") || params.get("share");
    if (!b64) return null;
    const decoded = decodeURIComponent(escape(atob(decodeURIComponent(b64))));
    const obj = JSON.parse(decoded) as Partial<PptProject> & { slides?: PptSlide[]; framework?: string; workspace?: string };
    if (!Array.isArray(obj.slides) || !obj.slides.length) return null;
    const slides = obj.slides as PptSlide[];
    const fwId = typeof (obj as unknown as Record<string, unknown>).frameworkId === "string" ? (obj as unknown as Record<string, unknown>).frameworkId as string : typeof obj.framework === "string" ? obj.framework : undefined;
    const fwName = typeof obj.frameworkName === "string" ? obj.frameworkName : fwId ? getFramework(fwId)?.name : undefined;
    return {
      id: "shared-" + Math.random().toString(36).slice(2, 8),
      title: String(obj.title || "分享的演示文稿").slice(0, 48),
      prompt: String(obj.prompt || "").slice(0, 2000),
      slides,
      frameworkId: fwId,
      frameworkName: fwName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as PptProject;
  } catch {
    return null;
  }
}

export default function PptSharePage() {
  const shared = useMemo(() => decodePptShare(), []);
  const [page, setPage] = useState(0);
  if (!shared) {
    return (
      <main className="ppt-page ppt-list" style={{ padding: 24 }}>
        <header className="ppt-header">
          <h1>分享链接无效或已过期</h1>
          <button className="ppt-ghost" onClick={() => navigateTo("/")}>返回首页</button>
        </header>
        <div className="ppt-empty">
          <p>请让分享者重新复制链接。分享链接包含演示文稿完整内容，打开即可预览。</p>
          <button className="ppt-primary" onClick={() => navigateTo("/")}>去首页</button>
        </div>
      </main>
    );
  }
  const slide = shared.slides[Math.min(page, shared.slides.length - 1)];
  const fw = shared.frameworkId ? getFramework(shared.frameworkId) : undefined;
  const importToLocal = () => {
    const created = createPptProject(shared.prompt, shared.title, shared.slides, undefined, shared.frameworkId ? { id: shared.frameworkId, frameworkName: shared.frameworkName || fw?.name || "经典" } as unknown as { id: string; name: string } : undefined);
    navigateTo(`/ppt/${encodeURIComponent(created.id)}`);
  };
  return (
    <div className="workbuddy-app">
      <main className="ppt-page">
        <header className="ppt-toolbar">
          <div className="ppt-toolbar-left">
            <button className="ppt-ghost" onClick={() => navigateTo("/")}>← 首页</button>
            <strong style={{ fontSize: 14 }}>{shared.title}</strong>
            <span className="ppt-meta">{page + 1} / {shared.slides.length} 页 · 只读分享</span>
            {fw && <span className="ppt-framework-badge">{fw.name}</span>}
          </div>
          <div className="ppt-toolbar-right">
            <button className="ppt-ghost" onClick={importToLocal}>保存到本机并编辑</button>
            <button className="ppt-primary" onClick={() => navigateTo("/ppt")}>查看我的文稿</button>
          </div>
        </header>
        <div className="ppt-workspace ws-deck" style={{ gridTemplateColumns: "1fr" }}>
          <section className="ppt-stage">
            <div className={`ws-slide ws-slide-${slide.layout}`}>
              {(slide.layout === "cover" || slide.layout === "split") && slide.image && (
                <img src={slide.image} alt="" style={{ objectPosition: `${slide.focus}% center` }} />
              )}
              <div className="ws-slide-content">
                <small>{slide.eyebrow}</small>
                <h2 className="ws-slide-title" style={{ whiteSpace: "pre-wrap" }}>{slide.title}</h2>
                {slide.layout === "chart" ? (
                  <div className="ws-deck-bars">
                    {slide.body.split("\n").map((line, i) => {
                      const [label, value] = line.split("｜");
                      const amount = Number(value) || 0;
                      const max = Math.max(1, ...slide.body.split("\n").map((l) => Number(l.split("｜")[1]) || 0));
                      return <article key={i}><span>{label}</span><i style={{ height: `${Math.max(0, amount / max) * 100}%` }} /><strong>{amount}</strong></article>;
                    })}
                  </div>
                ) : slide.layout === "cards" || slide.layout === "timeline" ? (
                  <div className="ws-slide-cards">
                    {slide.body.split("\n").map((line, i) => <article key={i}><b>{String(i + 1).padStart(2, "0")}</b><p>{line.replaceAll("｜", "\n")}</p></article>)}
                  </div>
                ) : slide.layout === "table" ? (
                  <table><tbody>{slide.body.split("\n").map((line, i) => <tr key={i}>{line.split("｜").map((v, j) => <td key={j}>{v}</td>)}</tr>)}</tbody></table>
                ) : (
                  <p style={{ whiteSpace: "pre-wrap" }}>{slide.body}</p>
                )}
                <footer>AURA ONE / CONCEPT PROPOSAL <span>{String(page + 1).padStart(2, "0")}</span></footer>
                {slide.sources?.length ? <div style={{ marginTop: 8, fontSize: 11, color: "#64748b" }}>引用：{slide.sources.map((s) => s.label).join(" · ")}</div> : null}
              </div>
            </div>
            <div className="ws-play-controls">
              <button disabled={!page} onClick={() => setPage((p) => Math.max(0, p - 1))}>← 上一页</button>
              <span>{shared.prompt.slice(0, 80)}</span>
              <button disabled={page === shared.slides.length - 1} onClick={() => setPage((p) => Math.min(shared.slides.length - 1, p + 1))}>下一页 →</button>
            </div>
            <div className="ppt-prompt-preview">
              <small>原始需求：</small>
              <p>{shared.prompt}</p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
