import { openOffice } from "./office";
import { text } from "./io";
import { XMLParser, XMLValidator } from "fast-xml-parser";
export function paragraphs(input: { filename: string; bytes: Uint8Array }) {
  let value: string;
  if (/\.docx$/i.test(input.filename)) {
    const entries = openOffice(input.bytes, "word/document.xml");
    const source = text(entries["word/document.xml"]);
    if (XMLValidator.validate(source) !== true) throw Error("DOCX XML 损坏。");
    if (/<w:(?:ins|del|altChunk)\b/.test(source)) throw Error("请先接受或拒绝修订，并移除外部嵌入内容。");
    const parser = new XMLParser({ preserveOrder: true, ignoreAttributes: true, trimValues: false, parseTagValue: false, processEntities: false });
    const tree = parser.parse(source); const found: string[] = [];
    const decode = (s: string) => s.replace(/&(?:amp|lt|gt|quot|apos);/g, v => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" }[v]!)).replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) => { const code = n[0].toLowerCase() === "x" ? parseInt(n.slice(1), 16) : Number(n); return code <= 0x10ffff && code > 0 ? String.fromCodePoint(code) : ""; });
    function content(nodes: any[]): string { return nodes.map(node => Object.entries(node).map(([key, value]) => key === "#text" ? decode(String(value)) : key === "w:tab" ? "\t" : key === "w:br" ? "\n" : Array.isArray(value) ? content(value) : "").join("")).join(""); }
    function walk(nodes: any[]) { for (const node of nodes) for (const [key, val] of Object.entries(node)) if (Array.isArray(val)) { if (key === "w:p") found.push(content(val)); else walk(val); } }
    walk(tree); value = found.join("\n\n");
  } else value = text(input.bytes);
  if (!value.trim() || value.length > 60000) throw Error("文档为空或超过 60000 字限制。");
  const sections = value.replace(/\r\n?/g, "\n").split(/\n+/).filter(s => s.trim()).map((s, index) => ({ sourceParagraph: index + 1, text: s, heading: /^(#{1,3})\s+/.exec(s)?.[1].length || 0 }));
  if (sections.length > 1000) throw Error("文档超过 1000 个非空段落。");
  return sections;
}
