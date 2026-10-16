import ExcelJS from 'exceljs';
import { createHash } from 'node:crypto';
import type { SkillInput } from './executors';
import { openOffice } from './office';
import { out, json } from './io';
import { parseFormula, evaluateFormula, addressParts, type Scalar } from './formula-engine';
import { validateSkillOptions } from './contracts';

class CalculationError extends Error {}

export async function calculateWorkbook(input: SkillInput, event: (message: string) => void) {
  validateSkillOptions('table.calculate', { deduplicate: input.deduplicate, ...(input.parameters ? { parameters: input.parameters } : {}) });
  const entries = openOffice(input.bytes, 'xl/workbook.xml'); let declared = 0;
  for (const [path, bytes] of Object.entries(entries)) if (/^xl\/worksheets\/[^/]+\.xml$/.test(path)) {
    const content = Buffer.from(bytes).toString('utf8');
    const tags = [...content.matchAll(/<(?:[\w.-]+:)?f(?=[\s/>])[^>]*>/g)]; declared += tags.length;
    for (const tag of tags) { const type = /\bt\s*=\s*["']([^"']+)["']/.exec(tag[0])?.[1]; if (type && !['normal','shared'].includes(type)) throw Error('不支持数组公式或数据表公式，不使用其缓存结果。'); }
  }
  if (declared > 1000) throw Error('公式超过1000个。');
  const book = new ExcelJS.Workbook(); await book.xlsx.load(Buffer.from(input.bytes) as any);
  if (!book.worksheets.length || book.worksheets.length > 10) throw Error('工作簿需有1至10个工作表。');
  const sheets = new Map<string, ExcelJS.Worksheet>();
  const formulas = new Map<string, { sheet: string; address: string; formula: string; parsed: ReturnType<typeof parseFormula> }>();
  const key = (sheet: string, address: string) => JSON.stringify([sheet.toLowerCase(), address]);
  let populated = 0, footprint = 0;
  for (const sheet of book.worksheets) {
    if (sheets.has(sheet.name.toLowerCase())) throw Error('工作表名称存在大小写歧义。');
    sheets.set(sheet.name.toLowerCase(), sheet); footprint += sheet.rowCount * sheet.columnCount;
    if (sheet.rowCount > 2000 || sheet.columnCount > 50 || footprint > 100000 || sheet.hasMerges) throw Error('超过2000行/50列/总计100000单元格范围或包含合并单元格。');
    sheet.eachRow(row => row.eachCell(cell => {
      if (++populated > 10000) throw Error('非空单元格超过10000。');
      const v = cell.value;
      if (v && typeof v === 'object' && ('formula' in v || 'sharedFormula' in v)) {
        if ('shareType' in v && v.shareType === 'array') throw Error('不支持数组公式。');
        if (formulas.size >= 1000) throw Error('公式超过1000个。');
        try { const formula = cell.formula; formulas.set(key(sheet.name, cell.address), { sheet: sheet.name, address: cell.address, formula, parsed: parseFormula(formula, sheet.name) }); }
        catch (error) { throw Error(`${sheet.name}!${cell.address}：${error instanceof Error ? error.message : '公式无法解析'}`); }
      } else if (v !== null && !(typeof v === 'string' && v.length <= 10000) && !(typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e15 && (v === 0 || Math.abs(v) >= 1e-30)) && typeof v !== 'boolean' && !(v instanceof Date && Number.isFinite(v.getTime()))) throw Error(`${sheet.name}!${cell.address}：不支持错误、链接、富文本、超长值或超限数值。`);
    }));
  }
  if (!formulas.size || declared !== formulas.size) throw Error('没有可计算公式或公式读取数量不一致；未将缓存当作重算结果。');
  event(`实际读取${book.worksheets.length}个表、${formulas.size}个公式；忽略全部公式缓存，开始依赖检查和重算。`);
  const results = new Map<string, Scalar>(); const active = new Set<string>(); let operations = 0;
  const tick = () => { if (++operations > 200000) throw Error('计算超过200000步资源限制，未交付部分结果。'); };
  function resolve(sheetName: string, address: string, depth: number): Scalar {
    tick(); if (depth > 64) throw Error('公式依赖链超过64层。');
    const sheet = sheets.get(sheetName.toLowerCase()); if (!sheet) throw Error(`引用的工作表不存在：${sheetName}。`);
    const id = key(sheet.name, address); if (results.has(id)) return results.get(id)!;
    const formula = formulas.get(id); if (!formula) return sheet.getCell(address).value as Scalar;
    if (active.has(id)) throw Error(`循环引用：${sheet.name}!${address}。`);
    active.add(id);
    try {
      const value = evaluateFormula(formula.parsed.tree, ref => {
        const start = addressParts(ref.address), end = addressParts(ref.end || ref.address);
        if (start.row > end.row || start.col > end.col) throw Error('不支持倒序区域，请使用左上角:右下角。');
        const values: Scalar[] = [];
        for (let r = start.row; r <= end.row; r++) for (let c = start.col; c <= end.col; c++) {
          let col = c, name = ''; while (col) { col--; name = String.fromCharCode(65 + col % 26) + name; col = Math.floor(col / 26); }
          values.push(resolve(ref.sheet, name + r, depth + 1));
        }
        return values;
      }, tick);
      results.set(id, value); return value;
    } catch (error) { if (error instanceof CalculationError) throw error; throw new CalculationError(`${sheet.name}!${address}：${error instanceof Error ? error.message : '计算失败'}`.slice(0, 500)); }
    finally { active.delete(id); }
  }
  const cells = [...formulas.values()].map(f => {
    const value = resolve(f.sheet, f.address, 0)!;
    return { sheet: f.sheet, cell: f.address, formula: f.formula, decimalResult: value.toString(), result: Number(value.toString()), dependencies: f.parsed.dependencies, cachedValueUsed: false };
  });
  const output = new ExcelJS.Workbook(); output.creator = 'DesignBuddy bounded formula calculator';
  for (const sheet of book.worksheets) {
    const target = output.addWorksheet(sheet.name);
    // Deliberately output plain values only; do not carry formulas, external links or macros forward.
    sheet.eachRow(row => row.eachCell(cell => {
      const id = key(sheet.name, cell.address), value = results.has(id) ? Number(results.get(id)!.toString()) : cell.value;
      target.getCell(cell.address).value = value as ExcelJS.CellValue;
    }));
    target.getRow(1).font = { bold: true }; target.columns.forEach(c => { c.width = 20; });
  }
  event(`${cells.length}个公式全部实际计算完成；输出为纯值工作簿，原公式和依赖保存在报告，不保留原样式/隐藏状态/图表。`);
  return { summary: `实际重算${cells.length}个受支持公式，覆盖${book.worksheets.length}个表；没有读取缓存结果。交付纯值XLSX及逐单元格报告，不等于完整Excel计算或业务口径验收。`, outputs: [
    out('calculated-values.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', new Uint8Array(await output.xlsx.writeBuffer())),
    json('formula-report.json', { sourceSHA256: createHash('sha256').update(input.bytes).digest('hex'), engine: 'DesignBuddy bounded grammar v1 / decimal.js 40-digit precision', formulaCount: cells.length, operations, cells, requiresReview: true, policy: '仅支持+ - * /、一元正负、百分号、括号、A1/绝对/跨表引用及SUM/AVERAGE/MIN/MAX/COUNT/ROUND/ABS。聚合忽略引用中的文本/布尔/空白，日期拒绝；普通数值运算空白按0，文本/布尔/日期拒绝。ROUND中点远离零。Decimal40位有效数字，非精确有理数/Excel二进制兼容；XLSX数值及JSON result转为双精度近似，decimalResult保留引擎十进制结果。全部缓存忽略；任何不支持或错误均整次失败。不保留格式/隐藏状态/图表/原公式。' }),
  ] };
}
