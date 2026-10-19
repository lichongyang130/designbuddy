import { createHash } from "node:crypto";
import {
  wordSections,
  type WordDocument,
  type WordBlock,
} from "../../../shared/wordDocument";
export const hash = (v: string | Uint8Array) =>
  createHash("sha256").update(v).digest("hex");
export const norm = (v: string) => v.replace(/\s|\u200b|\ufeff/g, "");
function obj(v: any, keys: string[], label: string) {
  if (
    !v ||
    typeof v !== "object" ||
    Array.isArray(v) ||
    Object.keys(v).some((k) => !keys.includes(k))
  )
    throw Error(`${label}含未知字段或格式错误。`);
  return v;
}
function str(v: any, max: number, label: string) {
  if (
    typeof v !== "string" ||
    !v.trim() ||
    v.length > max ||
    /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v)
  )
    throw Error(`${label}缺失、过长或包含控制字符。`);
  return v;
}
const id = (v: any) => {
  if (typeof v !== "string" || !/^[a-z][a-z0-9-]{0,63}$/.test(v))
    throw Error("节点/来源ID不合法。");
  return v;
};
export function parseWord(bytes: Uint8Array): WordDocument {
  if (!bytes.length || bytes.length > 2_000_000)
    throw Error("Word请求须为非空JSON，≤2MB。");
  let d: any;
  try {
    d = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw Error("Word请求必须为UTF-8 JSON。");
  }
  obj(
    d,
    ["schemaVersion", "documentType", "title", "subtitle", "sources", "blocks"],
    "Word请求",
  );
  if (d.schemaVersion !== 1 || !Object.hasOwn(wordSections, d.documentType))
    throw Error("只支持V1商业报告或项目方案。");
  str(d.title, 100, "标题");
  if (
    typeof d.subtitle !== "string" ||
    d.subtitle.length > 200 ||
    /[\x00-\x1f\x7f]/.test(d.subtitle)
  )
    throw Error("副标题不合法。");
  if (
    !Array.isArray(d.sources) ||
    d.sources.length < 1 ||
    d.sources.length > 30
  )
    throw Error("需要1–30项来源。");
  const sources = new Set<string>();
  for (const s of d.sources) {
    obj(s, ["id", "name", "locator", "text"], "来源");
    id(s.id);
    if (sources.has(s.id)) throw Error("来源ID重复。");
    sources.add(s.id);
    str(s.name, 120, "来源名");
    str(s.locator, 240, "来源位置");
    str(s.text, 20_000, "来源正文");
  }
  if (!Array.isArray(d.blocks) || d.blocks.length < 3 || d.blocks.length > 250)
    throw Error("文档需要3–250个节点。");
  const ids = new Set<string>(),
    roles = new Set<string>();
  let previousLevel = 0,
    cells = 0,
    images = 0;
  for (const b of d.blocks) {
    const fields: Record<string, string[]> = {
      heading: ["text", "level", "role", "keepNext"],
      paragraph: ["text"],
      table: [
        "caption",
        "headers",
        "rows",
        "scope",
        "calculation",
        "widthsMm",
        "repeatHeader",
      ],
      image: [
        "caption",
        "alt",
        "base64",
        "filename",
        "license",
        "permissionConfirmed",
        "usage",
        "widthMm",
      ],
    };
    if (!b || !Object.hasOwn(fields, b.type)) throw Error("节点类型不支持。");
    obj(b, ["id", "refs", "type", ...fields[b.type]], "节点");
    id(b.id);
    if (ids.has(b.id)) throw Error("节点ID重复。");
    ids.add(b.id);
    if (
      !Array.isArray(b.refs) ||
      !b.refs.length ||
      b.refs.length > 8 ||
      new Set(b.refs).size !== b.refs.length ||
      b.refs.some((r: any) => !sources.has(r))
    )
      throw Error("节点来源缺失或不存在。");
    if (b.type === "heading") {
      str(b.text, 100, "章节标题");
      if (![1, 2, 3].includes(b.level) || b.level > previousLevel + 1)
        throw Error("标题层级跳跃或非法。");
      previousLevel = b.level;
      if (b.keepNext !== undefined && typeof b.keepNext !== "boolean")
        throw Error("标题保护参数非法。");
      if (b.role !== undefined) {
        if (
          b.level !== 1 ||
          !wordSections[d.documentType as keyof typeof wordSections].some(
            (s) => s.role === b.role,
          ) ||
          roles.has(b.role)
        )
          throw Error("章节角色不支持或重复。");
        roles.add(b.role);
      }
    } else if (b.type === "paragraph") str(b.text, 4000, "段落");
    else if (b.type === "table") {
      str(b.caption, 120, "表题");
      str(b.scope, 500, "表格口径");
      str(b.calculation, 500, "计算说明");
      if (
        !Array.isArray(b.headers) ||
        b.headers.length < 2 ||
        b.headers.length > 8 ||
        new Set(b.headers).size !== b.headers.length
      )
        throw Error("表格需要2–8个唯一表头。");
      b.headers.forEach((v: any) => str(v, 80, "字段含义/单位"));
      if (!Array.isArray(b.rows) || !b.rows.length || b.rows.length > 100)
        throw Error("表格需要1–100行。");
      for (const row of b.rows) {
        if (!Array.isArray(row) || row.length !== b.headers.length)
          throw Error("表格行列不一致。");
        row.forEach((v: any) => str(v, 500, "单元格"));
        cells += row.length;
      }
      if (cells > 2000) throw Error("文档表格合计超过2000格。");
      if (
        b.widthsMm !== undefined &&
        (!Array.isArray(b.widthsMm) ||
          b.widthsMm.length !== b.headers.length ||
          b.widthsMm.some(
            (v: any) =>
              typeof v !== "number" || !Number.isFinite(v) || v < 12 || v > 240,
          ))
      )
        throw Error("列宽须为12–240mm且对应每个字段。");
      if (b.repeatHeader !== undefined && typeof b.repeatHeader !== "boolean")
        throw Error("重复表头参数非法。");
    } else {
      if (++images > 4) throw Error("最多4张图片。");
      str(b.caption, 120, "图题");
      str(b.alt, 120, "图片说明");
      str(b.license, 200, "使用许可");
      if (
        b.permissionConfirmed !== true ||
        !["evidence", "decorative"].includes(b.usage) ||
        typeof b.filename !== "string" ||
        !/^[-\w.\u4e00-\u9fff ]{1,100}\.(png|jpe?g|webp)$/i.test(b.filename)
      )
        throw Error("图片需合法文件名、用途及使用权限。");
      if (
        typeof b.base64 !== "string" ||
        b.base64.length > 1_400_000 ||
        b.base64.length % 4 ||
        !/^[A-Za-z0-9+/]*={0,2}$/.test(b.base64) ||
        Buffer.from(b.base64, "base64").toString("base64") !== b.base64
      )
        throw Error("图片编码无效或超过1MB。");
      if (
        b.widthMm !== undefined &&
        (typeof b.widthMm !== "number" ||
          !Number.isFinite(b.widthMm) ||
          b.widthMm < 20 ||
          b.widthMm > 240)
      )
        throw Error("图片宽度须为20–240mm。");
    }
  }
  if (d.blocks[0].type !== "heading") throw Error("文档正文须从一级章节开始。");
  if (d.blocks.some((b: any) => b.id.startsWith("word-pro-")))
    throw Error("word-pro-为系统保留节点前缀。");
  const expected = wordSections[
    d.documentType as keyof typeof wordSections
  ].map((s) => s.role);
  if (expected.some((r) => !roles.has(r)))
    throw Error(`文档缺少必需章节：${expected.join("、")}。`);
  const roleOrder = d.blocks
    .filter((b: any) => b.type === "heading" && b.role)
    .map((b: any) => b.role);
  if (roleOrder.join("|") !== expected.join("|"))
    throw Error("必需章节顺序不符合文档类型。");
  for (let i = 0; i < d.blocks.length; i++)
    if (
      d.blocks[i].type === "heading" &&
      (!d.blocks[i + 1] || d.blocks[i + 1].type === "heading")
    )
      throw Error("章节必须有实质正文，不用连续标题替代内容。");
  const chars =
    d.sources.reduce((n: number, s: any) => n + s.text.length, 0) +
    contentTexts(d).reduce((n, s) => n + s.text.length, 0);
  if (chars > 50_000) throw Error("来源与内容合计超过50000字。");
  return d;
}
export function contentTexts(d: WordDocument) {
  return d.blocks.flatMap((b) =>
    b.type === "heading" || b.type === "paragraph"
      ? [{ id: b.id, text: b.text }]
      : b.type === "table"
        ? [
            { id: b.id + "-caption", text: b.caption },
            ...b.headers.map((text, i) => ({ id: `${b.id}-h${i}`, text })),
            ...b.rows.flatMap((r, ri) =>
              r.map((text, ci) => ({ id: `${b.id}-r${ri}c${ci}`, text })),
            ),
            { id: b.id + "-scope", text: b.scope },
            { id: b.id + "-calculation", text: b.calculation },
          ]
        : [
            { id: b.id + "-caption", text: b.caption },
            { id: b.id + "-alt", text: b.alt },
            { id: b.id + "-license", text: b.license },
          ],
  );
}
export function contentHash(d: WordDocument) {
  return hash(
    JSON.stringify({
      title: d.title,
      subtitle: d.subtitle,
      documentType: d.documentType,
      sources: d.sources,
      blocks: d.blocks.map((b) => {
        const { ...x } = b;
        delete (x as any).widthsMm;
        delete (x as any).repeatHeader;
        delete (x as any).keepNext;
        delete (x as any).widthMm;
        return x;
      }),
    }),
  );
}
export const blockSource = (d: WordDocument, b: WordBlock) =>
  b.refs
    .map((r) => {
      const s = d.sources.find((s) => s.id === r)!;
      return `[${s.id}] ${s.name} · ${s.locator}`;
    })
    .join("；");
