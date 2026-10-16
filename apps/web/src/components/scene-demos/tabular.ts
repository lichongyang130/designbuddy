import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { escapeXML, parseCsv, saveBlob } from "./files";
export async function readTable(file: File): Promise<string[][]> {
  if (file.size > 2_000_000) throw new Error("表格文件不能超过 2 MB。");
  if (file.name.toLowerCase().endsWith(".csv"))
    return parseCsv(await file.text());
  if (!file.name.toLowerCase().endsWith(".xlsx"))
    throw new Error("仅支持 CSV 和 XLSX 文件。");
  let size = 0;
  const archive = unzipSync(new Uint8Array(await file.arrayBuffer()), {
    filter: (entry) => {
      size += entry.originalSize;
      if (size > 10_000_000) throw new Error("解压后表格过大，最多 10 MB。");
      return /^xl\/(worksheets\/sheet\d+\.xml|sharedStrings\.xml)$/.test(
        entry.name,
      );
    },
  });
  const parser = new DOMParser();
  const parse = (text: string) => {
    if (/<!DOCTYPE|<!ENTITY/i.test(text))
      throw new Error("不支持包含实体声明的文件。");
    const doc = parser.parseFromString(text, "application/xml");
    if (doc.querySelector("parsererror"))
      throw new Error("表格 XML 格式损坏。");
    return doc;
  };
  const shared = archive["xl/sharedStrings.xml"]
    ? [
        ...parse(strFromU8(archive["xl/sharedStrings.xml"])).querySelectorAll(
          "si",
        ),
      ].map((n) =>
        [...n.querySelectorAll("t")].map((t) => t.textContent || "").join(""),
      )
    : [];
  const first = Object.keys(archive)
    .filter((n) => n.startsWith("xl/worksheets/"))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))[0];
  if (!first) throw new Error("未找到工作表。");
  const rows = [
    ...parse(strFromU8(archive[first])).querySelectorAll("sheetData > row"),
  ];
  if (rows.length > 1001) throw new Error("最多导入 1000 条数据。");
  return rows
    .map((row) => {
      const values: string[] = [];
      for (const c of row.querySelectorAll("c")) {
        const letters =
          (c.getAttribute("r") || "").match(/^[A-Z]+/)?.[0] || "A";
        const index =
          [...letters].reduce((n, l) => n * 26 + l.charCodeAt(0) - 64, 0) - 1;
        if (index > 50) throw new Error("最多支持 51 列。");
        if (c.querySelector("f"))
          throw new Error("请先将公式转换为数值再导入，避免使用过期缓存结果。");
        const v = c.querySelector("v")?.textContent || "";
        values[index] =
          c.getAttribute("t") === "s"
            ? shared[Number(v)] || ""
            : c.getAttribute("t") === "inlineStr"
              ? [...c.querySelectorAll("t")]
                  .map((t) => t.textContent || "")
                  .join("")
              : v;
      }
      return Array.from({ length: values.length }, (_, i) => values[i] || "");
    })
    .filter((r) => r.some((v) => v.trim()));
}
export function exportXlsx(
  rows: (string | number)[][],
  name = "sales-data.xlsx",
) {
  const col = (index: number) => {
    let n = index + 1,
      s = "";
    while (n) {
      n--;
      s = String.fromCharCode(65 + (n % 26)) + s;
      n = Math.floor(n / 26);
    }
    return s;
  };
  const files = {
    "[Content_Types].xml":
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    "_rels/.rels":
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    "xl/workbook.xml":
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sales" sheetId="1" r:id="rId1"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels":
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    "xl/worksheets/sheet1.xml": `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((r, i) => `<row r="${i + 1}">${r.map((c, j) => (typeof c === "number" && Number.isFinite(c) ? `<c r="${col(j)}${i + 1}"><v>${c}</v></c>` : `<c r="${col(j)}${i + 1}" t="inlineStr"><is><t xml:space="preserve">${escapeXML(c)}</t></is></c>`)).join("")}</row>`).join("")}</sheetData></worksheet>`,
  };
  saveBlob(
    name,
    new Blob(
      [
        zipSync(
          Object.fromEntries(
            Object.entries(files).map(([k, v]) => [k, strToU8(v)]),
          ),
        ) as BlobPart,
      ],
      {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    ),
  );
}
