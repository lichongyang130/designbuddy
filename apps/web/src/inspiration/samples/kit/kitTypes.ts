/**
 * Data-driven template definitions.
 *
 * A template set is a list of real pages. Each page is content, not a layout
 * hack: the renderer only knows how to lay out the page kinds declared here,
 * and the validator refuses sets that are padded with placeholders, repeated
 * titles or missing artwork.
 */
export type KitPalette = {
  background: string;
  surface: string;
  ink: string;
  accent: string;
  muted: string;
};

export type KitPage =
  | { kind: "cover"; title: string; subtitle: string; meta: string[]; art: string; note: string }
  | { kind: "intro"; title: string; lead: string; body: string[]; points: { title: string; body: string }[]; art: string }
  | { kind: "gallery"; title: string; lead: string; items: { title: string; body: string; art: string; meta: string[] }[] }
  | { kind: "spec"; title: string; lead: string; rows: { label: string; value: string }[]; note: string; art: string }
  | { kind: "table"; title: string; lead: string; columns: string[]; rows: string[][]; note: string }
  | { kind: "steps"; title: string; lead: string; steps: { title: string; body: string }[]; note: string }
  | { kind: "timeline"; title: string; lead: string; items: { when: string; title: string; body: string }[] }
  | { kind: "pricing"; title: string; lead: string; plans: { name: string; price: string; unit: string; items: string[]; featured: boolean }[]; note: string }
  | { kind: "story"; title: string; lead: string; paragraphs: string[]; quote: string; quoteBy: string; art: string }
  | { kind: "faq"; title: string; lead: string; items: { q: string; a: string }[]; note: string }
  | { kind: "cta"; title: string; lead: string; actions: { label: string; note: string }[]; contacts: { label: string; value: string }[] };

export type KitTemplate = {
  id: string;
  title: string;
  category: string;
  format: string;
  description: string;
  palette: KitPalette;
  pages: KitPage[];
};

export type KitProblem = { page: number; kind: string; message: string };

const MIN_PAGES = 20;
const MAX_PAGES = 32;
/** Real placeholder markers. "占位" alone is legitimate business wording (预约占位). */
const banned = /lorem|ipsum|待补充|\bTODO\b|\bTBD\b|示例文字|占位文字|占位符|\bXXX\b/i;

function textOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Check that a template set really contains 20–32 substantive pages.
 * The rules exist to keep "planned" out of the shelf: every page needs a
 * title, real sentences, and its own artwork where the layout uses artwork.
 */
export function validateKitTemplate(template: KitTemplate, artwork: string[] = []): KitProblem[] {
  const problems: KitProblem[] = [];
  if (!/^[a-z0-9-]{3,40}$/.test(template.id)) problems.push({ page: 0, kind: "template", message: "模板 id 不合法。" });
  if (!template.title.trim()) problems.push({ page: 0, kind: "template", message: "模板缺少标题。" });
  if (!template.description.trim()) problems.push({ page: 0, kind: "template", message: "模板缺少简介。" });
  const pages = template.pages || [];
  if (pages.length < MIN_PAGES || pages.length > MAX_PAGES)
    problems.push({ page: 0, kind: "template", message: `页面数量应为 ${MIN_PAGES}–${MAX_PAGES}，当前 ${pages.length}。` });
  const titles = new Set<string>();
  const art = new Set(artwork);
  pages.forEach((page, index) => {
    const number = index + 1;
    const title = textOf((page as { title?: string }).title);
    if (!title) problems.push({ page: number, kind: page.kind, message: "页面缺少标题。" });
    if (titles.has(title)) problems.push({ page: number, kind: page.kind, message: `标题重复：${title}` });
    titles.add(title);
    const lead = textOf((page as { lead?: string }).lead);
    if (lead && banned.test(lead)) problems.push({ page: number, kind: page.kind, message: "导语仍是占位文字。" });
    if (!lead && page.kind !== "cover") problems.push({ page: number, kind: page.kind, message: "页面缺少导语。" });
    const bodyText = JSON.stringify(page);
    if (banned.test(bodyText)) problems.push({ page: number, kind: page.kind, message: "页面仍含占位文字。" });
    const artwork = textOf((page as { art?: string }).art);
    if (artwork && art.size && !art.has(artwork))
      problems.push({ page: number, kind: page.kind, message: `素材缺失：${artwork}` });
    if (page.kind === "gallery" && page.items.length < 3)
      problems.push({ page: number, kind: page.kind, message: "画廊至少需要 3 个条目。" });
    if (page.kind === "table" && page.rows.length < 3)
      problems.push({ page: number, kind: page.kind, message: "表格至少需要 3 行数据。" });
    if (page.kind === "steps" && page.steps.length < 3)
      problems.push({ page: number, kind: page.kind, message: "步骤页至少需要 3 个步骤。" });
    if (page.kind === "faq" && page.items.length < 4)
      problems.push({ page: number, kind: page.kind, message: "问答页至少需要 4 条问答。" });
  });
  return problems;
}
