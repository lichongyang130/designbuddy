import { parsePresentationAssets, normalizePresentationAssets, assetMetadata } from './assets';
import { presentationVisualStyles } from '../../../shared/presentationDesign';
import { createHash } from 'node:crypto';
import ExcelJS from 'exceljs';
import { parse } from 'csv-parse/sync';
import { text } from '../io';
import { paragraphs } from '../source-text';
import { openOffice } from '../office';
import { presentationLimits as L, type PresentationBrief, type PresentationRequest, type PresentationSources, type PresentationDataset } from '../../../shared/presentation';

export const sha256 = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex');
export function object(value: unknown, keys: string[], label: string): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !keys.includes(k))) throw Error(`${label} 格式或字段不受支持。`);
  return value as Record<string, any>;
}
export function safeText(value: unknown, max: number, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) throw Error(`${label} 必须为 1–${max} 字安全文本。`);
  return value.trim();
}
export function parsePresentationRequest(bytes: Uint8Array): PresentationRequest {
  if (!bytes.length || bytes.length > L.envelopeBytes) throw Error('演示请求为空或超过 13.6 MB。');
  let parsed: unknown; try { parsed = JSON.parse(text(bytes)); } catch { throw Error('演示请求必须为 UTF-8 JSON。'); }
  const root = object(parsed, ['schemaVersion', 'brief', 'files', 'assets'], '演示请求');
  if (root.schemaVersion !== 1) throw Error('不支持的演示请求版本。');
  const b = object(root.brief, ['goal', 'audience', 'scenario', 'theme', 'slideCount', 'layoutStyle', 'visualStyle', 'logoAssetId', 'narrativeMode'], '需求');
  if (!['business-report', 'pitch-deck', 'data-analysis'].includes(b.scenario) || !['consulting', 'corporate', 'technology'].includes(b.theme) || !Number.isInteger(b.slideCount) || b.slideCount < 8 || b.slideCount > L.slides) throw Error('请选择支持的场景、主题和 8–25 页。');
  if (b.layoutStyle !== undefined && !['classic', 'adaptive'].includes(b.layoutStyle)) throw Error('输出排版只支持 classic / adaptive。');
  if (b.visualStyle !== undefined && (!presentationVisualStyles.some(s => s.id === b.visualStyle) || b.layoutStyle !== 'adaptive')) throw Error('视觉风格须显式选择adaptive，并采用受支持的风格。');
  if (b.logoAssetId !== undefined && (typeof b.logoAssetId !== 'string' || b.logoAssetId.length > 40)) throw Error('Logo素材ID非法。');
  if(b.narrativeMode!==undefined&&(b.narrativeMode!=='directed'||b.layoutStyle!=='adaptive'))throw Error('内容导演仅支持显式adaptive / directed模式。');
  const brief: PresentationBrief = { goal: safeText(b.goal, 2000, '目标'), audience: safeText(b.audience, 200, '受众'), scenario: b.scenario, theme: b.theme, slideCount: b.slideCount, ...(b.layoutStyle === undefined ? {} : { layoutStyle: b.layoutStyle }), ...(b.visualStyle === undefined ? {} : { visualStyle: b.visualStyle }), ...(b.logoAssetId === undefined ? {} : { logoAssetId: b.logoAssetId }), ...(b.narrativeMode===undefined?{}:{narrativeMode:b.narrativeMode}) };
  if (!Array.isArray(root.files) || root.files.length < 1 || root.files.length > L.files) throw Error('请提供 1–5 份材料；无材料不编造事实。');
  let total = 0; const names = new Set<string>();
  const files = root.files.map((value: unknown) => {
    const f = object(value, ['name', 'base64'], '材料');
    const name = safeText(f.name, 120, '文件名');
    if (/[\x00-\x1f\x7f\\/]/.test(name) || !/\.(txt|md|docx|csv|xlsx)$/i.test(name) || names.has(name.toLowerCase())) throw Error('材料名称须唯一，只支持 TXT/MD/DOCX/CSV/XLSX，不能含路径。');
    names.add(name.toLowerCase());
    if (typeof f.base64 !== 'string' || f.base64.length > 2_666_668 || (f.base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(f.base64))) throw Error('材料编码不合法或超过单文件 2 MB。');
    const decoded = Buffer.from(f.base64, 'base64');
    if (!decoded.length || decoded.length > L.fileBytes || decoded.toString('base64') !== f.base64) throw Error('材料为空、编码不规范或超过 2 MB。');
    total += decoded.length;
    return { name, base64: f.base64 };
  });
  if (total > L.totalBytes) throw Error('材料总量超过 10 MB。');
  const assets = parsePresentationAssets(root.assets, total);
  if (assets.length && b.layoutStyle !== 'adaptive') throw Error('视觉素材仅用于adaptive输出，旧稿不会静默升级。');
  if (brief.logoAssetId && !assets.some(a => a.id === brief.logoAssetId && a.role === 'logo')) throw Error('品牌Logo须绑定本次明确提供的logo素材。');
  return { schemaVersion: 1, brief, files, ...(assets.length ? { assets } : {}) };
}

