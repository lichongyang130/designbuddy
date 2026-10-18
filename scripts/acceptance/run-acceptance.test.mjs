import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import http from 'node:http';
import { runAcceptance } from './run-acceptance.mjs';

const page = `<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>验收样例</title></head>
<body><main><h1>验收样例页面</h1><p id="marker">准备就绪</p>
<button id="go" onclick="document.getElementById('marker').textContent='已完成'">开始</button></main></body></html>`;

test('acceptance harness executes real browser checks and refuses to count missing selectors as passes', async () => {
  const server = http.createServer((request, response) => {
    if (request.url === '/missing') { response.writeHead(404, { 'content-type': 'text/html' }).end('<h1>404</h1>'); return; }
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(page);
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const port = server.address().port;
  const dir = await mkdtemp(join(tmpdir(), 'acceptance-'));
  try {
    const suitePath = join(dir, 'suite.json');
    await writeFile(suitePath, JSON.stringify({
      name: 'sample',
      baseUrl: `http://127.0.0.1:${port}`,
      viewports: [{ name: 'desktop', width: 1280, height: 800 }],
      checks: [
        { id: 'home-ok', type: 'http', path: '/', expectStatus: 200 },
        { id: 'home-missing-status', type: 'http', path: '/missing', expectStatus: 404 },
        { id: 'title-text', type: 'assertText', path: '/', selector: 'h1', contains: '验收样例' },
        { id: 'click-flow', type: 'click', path: '/', selector: '#go', expectText: '已完成' },
        { id: 'shot', type: 'screenshot', path: '/' },
        { id: 'absent-selector', type: 'assertVisible', path: '/', selector: '#nope' },
        { id: 'script-run', type: 'evaluate', path: '/', script: "async () => { return { status: 200, text: document.title }; }", expectStatus: 200, expectText: '验收样例' },
      ],
    }));
    const { manifest, bundleDir, ok } = await runAcceptance({ suitePath, outDir: join(dir, 'evidence') });
    assert.equal(manifest.counts.total, 7);
    assert.equal(manifest.counts.passed, 6);
    assert.equal(manifest.counts.notVerified, 1);
    assert.equal(manifest.counts.failed, 0);
    assert.equal(ok, false, 'a not_verified check must not be reported as a clean run');
    const absent = manifest.results.find(item => item.id === 'absent-selector');
    assert.equal(absent.status, 'not_verified');
    assert.match(absent.detail, /selector not found/);

    const saved = JSON.parse(await readFile(join(bundleDir, 'manifest.json'), 'utf8'));
    assert.equal(saved.counts.notVerified, 1);
    assert.ok((await readdir(join(bundleDir, 'screenshots', 'desktop'))).includes('shot.png'));
    assert.ok((await readFile(join(bundleDir, 'console.log'), 'utf8')).length > 0);
    assert.ok((await readFile(join(bundleDir, 'network.log'), 'utf8')).includes('/'));
  } finally {
    server.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test('acceptance harness rejects suites without an explicit target or with malformed checks', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'acceptance-invalid-'));
  try {
    const write = async (suite) => { const path = join(dir, 'suite.json'); await writeFile(path, JSON.stringify(suite)); return path; };
    const base = { name: 'bad', baseUrl: 'http://127.0.0.1:1', viewports: [{ name: 'd', width: 1280, height: 800 }], checks: [{ id: 'a', type: 'http', path: '/' }] };
    await assert.rejects(async () => runAcceptance({ suitePath: await write({ ...base, baseUrl: 'not-a-url' }) }), /baseUrl/);
    await assert.rejects(async () => runAcceptance({ suitePath: await write({ ...base, checks: [{ id: 'a', type: 'teleport', path: '/' }] }) }), /Check type/);
    await assert.rejects(async () => runAcceptance({ suitePath: await write({ ...base, checks: [{ id: 'a', type: 'assertText', path: '/' }] }) }), /selector/);
    await assert.rejects(async () => runAcceptance({ suitePath: await write({ ...base, checks: [{ id: 'a', type: 'evaluate', path: '/' }] }) }), /script/);
    await assert.rejects(async () => runAcceptance({ suitePath: await write({ ...base, viewports: [{ name: 'd', width: 10, height: 800 }] }) }), /width/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
