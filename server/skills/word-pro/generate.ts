import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  TableLayoutType,
  Header,
  Footer,
  AlignmentType,
  PageNumber,
  Bookmark,
  InternalHyperlink,
  ImageRun,
  BorderStyle,
} from "docx";
import {
  type WordDocument,
  wordEngineVersion,
} from "../../../shared/wordDocument";
import { presentationFonts, presentationFont } from "../presentation/fonts";
import { normalizePresentationAssets } from "../presentation/assets";
import { openOffice } from "../office";
import { norm, contentTexts, blockSource, hash } from "./schema";
export const mm = (n: number) => Math.round((n * 1440) / 25.4);
export type WordImage = {
  data: Uint8Array;
  width: number;
  height: number;
  sha256: string;
  originalSHA256: string;
};
export async function prepareImages(
  d: WordDocument,
): Promise<Record<string, WordImage>> {
  const result: Record<string, WordImage> = {};
  for (const b of d.blocks)
    if (b.type === "image") {
      const [a] = await normalizePresentationAssets([
        {
          id: `asset-${b.id}`,
          name: b.filename,
          base64: b.base64,
          role: b.usage === "evidence" ? "screenshot" : "illustration",
          usage: b.usage,
          alt: b.alt,
          source: blockSource(d, b),
          license: b.license,
          permissionConfirmed: true,
        },
      ]);
      result[b.id] = {
        data: Buffer.from(a.data.split(",").pop()!, "base64"),
        width: a.width,
        height: a.height,
        sha256: a.sha256,
        originalSHA256: a.originalSHA256,
      };
    }
  return result;
}
const family = "Noto Sans SC";
const run = (text: string, props: any = {}) =>
  new TextRun({ text, font: family, ...props });
const runs = (text: string, props: any = {}) =>
  text
    .split("\n")
    .flatMap((line, i) => [
      ...(i ? [new TextRun({ break: 1 })] : []),
      run(line, props),
    ]);
