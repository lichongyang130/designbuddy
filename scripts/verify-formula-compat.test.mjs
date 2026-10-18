import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { verifyCorpus } from './verify-formula-compat.mjs';

async function workbook(formulas, values = {}) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Sheet1');
  for (const [address, value] of Object.entries(values)) sheet.getCell(address).value = value;
  formulas.forEach((formula, index) => { sheet.getCell(`A${index + 1}`).value = { formula, result: 999 }; });
  return Buffer.from(await book.xlsx.writeBuffer());
}

test('formula compatibility corpus reports matches, mismatches, uncovered cells and unsupported workbooks', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'formula-corpus-'));
  try {
    await writeFile(join(dir, 'good.xlsx'), await workbook(['B1*2', 'SUM(B1:B2)'], { B1: 21, B2: 9 }));
    await writeFile(join(dir, 'bad.xlsx'), await workbook(['B1*2'], { B1: 21 }));
    await writeFile(join(dir, 'unsupported.xlsx'), await workbook(['SUM(A:A)']));
    await writeFile(join(dir, 'expected.json'), JSON.stringify({
      version: 1,
      workbooks: { 'good.xlsx': { 'Sheet1!A1': 42, 'Sheet1!A2': 30 }, 'bad.xlsx': { 'Sheet1!A1': 43 } },
    }));

    const { summary, ok } = await verifyCorpus({ corpusDir: dir });
    assert.equal(ok, false);
    assert.equal(summary.workbookCount, 3);
    assert.equal(summary.checked, 3);
    assert.equal(summary.passed, 2);
    assert.equal(summary.failed, 1);
    assert.equal(summary.errored, 1);

    const good = summary.workbooks.find(item => item.file === 'good.xlsx');
    assert.equal(good.status, 'ok');
    assert.equal(good.failed, 0);
    assert.deepEqual(good.uncovered, []);

    const bad = summary.workbooks.find(item => item.file === 'bad.xlsx');
    assert.equal(bad.failed, 1);
    assert.match(bad.failures[0].reason, /expected 43, got 42/);

    const unsupported = summary.workbooks.find(item => item.file === 'unsupported.xlsx');
    assert.equal(unsupported.status, 'error');
    assert.ok(unsupported.error.length > 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a corpus without expectations is reported as uncovered instead of silently passing', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'formula-corpus-empty-'));
  try {
    await writeFile(join(dir, 'only.xlsx'), await workbook(['1+1']));
    const { summary, ok } = await verifyCorpus({ corpusDir: dir });
    assert.equal(summary.checked, 0);
    assert.equal(summary.uncovered, 1);
    assert.equal(ok, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