/** Never evaluate formulas, follow links, silently discard sheets, or truncate source content. */
export async function readPresentationSources(request: PresentationRequest, inputHash: string): Promise<PresentationSources> {
  const result: PresentationSources = { inputHash, files: [], blocks: [], datasets: [], warnings: ['来源引用证明位置存在，不代表 AI 陈述与来源语义一致；商业发布前必须核对事实、权限和结论。'] };
  for (const [index, file] of request.files.entries()) {
    const bytes = Buffer.from(file.base64, 'base64'), id = `source-${index + 1}`;
    result.files.push({ id, name: file.name, bytes: bytes.length, sha256: sha256(bytes) });
    if (/\.(csv|xlsx)$/i.test(file.name)) {
      const sheets: { name: string; rows: string[][] }[] = [];
      if (/\.csv$/i.test(file.name)) {
        const rows: string[][] = parse(text(bytes), { bom: true, skip_empty_lines: true, max_record_size: 100_000, to: 502 });
        sheets.push({ name: 'CSV', rows });
      } else {
        openOffice(bytes, 'xl/workbook.xml');
        const wb = new ExcelJS.Workbook(); await wb.xlsx.load(bytes as any);
        if (!wb.worksheets.length || wb.worksheets.length > 3) throw Error(`${file.name} 须含 1–3 个工作表；请拆分材料而非静默忽略工作表。`);
        for (const sheet of wb.worksheets) {
          if (sheet.state !== 'visible') throw Error(`${file.name} 含隐藏工作表；请先明确授权可见材料。`);
          if (sheet.rowCount > 501 || sheet.columnCount > 20) throw Error(`${file.name}/${sheet.name} 超过 500 行、20 列；请提供演示所需的明细切片。`);
          if (sheet.model.merges?.length) throw Error(`${file.name}/${sheet.name} 含合并单元格，请先整理为普通数据表。`);
          const rows: string[][] = [];
          for (let r = 1; r <= sheet.rowCount; r++) {
            const row: string[] = [];
            for (let c = 1; c <= sheet.columnCount; c++) {
              const v = sheet.getCell(r, c).value;
              if (v && typeof v === 'object' && !(v instanceof Date)) throw Error(`${file.name}/${sheet.name}!R${r}C${c} 包含公式、富文本、错误或链接；不执行公式，也不信任缓存结果。`);
              row.push(v instanceof Date ? v.toISOString() : String(v ?? ''));
            }
            rows.push(row);
          }
          sheets.push({ name: sheet.name, rows });
        }
      }
      for (const [sheetIndex, sheet] of sheets.entries()) {
        const [headers, ...body] = sheet.rows;
        if (!headers?.length || !body.length || body.length > 500 || headers.length > 20 || headers.some(h => !h.trim() || h.length > 60) || new Set(headers).size !== headers.length || body.some(r => r.length !== headers.length || r.some(v => v.length > 500))) throw Error(`${file.name}/${sheet.name} 需要唯一非空表头和 1–500 行一致的数据（≤20列、单元格≤500字）。`);
        const dataset: PresentationDataset = { id: `${id}-table-${sheetIndex + 1}`, sourceId: id, sheet: sheet.name, headers, rows: body.map((values, r) => ({ row: r + 2, values })) };
        result.datasets.push(dataset);
        result.blocks.push({ id: dataset.id, sourceId: id, locator: `${sheet.name}:R1–R${body.length + 1}（CSV为跳过空行后的记录序号）`, text: JSON.stringify({ headers, rows: dataset.rows }) });
      }
    } else {
      if (/\.docx$/i.test(file.name)) result.warnings.push(`${id}: DOCX 按正文段落/表格内段落提取；段落号是提取序号，不是 Word 页码。页眉、页脚、图片和批注不作为事实来源。`);
      paragraphs({ filename: file.name, bytes }).forEach(p => result.blocks.push({ id: `${id}-p-${p.sourceParagraph}`, sourceId: id, locator: `非空段落 ${p.sourceParagraph}`, text: p.text }));
    }
  }
  if (request.assets?.length) {
    result.assets = await normalizePresentationAssets(request.assets);
    for (const a of result.assets) result.blocks.push({ id: a.id, sourceId: a.id, locator: '规范化完整栅格；未OCR、未读取图内事实', text: JSON.stringify({ ...assetMetadata(a), interpretation: '用户声明说明和使用权限，不是独立事实核验；不推断图片内数据。' }) });
    result.warnings.push('视觉素材仅传递元数据给文字规划模型；不发送图片像素，不隐式OCR。来源和许可为用户声明，仍需复核。截图/证据素材必须完整显示。');
  }
  const sourceCharacters = result.blocks.reduce((n, b) => n + b.text.length, 0);
  if (sourceCharacters > L.sourceCharacters || result.blocks.length > 1200) throw Error('材料提取后超过 40000 字或 1200 个段落；请提供精简材料，不会截断后假称已读全文。');
  if (!sourceCharacters) throw Error('材料没有可读取的文字或表格。');
  return result;
}
