import { useEffect, useMemo, useRef, useState } from "react";
import { validateKitTemplate, type KitPage, type KitTemplate } from "./kitTypes";
import "./kit.css";

const artworkFiles = import.meta.glob<string>(
  ["../../assets/kit/*/*.svg"],
  { eager: true, query: "?url", import: "default" },
);

/** File names available for one set, used by the content validator. */
function artworkNames(setId: string): string[] {
  return Object.keys(artworkFiles)
    .filter((path) => path.includes(`/kit/${setId}/`))
    .map((path) => path.split("/").pop() as string);
}

/**
 * Renders a data-driven template set.
 *
 * The renderer only lays out the declared page kinds; every sentence and every
 * image reference comes from the template definition, so a set that is not
 * really made cannot look finished here.
 */
export function kitArtwork(setId: string, file: string): string {
  return `/src/assets/kit/${setId}/${file}`;
}

function PageArt({ setId, file, alt }: { setId: string; file: string; alt: string }) {
  if (!file) return null;
  return <img className="kit-art" src={kitArtwork(setId, file)} alt={alt} loading="lazy" decoding="async" />;
}

export default function KitTemplate({ template }: { template: KitTemplate }) {
  const [index, setIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const page = template.pages[Math.min(index, template.pages.length - 1)];
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIndex(0);
  }, [template.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        setIndex((current) => Math.min(template.pages.length - 1, current + 1));
        event.preventDefault();
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        setIndex((current) => Math.max(0, current - 1));
        event.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [template.pages.length]);

  const problems = useMemo(
    () => validateKitTemplate(template, artworkNames(template.id)),
    [template],
  );

  const style = useMemo(() => ({
    "--kit-background": template.palette.background,
    "--kit-surface": template.palette.surface,
    "--kit-ink": template.palette.ink,
    "--kit-accent": template.palette.accent,
    "--kit-muted": template.palette.muted,
  }) as React.CSSProperties, [template.palette]);

  const render = (item: KitPage) => {
    if (item.kind === "cover")
      return <section className="kit-page kit-page-cover" aria-label={item.title}>
        <div className="kit-cover-copy">
          <span className="kit-eyebrow">{item.meta.join(" · ")}</span>
          <h1>{item.title}</h1>
          <p className="kit-lead">{item.subtitle}</p>
          <p className="kit-note">{item.note}</p>
        </div>
        <PageArt setId={template.id} file={item.art} alt={`${item.title} 封面图`} />
      </section>;
    if (item.kind === "intro")
      return <section className="kit-page" aria-label={item.title}>
        <header className="kit-page-head"><h2>{item.title}</h2><p className="kit-lead">{item.lead}</p></header>
        <div className="kit-two-col">
          <div className="kit-prose">{item.body.map((paragraph) => <p key={paragraph.slice(0, 12)}>{paragraph}</p>)}</div>
          <ul className="kit-points">{item.points.map((point) => <li key={point.title}><b>{point.title}</b><span>{point.body}</span></li>)}</ul>
        </div>
        <PageArt setId={template.id} file={item.art} alt={`${item.title} 配图`} />
      </section>;
    if (item.kind === "gallery")
      return <section className="kit-page" aria-label={item.title}>
        <header className="kit-page-head"><h2>{item.title}</h2><p className="kit-lead">{item.lead}</p></header>
        <div className="kit-gallery">{item.items.map((entry) => <article key={entry.title} className="kit-card">
          <PageArt setId={template.id} file={entry.art} alt={`${entry.title} 配图`} />
          <div className="kit-card-body"><h3>{entry.title}</h3><p>{entry.body}</p><span>{entry.meta.join(" · ")}</span></div>
        </article>)}</div>
      </section>;
    if (item.kind === "spec")
      return <section className="kit-page" aria-label={item.title}>
        <header className="kit-page-head"><h2>{item.title}</h2><p className="kit-lead">{item.lead}</p></header>
        <div className="kit-two-col">
          <dl className="kit-spec">{item.rows.map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>
          <div className="kit-figure"><PageArt setId={template.id} file={item.art} alt={`${item.title} 示意图`} /><p className="kit-note">{item.note}</p></div>
        </div>
      </section>;
    if (item.kind === "table")
      return <section className="kit-page" aria-label={item.title}>
        <header className="kit-page-head"><h2>{item.title}</h2><p className="kit-lead">{item.lead}</p></header>
        <div className="kit-table-wrap"><table className="kit-table"><thead><tr>{item.columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr></thead>
          <tbody>{item.rows.map((row) => <tr key={row.join("|")}>{row.map((cell, cellIndex) => <td key={`${row[0]}-${cellIndex}`}>{cell}</td>)}</tr>)}</tbody>
        </table></div>
        <p className="kit-note">{item.note}</p>
      </section>;
    if (item.kind === "steps")
      return <section className="kit-page" aria-label={item.title}>
        <header className="kit-page-head"><h2>{item.title}</h2><p className="kit-lead">{item.lead}</p></header>
        <ol className="kit-steps">{item.steps.map((step, stepIndex) => <li key={step.title}><span className="kit-step-index">{String(stepIndex + 1).padStart(2, "0")}</span><div><h3>{step.title}</h3><p>{step.body}</p></div></li>)}</ol>
        <p className="kit-note">{item.note}</p>
      </section>;
    if (item.kind === "timeline")
      return <section className="kit-page" aria-label={item.title}>
        <header className="kit-page-head"><h2>{item.title}</h2><p className="kit-lead">{item.lead}</p></header>
        <ol className="kit-timeline">{item.items.map((entry) => <li key={entry.when}><span className="kit-when">{entry.when}</span><div><h3>{entry.title}</h3><p>{entry.body}</p></div></li>)}</ol>
      </section>;
    if (item.kind === "pricing")
      return <section className="kit-page" aria-label={item.title}>
        <header className="kit-page-head"><h2>{item.title}</h2><p className="kit-lead">{item.lead}</p></header>
        <div className="kit-plans">{item.plans.map((plan) => <article key={plan.name} className={`kit-plan${plan.featured ? " is-featured" : ""}`}>
          <h3>{plan.name}</h3><p className="kit-price">{plan.price}<small>{plan.unit}</small></p>
          <ul>{plan.items.map((entry) => <li key={entry}>{entry}</li>)}</ul>
        </article>)}</div>
        <p className="kit-note">{item.note}</p>
      </section>;
    if (item.kind === "story")
      return <section className="kit-page" aria-label={item.title}>
        <header className="kit-page-head"><h2>{item.title}</h2><p className="kit-lead">{item.lead}</p></header>
        <div className="kit-two-col">
          <div className="kit-prose">{item.paragraphs.map((paragraph) => <p key={paragraph.slice(0, 12)}>{paragraph}</p>)}
            <blockquote className="kit-quote"><p>{item.quote}</p><cite>{item.quoteBy}</cite></blockquote>
          </div>
          <PageArt setId={template.id} file={item.art} alt={`${item.title} 配图`} />
        </div>
      </section>;
    if (item.kind === "faq")
      return <section className="kit-page" aria-label={item.title}>
        <header className="kit-page-head"><h2>{item.title}</h2><p className="kit-lead">{item.lead}</p></header>
        <dl className="kit-faq">{item.items.map((entry) => <div key={entry.q}><dt>{entry.q}</dt><dd>{entry.a}</dd></div>)}</dl>
        <p className="kit-note">{item.note}</p>
      </section>;
    return <section className="kit-page" aria-label={item.title}>
      <header className="kit-page-head"><h2>{item.title}</h2><p className="kit-lead">{item.lead}</p></header>
      <div className="kit-actions">{item.actions.map((action) => <div key={action.label} className="kit-action"><b>{action.label}</b><span>{action.note}</span></div>)}</div>
      <dl className="kit-contacts">{item.contacts.map((contact) => <div key={contact.label}><dt>{contact.label}</dt><dd>{contact.value}</dd></div>)}</dl>
    </section>;
  };

  return <div
    className="kit-root"
    ref={root}
    style={style}
    data-template={template.id}
    data-valid={problems.length === 0 ? "true" : "false"}
  >
    <header className="kit-bar">
      <div className="kit-bar-title"><b>{template.title}</b><span>{template.format} · {template.pages.length} 页</span></div>
      <div className="kit-bar-actions">
        <button type="button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-label="切换页面目录">目录</button>
        <button type="button" onClick={() => setIndex((current) => Math.max(0, current - 1))} disabled={index === 0} aria-label="上一页">上一页</button>
        <span className="kit-counter" aria-live="polite">{index + 1} / {template.pages.length}</span>
        <button type="button" onClick={() => setIndex((current) => Math.min(template.pages.length - 1, current + 1))} disabled={index === template.pages.length - 1} aria-label="下一页">下一页</button>
      </div>
    </header>
    <div className="kit-body">
      <nav className={`kit-menu${menuOpen ? " is-open" : ""}`} aria-label="页面目录">
        <ol>{template.pages.map((item, itemIndex) => <li key={`${item.kind}-${itemIndex}`}>
          <button type="button" className={itemIndex === index ? "is-active" : ""} onClick={() => { setIndex(itemIndex); setMenuOpen(false); }}>
            <span>{String(itemIndex + 1).padStart(2, "0")}</span>{(item as { title: string }).title}
          </button>
        </li>)}</ol>
      </nav>
      <main className="kit-canvas" aria-label={`${template.title} 页面 ${index + 1}`}>
        {problems.length > 0 && (
          <p className="kit-invalid" role="status">
            内容校验未通过：{problems.map((problem) => `第 ${problem.page} 页 ${problem.message}`).join("；")}
          </p>
        )}
        {render(page)}
      </main>
    </div>
  </div>;
}

/** Small preview used by the inspiration catalogue. */
export function KitCover({ template }: { template: KitTemplate }) {
  const cover = template.pages.find((page) => page.kind === "cover") as Extract<KitPage, { kind: "cover" }> | undefined;
  return <div className="kit-preview" style={{
    "--kit-background": template.palette.background,
    "--kit-surface": template.palette.surface,
    "--kit-ink": template.palette.ink,
    "--kit-accent": template.palette.accent,
  } as React.CSSProperties}>
    {cover && <img src={kitArtwork(template.id, cover.art)} alt="" />}
    <span>{template.title}</span>
  </div>;
}
