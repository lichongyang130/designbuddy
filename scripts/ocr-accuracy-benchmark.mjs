#!/usr/bin/env node
/**
 * Local-only OCR benchmark against a human-reviewed, page-level reference set.
 * No network calls are made. The report intentionally excludes source and OCR text.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const normalize = text => text.normalize('NFC').replace(/\s+/gu, ' ').trim();

export function editDistance(left, right) {
  const a = Array.from(left), b = Array.from(right);
  if (a.length < b.length) return editDistance(right, left);
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length];
}

function validateManifest(manifest) {
  if (!manifest || manifest.version !== 1 || manifest.referenceStatus !== 'human-reviewed' || !Array.isArray(manifest.documents) || !manifest.documents.length) {
    throw Error('Manifest must use version 1, referenceStatus "human-reviewed", and contain documents.');
  }
  const names = new Set();
  for (const doc of manifest.documents) {
    if (typeof doc.file !== 'string' || !doc.file || names.has(doc.file) || !/^[a-f\d]{64}$/i.test(doc.sha256 || '') || !Array.isArray(doc.pages) || !doc.pages.length) throw Error('Each document needs a unique file, SHA-256, and page references.');
    names.add(doc.file);
    const pages = new Set();
    for (const page of doc.pages) {
      if (!Number.isInteger(page.page) || page.page < 1 || page.page > 6 || pages.has(page.page) || typeof page.referenceText !== 'string' || !normalize(page.referenceText)) throw Error(`${doc.file}: page references must have unique page numbers 1–6 and non-empty human-reviewed referenceText.`);
      pages.add(page.page);
    }
  }
}

async function run(manifestPath, reportPath) {
  const manifestAbsolute = resolve(manifestPath);
  const manifest = JSON.parse(await readFile(manifestAbsolute, 'utf8'));
  validateManifest(manifest);
  // The production executor is compiled into dist by the documented command.
  const { executeSkill } = await import(pathToFileURL(resolve('dist/local/server/skills/executors.js')).href);
  const results = [];
  let totalErrors = 0, totalReferenceCharacters = 0, exactPages = 0;

  for (const doc of manifest.documents) {
    const filePath = resolve(dirname(manifestAbsolute), doc.file);
    const pdf = new Uint8Array(await readFile(filePath));
    if (pdf.length > 2_000_000) throw Error(`${doc.file}: PDF exceeds the OCR skill's 2 MB limit.`);
    const actualHash = sha256(pdf);
    if (actualHash !== doc.sha256.toLowerCase()) throw Error(`${doc.file}: SHA-256 differs from the reviewed manifest; refusing to score a changed source.`);
    const result = await executeSkill({ skillId: 'pdf.ocr', filename: doc.file, bytes: pdf, deduplicate: false });
    const evidenceArtifact = result.outputs.find(item => item.name === 'pdf-ocr-evidence.json');
    if (!evidenceArtifact) throw Error(`${doc.file}: OCR executor did not return page evidence.`);
    const evidence = JSON.parse(Buffer.from(evidenceArtifact.bytes).toString('utf8'));
    if (evidence.sourceSHA256 !== actualHash) throw Error(`${doc.file}: OCR evidence source hash mismatch.`);
    const documentPages = [];
    for (const reference of doc.pages) {
      const prediction = evidence.pages.find(page => page.page === reference.page);
      if (!prediction || typeof prediction.text !== 'string') throw Error(`${doc.file}: no OCR output for referenced page ${reference.page}.`);
      const expected = normalize(reference.referenceText), actual = normalize(prediction.text);
      if (Array.from(expected).length > 60000 || Array.from(actual).length > 60000) throw Error(`${doc.file} page ${reference.page}: text exceeds benchmark safety limit.`);
      const errors = editDistance(expected, actual), characters = Array.from(expected).length;
      totalErrors += errors; totalReferenceCharacters += characters;
      if (errors === 0) exactPages++;
      documentPages.push({ page: reference.page, referenceCharacters: characters, editErrors: errors, cer: errors / characters, exact: errors === 0, ocrTextSHA256: sha256(actual), tesseractConfidence: prediction.confidence });
    }
    results.push({ file: doc.file, sourceSHA256: actualHash, engine: evidence.engine, renderer: evidence.renderer, language: evidence.language, modelHashes: evidence.modelHashes, scoredPages: documentPages.length, pages: documentPages });
  }

  const scoredPages = results.reduce((sum, doc) => sum + doc.scoredPages, 0);
  const report = {
    benchmarkVersion: 1,
    generatedAt: new Date().toISOString(),
    referenceStatus: 'human-reviewed (as declared by manifest; not independently audited)',
    normalization: 'Unicode NFC; collapse all whitespace to one ASCII space; trim; retain punctuation, case, and symbols.',
    metric: 'Character error rate (CER) = Unicode code-point Levenshtein edits / reference code points; micro-averaged across scored pages.',
    scores: { scoredDocuments: results.length, scoredPages, exactPages, pageExactRate: exactPages / scoredPages, totalCharacterEdits: totalErrors, referenceCharacters: totalReferenceCharacters, microCER: totalErrors / totalReferenceCharacters },
    limitations: ['This score applies only to the exact, hash-locked documents and manually reviewed pages in the supplied manifest.', 'It does not establish representative business accuracy without a sufficiently large, stratified, independently reviewed corpus.', 'Tesseract confidence is reported as diagnostic data and is not an accuracy score.', 'The OCR skill may reject inputs outside its 2 MB and 6-page limits.'],
    documents: results,
  };
  const serialized = JSON.stringify(report, null, 2) + '\n';
  if (reportPath) await writeFile(resolve(reportPath), serialized, { flag: 'wx' });
  else process.stdout.write(serialized);
  if (reportPath) process.stdout.write(`Local benchmark report written to ${resolve(reportPath)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [manifest, report] = process.argv.slice(2);
  if (!manifest) {
    console.error('Usage: node scripts/ocr-accuracy-benchmark.mjs <human-reviewed-manifest.json> [new-report.json]');
    process.exitCode = 2;
  } else {
    run(manifest, report).catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
  }
}
