import ExcelJS from "exceljs";
import type { SkillInput } from "./executors";
import { openOffice } from "./office";
import { validateSkillOptions } from "./contracts";
import { json } from "./io";
type Value = string | number | boolean | Date | null;
type SourceRow = { row: number; cells: Value[] };
function readSheet(sheet: ExcelJS.Worksheet) {
  if (sheet.rowCount < 2 || sheet.rowCount > 5001 || sheet.columnCount < 1 || sheet.columnCount > 50) throw Error(`工作表“${sheet.name}”需要表头和数据，最多5000行、50列。`);
  if (sheet.hasMerges) throw Error(`工作表“${sheet.name}”包含合并单元格，请先取消合并并明确填写每个值。`);
  const headers: string[] = [];
  for (let c = 1; c <= sheet.columnCount; c++) {
    const v = sheet.getCell(1, c).value;
    if (typeof v !== "string" || !v.trim() || v !== v.trim() || v.length > 100 || /[\x00-\x1f\x7f]/.test(v)) throw Error(`工作表“${sheet.name}”的表头必须是1–100字非空文本，且没有首尾空格或控制字符。`);
    headers.push(v);
  }
  if (new Set(headers).size !== headers.length) throw Error(`工作表“${sheet.name}”有重复字段名。`);
  const rows: SourceRow[] = []; let blankRows = 0;
  for (let r = 2; r <= sheet.rowCount; r++) {
    const cells: Value[] = [];
    for (let c = 1; c <= sheet.columnCount; c++) {
      const value = sheet.getCell(r, c).value;
      if (value === null || value === undefined) cells.push(null);
      else if (value instanceof Date && Number.isFinite(value.getTime())) cells.push(new Date(value));
      else if (typeof value === "string" && value.length <= 10000) cells.push(value);
      else if (typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 1e15) cells.push(value);
      else if (typeof value === "boolean") cells.push(value);
      else throw Error(`工作表“${sheet.name}”第${r}行第${c}列不是受支持的普通值；不接受公式、富文本、超长值、链接或错误单元格。`);
    }
    if (cells.every(v => v === null || v === "")) blankRows++; else rows.push({ row: r, cells });
  }
  if (!rows.length) throw Error(`工作表“${sheet.name}”没有非空数据行。`);
  return { sheet: sheet.name, headers, rows, blankRows };
}
function key(value: Value) {
  if (value === null || value === "" || (typeof value === "string" && !value.trim())) return undefined;
  // Do not equate 001 with 1, text "1" with numeric 1, or differently spaced/cased identifiers.
  return value instanceof Date ? "date:"+value.toISOString() : typeof value+":"+String(value);
}
export async function joinTables(input: SkillInput, event: (message: string) => void) {
  const p = validateSkillOptions("table.join", { deduplicate: input.deduplicate, parameters: input.parameters }).parameters!;
  openOffice(input.bytes, "xl/workbook.xml");
  const source = new ExcelJS.Workbook(); await source.xlsx.load(Buffer.from(input.bytes) as any);
  if (source.worksheets.length > 10) throw Error("关联工作簿最多10个工作表；本次只处理指定的两个表。");
  const leftSheet = source.getWorksheet(p.leftSheet), rightSheet = source.getWorksheet(p.rightSheet);
  if (!leftSheet || !rightSheet) throw Error("没有找到指定工作表，请核对工作表名称（区分大小写）。");
  if (leftSheet.id === rightSheet.id) throw Error("请指定两个不同的工作表。");
  if (leftSheet.rowCount * leftSheet.columnCount + rightSheet.rowCount * rightSheet.columnCount > 100000) throw Error("两个来源表合计最多100000个单元格。");
  const left = readSheet(leftSheet), right = readSheet(rightSheet);
  const li = left.headers.indexOf(p.leftKey), ri = right.headers.indexOf(p.rightKey);
  if (li < 0 || ri < 0) throw Error("指定的关联字段不存在，必须与表头完全一致。");
  const index = new Map<string, SourceRow>(); const rightBlank: number[] = [];
  for (const row of right.rows) {
    const id = key(row.cells[ri]); if (id === undefined) { rightBlank.push(row.row); continue; }
    const previous = index.get(id);
    if (previous) throw Error(`右表关联键不唯一（来源行${previous.row}和${row.row}）；已停止，避免一对多展开造成重复计数。请先明确业务口径并整理右表。`);
    index.set(id, row);
  }
  event(`读取“${left.sheet}”${left.rows.length}行和“${right.sheet}”${right.rows.length}行；右表非空键唯一性校验通过。`);
  const workbook = new ExcelJS.Workbook(); workbook.creator = "DesignBuddy exact two-sheet join";
  const joined = workbook.addWorksheet("关联结果"), provenance = workbook.addWorksheet("来源对照");
  const headers = ["左表来源行", "右表来源行", ...left.headers.map(h => "左表."+h), ...right.headers.map(h => "右表."+h)];
  joined.addRow(headers); provenance.addRow(["结果行", "左表", "左表来源行", "右表", "右表来源行", "匹配状态"]);
  const links: { resultRow: number; leftRow: number | null; rightRow: number | null; status: string }[] = [];
  const matchedRight = new Set<number>(), unmatchedLeft: number[] = [], leftBlank: number[] = [];
  const append = (l?: SourceRow, r?: SourceRow) => {
    if ((links.length + 2) * headers.length > 100000 || links.length >= 10000) throw Error("关联结果超过100000单元格或10000行，未交付截断结果。请缩小来源表。");
    const status = l && r ? "matched" : l ? "left_only" : "right_only";
    joined.addRow([l?.row ?? null, r?.row ?? null, ...(l?.cells || left.headers.map(() => null)), ...(r?.cells || right.headers.map(() => null))]);
    const link = { resultRow: joined.rowCount, leftRow: l?.row ?? null, rightRow: r?.row ?? null, status }; links.push(link);
    provenance.addRow([link.resultRow, left.sheet, link.leftRow, right.sheet, link.rightRow, status]);
  };
  for (const row of left.rows) {
    const id = key(row.cells[li]); if (id === undefined) leftBlank.push(row.row);
    const match = id === undefined ? undefined : index.get(id);
    if (match) { matchedRight.add(match.row); append(row, match); }
    else { unmatchedLeft.push(row.row); if (p.joinType !== "inner") append(row); }
  }
  const unmatchedRight = right.rows.filter(row => !matchedRight.has(row.row));
  if (p.joinType === "full") for (const row of unmatchedRight) append(undefined, row);
  for (const sheet of workbook.worksheets) { sheet.getRow(1).font = { bold: true }; sheet.views = [{ state: "frozen", ySplit: 1 }]; sheet.columns.forEach(c => c.width = 22); }
  joined.eachRow(row => row.eachCell(cell => { if (cell.value instanceof Date) cell.numFmt = "yyyy-mm-dd hh:mm:ss"; }));
  const policy = "右表非空键必须唯一；左表可有重复键。键按数据类型和原值精确比较，不自动去空格、不忽略大小写、不把文本与数值互转。空键不互相匹配，完全空行跳过但保留来源行号；隐藏行/列也参与；仅关联两个指定工作表，不计算公式、不推断业务关系。";
  const matched = links.filter(r => r.status === "matched").length;
  event(`完成${p.joinType}关联，输出${links.length}行；匹配${matched}行，左表未匹配${unmatchedLeft.length}行，右表未匹配${unmatchedRight.length}行。未进行业务口径推断。`);
  return { summary: `实际完成双表${({ left: "左连接", inner: "内连接", full: "全外连接" } as Record<string,string>)[p.joinType]}，输出${links.length}行；左表未匹配${unmatchedLeft.length}行、右表未匹配${unmatchedRight.length}行。右表非空键唯一；结果须按业务口径复核。`, outputs: [
    { name: "joined.xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes: new Uint8Array(await workbook.xlsx.writeBuffer()) },
    json("join-report.json", { parameters: p, inputRows: { left: left.rows.length, right: right.rows.length }, skippedBlankRows: { left: left.blankRows, right: right.blankRows }, outputRows: links.length, matchedRows: matched, unmatchedLeftRows: unmatchedLeft, unmatchedRightRows: unmatchedRight.map(r => r.row), emptyKeyRows: { left: leftBlank, right: rightBlank }, columns: headers, provenance: links, policy, requiresReview: true }),
  ] };
}
