// Run against an EXTRACTED, compiled package. Never against an existing deployment:
// all runtime state lives in a fresh temporary directory.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { request } from 'node:http';
import { mkdtempSync, mkdirSync, symlinkSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
const root = process.cwd();
const temp = mkdtempSync(join(tmpdir(), 'designbuddy-package-smoke-'));
for (const path of ['server', 'assets', 'scripts', 'apps']) symlinkSync(resolve(root, path), join(temp, path));
mkdirSync(join(temp, 'data'));
const origin = 'https://designbuddy.56juqingba.com';
let child, port;
async function boot() {
  const env = { ...process.env, DESIGNBUDDY_PORT: '0', DESIGNBUDDY_HOST: '0.0.0.0', DESIGNBUDDY_PUBLIC_ORIGIN: origin, DESIGNBUDDY_RENDERER_DIR: resolve(root, 'apps/web/dist'), DESIGNBUDDY_SQLITE_PATH: join(temp, 'data/designbuddy.sqlite'), SKILL_SCHEDULER_ENABLED: 'false' };
  for (const k of Object.keys(env)) {
    if (['GOOGLE_', 'GITHUB_', 'AI_', 'OPENAI_'].some(prefix => k.startsWith(prefix)) || k === 'DESIGNBUDDY_LOCAL_TOKEN' || (k.endsWith('_SQLITE_PATH') && k !== 'DESIGNBUDDY_SQLITE_PATH') || k === 'DESIGNBUDDY_SKILL_DB') delete env[k];
  }
  env.DESIGNBUDDY_ENABLE_LOCAL_AGENT = 'false';
  child = spawn(process.execPath, [resolve(root, 'dist/local/server/local-daemon.js')], { cwd: temp, env, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((accept, reject) => {
    let logs = '';
    const timer = setTimeout(() => reject(Error('startup timeout: ' + logs)), 15000);
    child.once('exit', code => { clearTimeout(timer); reject(Error('server exit ' + code + ': ' + logs)); });
    child.stderr.on('data', d => { logs += d; });
    child.stdout.on('data', d => {
      logs += d;
      const match = logs.match(/listening on 0\.0\.0\.0:(\d+)/);
      if (match) { port = Number(match[1]); clearTimeout(timer); accept(); }
    });
  });
}
async function stop() {
  if (child && child.exitCode === null) { child.kill('SIGTERM'); await once(child, 'exit'); }
}
function call(path, { method = 'GET', body, cookie, requestOrigin = origin } = {}) {
  return new Promise((accept, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path, method, headers: { Host: new URL(origin).host, ...(method !== 'GET' ? { Origin: requestOrigin, 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) } }, res => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => accept({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}
try {
  await boot();
  assert.equal((await call('/api/health')).status, 200);
  const html = await call('/');
  assert.equal(html.status, 200);
  assert.match(html.headers['content-type'], /text\/html/);
  const asset = html.text.match(/src="(\/assets\/[^\"]+\.js)"/)[1];
  assert.equal((await call(asset)).status, 200);
  assert.equal((await call('/workspace/deep-link')).status, 200);
  const images = readdirSync(resolve(root, 'apps/web/public/welcome-templates/png')).filter(f => f.endsWith('.png'));
  assert.equal(images.length, 15);
  for (const image of images) assert.equal((await call('/welcome-templates/png/' + encodeURIComponent(image))).status, 200);
  assert.deepEqual(JSON.parse((await call('/api/auth/providers')).text), { google: false, github: false });
  assert.equal((await call('/api/auth/me')).status, 401);
  assert.equal((await call('/api/local/session', { method: 'POST', body: {}, requestOrigin: 'https://evil.example' })).status, 403);
  const session = await call('/api/local/session', { method: 'POST', body: {} });
  assert.equal(session.status, 200);
  assert.match(session.headers['set-cookie'][0], /Secure/);
  let cookie = session.headers['set-cookie'][0].split(';')[0];
  const registered = await call('/api/auth/register', { method: 'POST', cookie, body: { username: 'package-smoke', password: 'Package-Smoke-2026-Strong' } });
  assert.equal(registered.status, 201, registered.text);
  cookie = registered.headers['set-cookie'][0].split(';')[0];
  assert.equal((await call('/api/auth/me', { cookie })).status, 200);
  await stop();
  await boot();
  assert.equal((await call('/api/auth/me', { cookie })).status, 200);
  console.log('PASS: production HTML/JS/deep link, all 15 PNGs, public providers, private auth, HTTPS-origin CSRF, secure cookie, registration, persistent session after restart. No real OAuth attempted.');
} finally {
  await stop();
  rmSync(temp, { recursive: true, force: true });
}