export async function generateWord(
  d: WordDocument,
  images: Record<string, WordImage>,
) {
  const f = presentationFonts();
  const glyphText = [
    d.title,
    d.subtitle,
    ...contentTexts(d).map((x) => x.text),
    ...d.sources.flatMap((s) => [s.id, s.name, s.locator, s.text]),
  ].join("");
  const missing = [
    ...new Set(
      [...glyphText].filter(
        (c) =>
          !/\s/.test(c) &&
          (!f.font.hasGlyphForCodePoint(c.codePointAt(0)!) ||
            !f.boldFont.hasGlyphForCodePoint(c.codePointAt(0)!)),
      ),
    ),
  ];
  if (missing.length)
    throw Error(
      `Word字体缺字，未生成可交付稿：${missing.slice(0, 12).join("")}`,
    );
  const primary = d.documentType === "business-report" ? "264B40" : "245786";
  const label = d.documentType === "business-report" ? "商业报告" : "项目方案";
  const p = (text: string, opts: any = {}) =>
    new Paragraph({ children: runs(text), ...opts });
  const caption = (text: string) => p(text, { style: "CaptionText" });
  const cover = [
    p("DESIGNBUDDY  /  WORD PRO", {
      spacing: { before: 1300, after: 400 },
      children: [
        run("DESIGNBUDDY  /  WORD PRO", {
          size: 20,
          color: primary,
          bold: true,
        }),
      ],
    }),
    p(label, {
      children: [run(label, { size: 24, color: primary })],
      spacing: { after: 400 },
    }),
    p(d.title, {
      children: runs(d.title, { size: 64, bold: true, color: primary }),
      spacing: { after: 500 },
    }),
    p(d.subtitle),
    p("草稿 · 需人工复核", { spacing: { before: 800 } }),
    p("原生内容 / 同源预览 / 可追踪检查", { style: "CaptionText" }),
  ];
  const navigation = [
    p("章节导航", { heading: HeadingLevel.HEADING_1, pageBreakBefore: true }),
    p("以下为无页码的原生章节链接，不是已经刷新页码的自动目录。", {
      style: "CaptionText",
    }),
    ...d.blocks
      .filter((b) => b.type === "heading")
      .map(
        (b) =>
          new Paragraph({
            spacing: { after: 140 },
            indent: { left: mm(b.type === "heading" ? (b.level - 1) * 6 : 0) },
            children: [
              new InternalHyperlink({
                anchor: b.id,
                children: [run((b as any).text, { color: primary })],
              }),
            ],
          }),
      ),
  ];
  const body: (Paragraph | Table)[] = [];
  for (const b of d.blocks) {
    if (b.type === "heading")
      body.push(
        new Paragraph({
          heading: [
            HeadingLevel.HEADING_1,
            HeadingLevel.HEADING_2,
            HeadingLevel.HEADING_3,
          ][b.level - 1],
          keepNext: b.keepNext !== false,
          children: [new Bookmark({ id: b.id, children: runs(b.text) })],
        }),
      );
    else if (b.type === "paragraph")
      body.push(p(b.text, { widowControl: true }));
    else if (b.type === "table") {
      body.push(p(b.caption, { style: "CaptionText", keepNext: true }));
      const widths = b.widthsMm || b.headers.map(() => 170 / b.headers.length);
      body.push(
        new Table({
          width: {
            size: mm(widths.reduce((a, v) => a + v, 0)),
            type: WidthType.DXA,
          },
          layout: TableLayoutType.FIXED,
          columnWidths: widths.map(mm),
          rows: [b.headers, ...b.rows].map(
            (row, i) =>
              new TableRow({
                tableHeader: i === 0 && b.repeatHeader !== false,
                cantSplit: false,
                children: row.map(
                  (text, j) =>
                    new TableCell({
                      width: { size: mm(widths[j]), type: WidthType.DXA },
                      shading: {
                        fill: i === 0 ? primary : i % 2 ? "F4F6F4" : "FFFFFF",
                      },
                      margins: { top: 95, bottom: 95, left: 110, right: 110 },
                      children: [
                        new Paragraph({
                          children: runs(text, {
                            size: 20,
                            bold: i === 0,
                            color: i === 0 ? "FFFFFF" : "26312E",
                          }),
                          spacing: { before: 0, after: 40, line: 270 },
                          widowControl: true,
                          keepNext: i < 2,
                        }),
                      ],
                    }),
                ),
              }),
          ),
        }),
      );
      body.push(
        caption(`口径：${b.scope}`),
        caption(`计算：${b.calculation}`),
        caption(`来源：${blockSource(d, b)}`),
      );
    } else {
      const image = images[b.id];
      if (!image) throw Error("缺少规范化图片。");
      const w = b.widthMm || 150,
        h = (w * image.height) / image.width;
      body.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          keepNext: true,
          children: [
            new ImageRun({
              type: "png",
              data: image.data,
              transformation: {
                width: (w * 96) / 25.4,
                height: (h * 96) / 25.4,
              },
              altText: { name: b.id, title: b.caption, description: b.alt },
            }),
          ],
        }),
      );
      body.push(
        p(b.caption, { style: "CaptionText", keepNext: true }),
        p(b.alt, { style: "CaptionText", keepNext: true }),
        p(`许可：${b.license}`, { style: "CaptionText", keepNext: true }),
        caption(
          `来源：${blockSource(d, b)} · ${b.usage === "evidence" ? "证据图完整显示，未核验图内事实" : "AI/概念/装饰用途不证明事实"}`,
        ),
      );
    }
  }
  const appendix = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [
        new Bookmark({
          id: "word-pro-source-appendix",
          children: runs("资料原文附录 / WORD PRO SOURCES"),
        }),
      ],
    }),
    p(
      "来源仅作定位，不代表核验；完整原文及哈希见交付包content-manifest.json。",
      { style: "CaptionText" },
    ),
    ...d.sources.map((s) =>
      p(`[${s.id}] ${s.name} · ${s.locator}`, {
        style: "CaptionText",
        keepLines: true,
        widowControl: true,
      }),
    ),
    caption(
      "DOCX不内嵌字体；接收端需安装Noto Sans SC。LibreOffice渲染不等于Microsoft Word/WPS验收。",
    ),
  ];
  const doc = new Document({
    creator: "DesignBuddy",
    title: d.title,
    description: `${wordEngineVersion}; requires human review`,
    styles: {
      default: {
        document: {
          run: { font: family, size: 22, color: "26312E" },
          paragraph: { spacing: { after: 160, line: 330 } },
        },
      },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: family, size: 36, bold: true, color: primary },
          paragraph: { keepNext: true, spacing: { before: 280, after: 180 } },
        },
        {
          id: "Heading2",
          name: "heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: family, size: 28, bold: true, color: primary },
          paragraph: { keepNext: true, spacing: { before: 220, after: 140 } },
        },
        {
          id: "Heading3",
          name: "heading 3",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: family, size: 24, bold: true, color: primary },
          paragraph: { keepNext: true, spacing: { before: 180, after: 120 } },
        },
        {
          id: "CaptionText",
          name: "Caption text",
          basedOn: "Normal",
          run: { font: family, size: 18, color: "55645D" },
          paragraph: { spacing: { after: 100, line: 260 } },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: mm(210), height: mm(297) },
            margin: {
              top: mm(20),
              bottom: mm(20),
              left: mm(20),
              right: mm(20),
              header: mm(10),
              footer: mm(10),
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              p(`DesignBuddy · ${label}`, {
                children: [
                  run(`DesignBuddy · ${label}`, { size: 16, color: primary }),
                ],
                border: {
                  bottom: {
                    style: BorderStyle.SINGLE,
                    size: 4,
                    color: "CDD6D1",
                  },
                },
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  run("草稿 · ", { size: 16 }),
                  new TextRun({
                    font: family,
                    size: 16,
                    children: [PageNumber.CURRENT],
                  }),
                  run(" / ", { size: 16 }),
                  new TextRun({
                    font: family,
                    size: 16,
                    children: [PageNumber.TOTAL_PAGES],
                  }),
                ],
              }),
            ],
          }),
        },
        children: [...cover, ...navigation, ...body, ...appendix],
      },
    ],
  });
  const bytes = await Packer.toBuffer(doc);
  const entries = openOffice(bytes, "word/document.xml");
  const xml = Buffer.from(entries["word/document.xml"]).toString("utf8");
  const decode = (s: string) =>
    s.replace(
      /&(?:amp|lt|gt|quot|apos);/g,
      (v) =>
        ({
          "&amp;": "&",
          "&lt;": "<",
          "&gt;": ">",
          "&quot;": '"',
          "&apos;": "'",
        })[v]!,
    );
  const bodyStart = xml.indexOf(`w:name="${d.blocks[0].id}"`),
    appendixStart = xml.indexOf('w:name="word-pro-source-appendix"');
  if (bodyStart < 0 || appendixStart <= bodyStart)
    throw Error("DOCX正文边界标记缺失。");
  const bodyXml = xml.slice(bodyStart, appendixStart);
  const all = norm(
    [...bodyXml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
      .map((m) => decode(m[1]))
      .join(""),
  );
  const absent = contentTexts(d).filter((x) => !all.includes(norm(x.text)));
  if (absent.length)
    throw Error(
      `DOCX内容清单不完整：${absent
        .map((x) => x.id)
        .slice(0, 6)
        .join(",")}`,
    );
  return {
    bytes: new Uint8Array(bytes),
    nativeContentVerified: true,
    font: {
      family,
      regularSHA256: presentationFont.sha256,
      boldSHA256: presentationFont.boldSHA256,
      embeddedInDocx: false,
    },
    sha256: hash(bytes),
  };
}
