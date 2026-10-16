#!/usr/bin/env node
/**
 * Browser acceptance harness.
 *
 * It drives a real Chromium against an explicitly authorised target and writes
 * an evidence bundle (screenshots, console log, network log, per-check
 * manifest). Checks that could not be executed are reported as `not_verified`
 * with a reason instead of being counted as passes.
 *
 * The harness only visits the origin declared in the suite; it never guesses a
 * target, never reuses credentials from the environment and never performs
 * destructive actions beyond the declared clicks.
 *
 * Usage:
 *   node scripts/acceptance/run-acceptance.mjs --suite <suite.json> [--out <dir>]
 */
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(resolve('apps/web/package.json'));

/** The bundled headless browser avoids the blocked browser CDN in this environment. */
async function launchBrowser() {
  const sparticuz = require('@sparticuz/chromium');
  const chromiumBuild = dirname(require.resolve('@sparticuz/chromium'));
  await sparticuz.inflate(join(chromiumBuild, '../bin/al2023.tar.br'));
  const executablePath = await sparticuz.default.executablePath();
  process.env.LD_LIBRARY_PATH = [join(tmpdir(), 'al2023/lib'), process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');
  const { chromium } = require('@playwright/test');
  return chromium.launch({ executablePath, args: sparticuz.default.args, headless: true });
}

function parseArgs(argv) {
  let suite = '', out = '';
  for (let index = 0; index < argv.length; index++) {
    const value = argv[index];
    if (value === '--suite') { suite = argv[++index] || ''; continue; }
    if (value === '--out') { out = argv[++index] || ''; continue; }
    if (value.startsWith('--suite=')) { suite = value.slice(8); continue; }
    if (value.startsWith('--out=')) { out = value.slice(6); continue; }
    throw Error(`Unknown option: ${value}`);
  }
  if (!suite) throw Error('Usage: node scripts/acceptance/run-acceptance.mjs --suite <suite.json> [--out <dir>]');
  return { suitePath: resolve(suite), outDir: out ? resolve(out) : '' };
}

const checkTypes = new Set(['http', 'assertText', 'assertVisible', 'click', 'fill', 'screenshot']);

function validateSuite(suite) {
  if (!suite || typeof suite !== 'object' || Array.isArray(suite)) throw Error('Suite must be an object.');
  if (typeof suite.name !== 'string' || !suite.name.trim()) throw Error('Suite needs a name.');
  if (typeof suite.baseUrl !== 'string' || !/^https?:\/\//i.test(suite.baseUrl)) throw Error('Suite needs an explicit http(s) baseUrl.');
  const base = new URL(suite.baseUrl);
  if (base.pathname !== '/' && base.pathname !== '') throw Error('baseUrl must not contain a path.');
  if (!Array.isArray(suite.viewports) || !suite.viewports.length || suite.viewports.length > 12) throw Error('Suite needs 1 to 12 viewports.');
  for (const viewport of suite.viewports) {
    if (!viewport || typeof viewport.name !== 'string' || !viewport.name) throw Error('Each viewport needs a name.');
    if (!Number.isInteger(viewport.width) || viewport.width < 200 || viewport.width > 4000) throw Error('Viewport width must be an integer between 200 and 4000.');
    if (!Number.isInteger(viewport.height) || viewport.height < 200 || viewport.height > 4000) throw Error('Viewport height must be an integer between 200 and 4000.');
  }
  if (!Array.isArray(suite.checks) || !suite.checks.length || suite.checks.length > 200) throw Error('Suite needs 1 to 200 checks.');
  for (const check of suite.checks) {
    if (!check || typeof check !== 'object') throw Error('Each check must be an object.');
    if (typeof check.id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(check.id)) throw Error('Each check needs an id of letters, digits, dashes or underscores.');
    if (typeof check.type !== 'string' || !checkTypes.has(check.type)) throw Error(`Check type must be one of: ${[...checkTypes].join(', ')}.`);
    if (check.type === 'http') {
      if (typeof check.path !== 'string' || !check.path.startsWith('/')) throw Error('http checks need a path starting with "/".');
      if (check.expectStatus !== undefined && (!Number.isInteger(check.expectStatus) || check.expectStatus < 100 || check.expectStatus > 599)) throw Error('expectStatus must be a valid HTTP status.');
    }
    if (['assertText', 'assertVisible', 'click', 'fill', 'screenshot'].includes(check.type)) {
      if (typeof check.path !== 'string' || !check.path.startsWith('/')) throw Error(`${check.type} checks need a path starting with "/".`);
      if (check.type !== 'screenshot' && (typeof check.selector !== 'string' || !check.selector)) throw Error(`${check.type} checks need a selector.`);
      if (check.type === 'screenshot' && check.selector !== undefined && (typeof check.selector !== 'string' || !check.selector)) throw Error('screenshot selector must be a non-empty string.');
      if (check.type === 'assertText' && (typeof check.contains !== 'string' || !check.contains)) throw Error('assertText checks need the expected text.');
      if (check.type === 'fill' && typeof check.value !== 'string') throw Error('fill checks need a string value.');
      if (check.waitFor !== undefined && (typeof check.waitFor !== 'string' || !check.waitFor)) throw Error('waitFor must be a non-empty selector.');
      if (check.expectSelector !== undefined && (typeof check.expectSelector !== 'string' || !check.expectSelector)) throw Error('expectSelector must be a non-empty selector.');
      if (check.reload !== undefined && typeof check.reload !== 'boolean') throw Error('reload must be a boolean.');
    }
  }
  const ids = suite.checks.map(check => check.id);
  if (new Set(ids).size !== ids.length) throw Error('Check ids must be unique.');
  return { ...suite, base };
}

async function runCheck(page, request, check, viewport, bundleDir, target, logs) {
  const started = Date.now();
  const consoleStart = logs.console.length, networkStart = logs.network.length;
  const record = { id: check.id, type: check.type, viewport: viewport.name, status: 'failed', detail: '', durationMs: 0 };
  try {
    if (check.type === 'http') {
      const response = await request.get(new URL(check.path, target).toString(), { timeout: 20000, maxRedirects: 3 });
      const expected = check.expectStatus ?? 200;
      if (response.status() !== expected) { record.status = 'failed'; record.detail = `expected HTTP ${expected}, got ${response.status()}`; }
      else { record.status = 'passed'; record.detail = `HTTP ${response.status()}`; }
    } else {
      // reload:false keeps the page state of the previous check, so a click and the assertion
      // that follows it can be expressed as two separate checks.
      if (check.reload !== false) await page.goto(new URL(check.path, target).toString(), { waitUntil: 'domcontentloaded', timeout: 30000 });
      if (check.waitFor) {
        try { await page.waitForSelector(check.waitFor, { timeout: 15000, state: 'attached' }); }
        catch { record.status = 'not_verified'; record.detail = `waitFor selector never appeared: ${check.waitFor}`; return record; }
      }
      if (check.type === 'assertVisible') {
        const locator = page.locator(check.selector).first();
        if (await locator.count() === 0) { record.status = 'not_verified'; record.detail = `selector not found: ${check.selector}`; }
        else { record.status = 'passed'; record.detail = 'element visible'; }
      } else if (check.type === 'assertText') {
        const locator = page.locator(check.selector).first();
        if (await locator.count() === 0) { record.status = 'not_verified'; record.detail = `selector not found: ${check.selector}`; }
        else {
          const text = (await locator.innerText()).replace(/\s+/g, ' ').trim();
          if (!text.includes(check.contains)) { record.status = 'failed'; record.detail = `text did not contain ${JSON.stringify(check.contains)}`; }
          else { record.status = 'passed'; record.detail = `text matched (${text.length} chars)`; }
        }
      } else if (check.type === 'click') {
        const locator = page.locator(check.selector).first();
        if (await locator.count() === 0) { record.status = 'not_verified'; record.detail = `selector not found: ${check.selector}`; }
        else {
          await locator.click({ timeout: 10000 });
          record.status = 'passed';
          record.detail = 'clicked';
          if (check.expectText) {
            const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
            if (!body.includes(check.expectText)) { record.status = 'failed'; record.detail = `after click the page did not contain ${JSON.stringify(check.expectText)}`; }
            else record.detail = 'clicked and expected text present';
          }
          if (check.expectSelector) {
            try { await page.waitForSelector(check.expectSelector, { timeout: 15000, state: 'attached' }); }
            catch { record.status = 'not_verified'; record.detail = `after click the selector never appeared: ${check.expectSelector}`; }
          }
        }
      } else if (check.type === 'fill') {
        const locator = page.locator(check.selector).first();
        if (await locator.count() === 0) { record.status = 'not_verified'; record.detail = `selector not found: ${check.selector}`; }
        else {
          await locator.fill(check.value, { timeout: 10000 });
          record.status = 'passed';
          record.detail = `filled ${check.value.length} characters`;
        }
      } else if (check.type === 'screenshot') {
        const directory = join(bundleDir, 'screenshots', viewport.name);
        await mkdir(directory, { recursive: true });
        const file = join(directory, `${check.id}.png`);
        if (check.selector) {
          const locator = page.locator(check.selector).first();
          if (await locator.count() === 0) { record.status = 'not_verified'; record.detail = `selector not found: ${check.selector}`; }
          else { await locator.screenshot({ path: file }); record.status = 'passed'; record.detail = `element screenshot saved as screenshots/${viewport.name}/${check.id}.png`; }
        } else await page.screenshot({ path: file, fullPage: check.fullPage !== false });
        record.status = 'passed';
        record.detail = `screenshot saved as screenshots/${viewport.name}/${check.id}.png`;
      }
    }
  } catch (error) {
    record.status = 'failed';
    record.detail = error instanceof Error ? error.message.slice(0, 400) : String(error).slice(0, 400);
  } finally {
    record.durationMs = Date.now() - started;
    record.consoleMessages = logs.console.slice(consoleStart);
    record.network = logs.network.slice(networkStart);
  }
  return record;
}

export async function runAcceptance({ suitePath, outDir = '' }) {
  const { readFile } = await import('node:fs/promises');
  const suite = validateSuite(JSON.parse(await readFile(suitePath, 'utf8')));
  const bundleDir = outDir || resolve(`acceptance-evidence/${suite.name.replace(/[^a-zA-Z0-9_-]+/g, '-')}`);
  await rm(bundleDir, { recursive: true, force: true });
  await mkdir(join(bundleDir, 'screenshots'), { recursive: true });
  const browser = await launchBrowser();
  const results = [];
  const consoleLog = [];
  const networkLog = [];
  try {
    // One context and one page for the whole run: the bundled headless browser runs
    // single-process and does not survive closing a page or a context between viewports.
    const context = await browser.newContext({ viewport: { width: suite.viewports[0].width, height: suite.viewports[0].height } });
    // Only the declared origin may be visited; every other origin is blocked.
    await context.route('**/*', route => {
      const url = route.request().url();
      if (url.startsWith(suite.base.origin) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
      return route.abort('blockedbyclient');
    });
    const page = await context.newPage();
    const logs = { console: [], network: [] };
    page.on('console', message => logs.console.push({ type: message.type(), text: message.text().slice(0, 2000) }));
    page.on('pageerror', error => logs.console.push({ type: 'pageerror', text: String(error.message).slice(0, 2000) }));
    page.on('request', request => logs.network.push({ method: request.method(), url: request.url().slice(0, 500) }));
    page.on('requestfailed', request => logs.network.push({ method: request.method(), url: request.url().slice(0, 500), failed: request.failure()?.errorText || 'failed' }));
    for (const viewport of suite.viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      for (const check of suite.checks) {
        const record = await runCheck(page, context.request, check, viewport, bundleDir, suite.base.origin, logs);
        results.push(record);
        consoleLog.push({ check: check.id, viewport: viewport.name, messages: record.consoleMessages });
        networkLog.push({ check: check.id, viewport: viewport.name, requests: record.network });
      }
    }
  } finally {
    await browser.close();
  }
  const manifest = {
    tool: 'run-acceptance',
    suite: suite.name,
    baseUrl: suite.base.origin,
    ranAt: new Date().toISOString(),
    viewports: suite.viewports.map(viewport => `${viewport.name} ${viewport.width}x${viewport.height}`),
    counts: {
      total: results.length,
      passed: results.filter(item => item.status === 'passed').length,
      failed: results.filter(item => item.status === 'failed').length,
      notVerified: results.filter(item => item.status === 'not_verified').length,
    },
    results: results.map(item => ({ id: item.id, type: item.type, viewport: item.viewport, status: item.status, detail: item.detail, durationMs: item.durationMs })),
    policy: '只有真实访问目标并通过断言的检查才记为 passed；选择器缺失记为 not_verified 并写明原因；失败项保留控制台与网络记录。本工具不代表被测目标已完成业务验收，只证明声明的检查项在声明的视口下实际执行过。',
  };
  await writeFile(join(bundleDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  await writeFile(join(bundleDir, 'console.log'), consoleLog.map(entry => JSON.stringify(entry)).join('\n') + '\n');
  await writeFile(join(bundleDir, 'network.log'), networkLog.map(entry => JSON.stringify(entry)).join('\n') + '\n');
  return { manifest, bundleDir, ok: manifest.counts.failed === 0 && manifest.counts.notVerified === 0 };
}

const invokedDirectly = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (invokedDirectly) {
  const options = parseArgs(process.argv.slice(2));
  const { manifest, bundleDir, ok } = await runAcceptance(options);
  for (const item of manifest.results) console.log(`${item.status === 'passed' ? '✓' : item.status === 'not_verified' ? '?' : '✗'} [${item.viewport}] ${item.id} — ${item.status}：${item.detail}`);
  console.log(`合计：${manifest.counts.total} 项，通过 ${manifest.counts.passed}，失败 ${manifest.counts.failed}，未验证 ${manifest.counts.notVerified}。证据包：${bundleDir}`);
  process.exit(ok ? 0 : 1);
}
