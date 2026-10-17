#!/usr/bin/env node
/**
 * Differential verifier for the bounded formula engine.
 *
 * It runs the real `table.calculate` executor over a corpus of workbooks and
 * compares every computed cell against a human-reviewed expectation file.
 * The corpus is the only thing that can turn "the engine agrees with itself"
 * into "the engine agrees with a known answer"; missing expectations are
 * reported as uncovered instead of being silently treated as passes.
 *
 * Usage:
 *   node scripts/verify-formula-compat.mjs <corpus-dir> [--report <file.json>]
 *
 * Corpus layout:
 *   <corpus-dir>/*.xlsx          workbooks to recalculate
 *   <corpus-dir>/expected.json   { "version": 1, "workbooks": { "book.xlsx": { "Sheet1!A1": 25.3 } } }
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { pathToFileURL } from 'node:url';

const numericTolerance = 1e-9;

function parseArgs(argv) {
  const positional = [];
  let report = '';
  for (let index = 0; index < argv.length; index++) {
    const value = argv[index];
    if (value === '--report') { report = argv[++index] || ''; continue; }
    if (value.startsWith('--report=')) { report = value.slice('--report='.length); continue; }
    if (value.startsWith('--')) throw Error(`Unknown option: ${value}`);
    positional.push(value);
  }
  if (positional.length !== 1) throw Error('Usage: node scripts/verify-formula-compat.mjs <corpus-dir> [--report <file.json>]');
  return { corpusDir: resolve(positional[0]), reportPath: report ? resolve(report) : '' };
}

function readExpectations(document) {
  if (!document || document.version !== 1 || typeof document.workbooks !== 'object' || !document.workbooks) {
    throw Error('expected.json must use { "version": 1, "workbooks": { "<file>.xlsx": { "<Sheet>!<Cell>": <value> } } }.');
  }
  for (const [file, cells] of Object.entries(document.workbooks)) {
    if (!cells || typeof cells !== 'object' || Array.isArray(cells)) throw Error(`expected.json: ${file} must map cell addresses to values.`);
    for (const [address, value] of Object.entries(cells)) {
      if (!/^[^!]+!\$?[A-Z]{1,3}\$?[1-9]\d*$/i.test(address)) throw Error(`expected.json: ${file} has an invalid cell address: ${address}`);
      if (value !== null && !['number', 'string', 'boolean'].includes(typeof value)) throw Error(`expected.json: ${file} ${address} must be a number, string, boolean or null.`);
    }
  }
  return document.workbooks;
}

function compare(expected, actual) {
  if (expected === null) return actual === null || actual === 0 || actual === '' ? null : `expected blank, got ${JSON.stringify(actual)}`;
  if (typeof expected === 'number') {
    if (typeof actual !== 'number' || !Number.isFinite(actual)) return `expected number ${expected}, got ${JSON.stringify(actual)}`;
    const scale = Math.max(1, Math.abs(expected));
    return Math.abs(expected - actual) <= numericTolerance * scale ? null : `expected ${expected}, got ${actual}`;
  }
  if (typeof expected === 'boolean') return typeof actual === 'boolean' && actual === expected ? null : `expected boolean ${expected}, got ${JSON.stringify(actual)}`;
  return typeof actual === 'string' && actual === expected ? null : `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
}

export async function verifyCorpus({ corpusDir, reportPath = '' }) {
  const { executeSkill } = await import(pathToFileURL(resolve('dist/local/server/skills/executors.js')).href);
  const { readdir } = await import('node:fs/promises');
  const entries = (await readdir(corpusDir, { withFileTypes: true })).filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.xlsx')).map(entry => entry.name).sort();
  if (!entries.length) throw Error('Corpus contains no .xlsx workbook.');
  let expectations = {};
  try { expectations = readExpectations(JSON.parse(await readFile(resolve(corpusDir, 'expected.json'), 'utf8'))); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const workbooks = [];
  for (const file of entries) {
    const bytes = new Uint8Array(await readFile(resolve(corpusDir, file)));
    const expected = expectations[file] || {};
    const record = { file, status: 'ok', checked: 0, passed: 0, failed: 0, uncovered: [], failures: [], error: '' };
    let report;
    try {
      const result = await executeSkill({ skillId: 'table.calculate', filename: file, bytes, deduplicate: false });
      report = JSON.parse(Buffer.from(result.outputs.find(output => output.name === 'formula-report.json').bytes).toString('utf8'));
    } catch (error) {
      record.status = 'error';
      record.error = error instanceof Error ? error.message : String(error);
      workbooks.push(record);
      continue;
    }
    const computed = new Map(report.cells.map(cell => [`${cell.sheet}!${cell.cell}`, cell]));
    for (const [address, value] of Object.entries(expected)) {
      const cell = computed.get(address);
      record.checked++;
      if (!cell) { record.failed++; record.failures.push({ cell: address, expected: value, actual: null, reason: '公式结果中没有这个单元格' }); continue; }
      const problem = compare(value, cell.result);
      if (problem) { record.failed++; record.failures.push({ cell: address, expected: value, actual: cell.result, reason: problem }); continue; }
      record.passed++;
    }
    for (const cell of report.cells) {
      const address = `${cell.sheet}!${cell.cell}`;
      if (!(address in expected)) record.uncovered.push(address);
    }
    record.formulaCount = report.formulaCount;
    workbooks.push(record);
  }
  const summary = {
    tool: 'verify-formula-compat',
    corpusDir,
    workbookCount: workbooks.length,
    checked: workbooks.reduce((total, item) => total + item.checked, 0),
    passed: workbooks.reduce((total, item) => total + item.passed, 0),
    failed: workbooks.reduce((total, item) => total + item.failed, 0),
    uncovered: workbooks.reduce((total, item) => total + item.uncovered.length, 0),
    errored: workbooks.filter(item => item.status === 'error').length,
    workbooks,
    policy: '只比较 expected.json 中人工确认的期望值；缺失期望记为 uncovered（不算通过）；工作簿执行失败记为 error（例如引擎不支持该公式），两者都会让命令以非零码退出，需要人工处理。数值比较允许 1e-9 相对误差，文本逐字符比较。',
  };
  const ok = summary.failed === 0 && summary.errored === 0;
  if (reportPath) await writeFile(reportPath, JSON.stringify(summary, null, 2));
  return { summary, ok };
}

const invokedDirectly = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (invokedDirectly) {
  const options = parseArgs(process.argv.slice(2));
  const { summary, ok } = await verifyCorpus(options);
  for (const item of summary.workbooks) {
    const detail = item.status === 'error' ? `执行失败：${item.error}` : `期望${item.checked}项，通过${item.passed}项，失败${item.failed}项，未覆盖${item.uncovered.length}项`;
    console.log(`${item.status === 'ok' && !item.failed ? '✓' : '✗'} ${item.file} — ${detail}`);
    for (const failure of item.failures) console.log(`    差异 ${failure.cell}：${failure.reason}`);
  }
  console.log(`合计：${summary.workbookCount}个工作簿，期望${summary.checked}项，通过${summary.passed}项，失败${summary.failed}项，未覆盖${summary.uncovered}项，执行失败${summary.errored}个。`);
  console.log(summary.policy);
  process.exit(ok ? 0 : 1);
}
