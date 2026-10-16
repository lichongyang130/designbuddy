import { strToU8, zipSync } from "fflate";
import type { SkillInput } from "./executors";
import { json, out, text, xml } from "./io";

function inline(value: string) {
  return xml(value)
    .replace(/\*\*([^*\n]{1,240})\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]{1,160})\*/g, "<em>$1</em>")
    .replace(/`([^`\n]{1,160})`/g, "<code>$1</code>");
}
function parseMarkdown(source: string) {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: { type: string; text: string; level?: number }[] = [];
  let paragraph: string[] = [], list: string[] = [];
  const flushParagraph = () => { if (paragraph.length) { blocks.push({ type: "paragraph", text: paragraph.join(" ").trim() }); paragraph = []; } };
  const flushList = () => { if (list.length) { blocks.push({ type: "list", text: list.join("\n") }); list = []; } };
  for (const line of lines) {
    const h = /^(#{1,3})\s+(.+?)\s*$/.exec(line);
    const li = /^\s*[-*+]\s+(.+?)\s*$/.exec(line);
    if (h) { flushParagraph(); flushList(); blocks.push({ type: "heading", level: h[1].length, text: h[2] }); }
    else if (li) { flushParagraph(); list.push(li[1]); }
    else if (/^>\s?/.test(line)) { flushParagraph(); flushList(); blocks.push({ type: "quote", text: line.replace(/^>\s?/, "") }); }
    else if (!line.trim()) { flushParagraph(); flushList(); }
    else { flushList(); paragraph.push(line.trim()); }
    if (blocks.length + list.length > 600) throw Error("文章区块超过600个上限。");
  }
  flushParagraph(); flushList();
  if (!blocks.length) throw Error("未发现可排版的文章内容。");
  return blocks;
}

export async function articleMagazine(input: SkillInput, event: (message: string) => void) {
  const source = text(input.bytes);
  if (source.length > 40_000) throw Error("杂志长文排版最多40000字。");
  const blocks = parseMarkdown(source);
  const firstHeading = blocks.find(block => block.type === "heading" && block.level === 1);
  const title = firstHeading?.text || "编辑精选";
  const body = blocks.filter(block => block !== firstHeading).map(block => {
    if (block.type === "heading") return `<h${Math.min((block.level || 2) + 1, 4)}>${inline(block.text)}</h${Math.min((block.level || 2) + 1, 4)}>`;
    if (block.type === "quote") return `<blockquote>${inline(block.text)}</blockquote>`;
    if (block.type === "list") return `<ul>${block.text.split("\n").map(item => `<li>${inline(item)}</li>`).join("")}</ul>`;
    return `<p>${inline(block.text)}</p>`;
  }).join("\n");
  const css = `:root{color-scheme:light;--ink:#242b27;--muted:#69736d;--paper:#f5f1e8;--accent:#a34f39;--line:#ded8ca}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:18px/1.85 Georgia,"Noto Serif CJK SC","Songti SC",serif}.masthead{max-width:1080px;margin:auto;padding:32px 6vw 24px;border-bottom:1px solid var(--line);font:700 12px/1.4 Arial,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:var(--accent)}main{max-width:760px;margin:0 auto;padding:8vh 30px 12vh}h1{font-size:clamp(42px,8vw,78px);line-height:1.08;letter-spacing:-.045em;margin:0 0 52px;max-width:13ch}h2,h3,h4{font-family:Arial,"Noto Sans CJK SC",sans-serif;line-height:1.3;margin:2.6em 0 .8em}h2{font-size:30px}h3{font-size:24px}p{margin:0 0 1.35em}strong{font-weight:700}em{color:var(--accent)}blockquote{margin:2.4em 0;padding:8px 0 8px 24px;border-left:3px solid var(--accent);font-size:1.25em;line-height:1.55}ul{padding-left:1.3em;margin:1.3em 0 2em}li{padding:.2em 0}code{font: .85em ui-monospace,monospace;background:#e9e3d7;padding:.1em .35em;border-radius:4px}.endmark{margin-top:4em;color:var(--accent);font:700 12px Arial,sans-serif;letter-spacing:.2em}@media(max-width:600px){body{font-size:17px}main{padding:48px 22px 72px}.masthead{padding:24px 22px}h1{font-size:46px}}@media print{body{background:white}.masthead{padding-top:0}main{padding:28px 0}h1{font-size:48px}}`;
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${xml(title)}</title><style>${css}</style></head><body><header class="masthead">FIELD NOTES · EDITORIAL</header><main><article><h1>${xml(title)}</h1>${body}<p class="endmark" aria-label="文章结束">END OF STORY</p></article></main></body></html>`;
  const report = { skill: "article.magazine", version: "1.0.0", title, blocks: blocks.length, sourceCharacters: source.length, transformed: { headings: blocks.filter(b => b.type === "heading").length, paragraphs: blocks.filter(b => b.type === "paragraph").length, quotes: blocks.filter(b => b.type === "quote").length, lists: blocks.filter(b => b.type === "list").length }, capabilities: ["安全转义HTML", "受限Markdown标题、段落、引用、列表、粗体、斜体和行内代码", "响应式与打印样式"], limitations: ["不执行AI改写、事实核验、图片检索或浏览器渲染。", "链接、图片、表格、嵌套列表和原始HTML不会解释为活动内容。", "生成的是可独立打开的HTML，不是PDF或原生杂志排版文件；需人工检查分页与字体回退。"] };
  const archive = zipSync({ "article.html": strToU8(html), "article-report.json": strToU8(JSON.stringify(report, null, 2)) }, { level: 6 });
  event(`已解析${blocks.length}个文章区块，生成含响应式与打印CSS的独立HTML及ZIP；未执行浏览器渲染。`);
  return { summary: `已将${blocks.length}个文章区块排成杂志风格响应式HTML。`, outputs: [out("editorial-article.html", "text/html; charset=utf-8", html), out("editorial-package.zip", "application/zip", archive), json("editorial-report.json", report)] };
}
