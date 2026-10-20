import { useEffect, useMemo, useRef, useState } from "react";
import { validateKitTemplate, type KitPage, type KitTemplate } from "./kitTypes";
import { rewriteTextBatch } from "../../../utils/ollamaClient";
import "./kit.css";

const artworkFiles = import.meta.glob<string>(
  [
    "../../assets/kit/*/*.svg",
    "../../assets/expansion/*.jpg",
    "../../assets/expansion/*.webp",
    "../../assets/expansion/*.png",
    "../../assets/expansion/*.gif"
  ],
  { eager: true, query: "?url", import: "default" },
);

/** File names available for one set, used by the content validator. */
function artworkNames(setId: string): string[] {
  return Object.keys(artworkFiles)
    .filter((path) => path.includes(`/kit/${setId}/`) || path.includes(`/expansion/${setId}-`))
    .map((path) => {
      const parts = path.split("/");
      if (path.includes("/expansion/")) {
        return `expansion/${parts.pop()}`;
      }
      return parts.pop() as string;
    });
}

/**
 * Renders a data-driven template set.
 *
 * The renderer only lays out the declared page kinds; every sentence and every
 * image reference comes from the template definition, so a set that is not
 * really made cannot look finished here.
 */
export function kitArtwork(setId: string, file: string): string {
  if (file.startsWith("expansion/")) {
    const matched = Object.keys(artworkFiles).find((path) => path.endsWith(file));
    if (matched) return artworkFiles[matched];
    return `/src/assets/${file}`;
  }
  const matched = Object.keys(artworkFiles).find((path) => path.includes(`/kit/${setId}/${file}`));
  if (matched) return artworkFiles[matched];
  return `/src/assets/kit/${setId}/${file}`;
}

function PageArt({ setId, file, alt }: { setId: string; file: string; alt: string }) {
  if (!file) return null;
  return <img className="kit-art" src={kitArtwork(setId, file)} alt={alt} loading="lazy" decoding="async" />;
}

export default function KitTemplate({ template: initialTemplate }: { template: KitTemplate }) {
  const [template, setTemplate] = useState(initialTemplate);
  const [index, setIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const page = template.pages[Math.min(index, template.pages.length - 1)];
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTemplate(initialTemplate);
    setIndex(0);
  }, [initialTemplate]);

  useEffect(() => {
    fetch('http://localhost:4124/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(template)
    }).catch(() => {});
  }, [template]);

  useEffect(() => {
    const handleAgentData = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.pages) {
        setTemplate(customEvent.detail);
      }
    };
    window.addEventListener("buddy:agent-update-data", handleAgentData);
    return () => window.removeEventListener("buddy:agent-update-data", handleAgentData);
  }, []);

  useEffect(() => {
    const handleSkill = async (e: Event) => {
      const customEvent = e as CustomEvent;
      const { type } = customEvent.detail;
      
      if (type === 'magic-copy' || type === 'fill-mock-data') {
        let clone = JSON.parse(JSON.stringify(template));
        
        if (type === 'magic-copy') {
          // Collect texts
          const textMap: Record<string, string> = {};
          let textId = 0;
          
          const collect = (obj: any) => {
            for (const k in obj) {
              if (typeof obj[k] === 'string') {
                const val = obj[k];
                if (val.length > 4 && !val.includes('http') && !val.includes('/') && !val.includes('.svg') && !val.includes('.jpg') && !val.includes('.png') && !val.includes('.webp') && !val.startsWith('#') && !/^[A-Za-z0-9_-]+$/.test(val)) {
                  const id = `k_${textId++}`;
                  textMap[id] = val;
                  obj[k] = `__KIT_TEXT_ID_${id}__`; // temporary marker
                }
              } else if (typeof obj[k] === 'object' && obj[k] !== null) {
                collect(obj[k]);
              }
            }
          };
          
          collect(clone);
          
          // Send to Ollama
          if (Object.keys(textMap).length > 0) {
            console.log("Rewriting kit texts:", Object.keys(textMap).length);
            const rewritten = await rewriteTextBatch(textMap, "更加专业且吸引人的风格");
            
            // Re-apply
            const apply = (obj: any) => {
              for (const k in obj) {
                if (typeof obj[k] === 'string' && obj[k].startsWith('__KIT_TEXT_ID_')) {
                  const id = obj[k].replace('__KIT_TEXT_ID_', '').replace('__', '');
                  obj[k] = rewritten[id] || textMap[id]; 
                } else if (typeof obj[k] === 'object' && obj[k] !== null) {
                  apply(obj[k]);
                }
              }
            };
            apply(clone);
          }
        }
        
        if (type === 'fill-mock-data') {
          const walk = (obj: any) => {
            for (const k in obj) {
              if (typeof obj[k] === 'number' && obj[k] > 0) {
                const multiplier = 0.8 + Math.random() * 0.4;
                obj[k] = Math.round(obj[k] * multiplier);
              } else if (typeof obj[k] === 'object' && obj[k] !== null) {
                walk(obj[k]);
              }
            }
          };
          walk(clone);
        }
        
        setTemplate(clone);
      }
    };
    window.addEventListener("buddy:ai-skill", handleSkill);
    return () => window.removeEventListener("buddy:ai-skill", handleSkill);
  }, [template]);

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
