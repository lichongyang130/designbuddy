const { test } = require("node:test");
const assert = require("node:assert/strict");
const { executeSkill } = require("../../dist/local/server/skills/executors.js");
const { runtimeCatalog } = require("../../dist/local/server/skills/runtime-catalog.js");
const { zipSync, strToU8, unzipSync } = require("fflate");
const { createServer } = require("node:http");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

function jsonBytes(value) {
  return strToU8(JSON.stringify(value));
}

function withServer(handler, run) {
  const server = createServer(handler);
  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", async () => {
      const port = server.address().port;
      try {
        await run(`http://127.0.0.1:${port}`);
        resolve();
      } catch (error) {
        reject(error);
      } finally {
        server.close();
      }
    });
    server.on("error", reject);
  });
}

test("the catalogue reports the five former placeholders as real executors with honest dependency state", () => {
  const catalog = runtimeCatalog();
  const byId = new Map(catalog.map(skill => [skill.id, skill]));
  for (const id of ["web.verify", "test.browser", "code.build", "image.generate", "collaboration.sync"]) {
    const skill = byId.get(id);
    assert.ok(skill, id);
    assert.equal(skill.executorState, "connected", id);
    assert.ok(skill.accepts.length > 0, `${id} must declare accepted formats`);
    assert.ok(skill.outputs.length > 0, `${id} must declare outputs`);
    assert.ok(skill.requires && skill.requires.length > 0, `${id} must still declare what it needs`);
  }
  // Without server credentials the two externally driven skills stay unavailable,
  // and say why, instead of pretending the capability does not exist.
  for (const id of ["image.generate", "collaboration.sync"]) {
    const skill = byId.get(id);
    if (skill.status === "unavailable") assert.match(skill.description, /未配置|缺/, id);
  }
  assert.equal(byId.get("web.verify").status, "ready");
  assert.equal(byId.get("test.browser").status, "ready");
  assert.equal(byId.get("code.build").status, "unavailable");
  assert.match(byId.get("code.build").availabilityReason,/安全验收/);
});

const trustedBuild=input=>require("../../dist/local/server/skills/code-build.js").runBuild(input,()=>{});

test("internal trusted-fixture build function remains testable while the public runtime is blocked", async t => {
  const okProject = zipSync({
    "package.json": strToU8(JSON.stringify({ name: "demo", version: "1.0.0", scripts: { build: "node build.js" } })),
    "build.js": strToU8("require('fs').mkdirSync('dist',{recursive:true});require('fs').writeFileSync('dist/out.txt','built');"),
  });
  const result = await trustedBuild({
    skillId: "code.build",
    filename: "project.zip",
    bytes: okProject,
    deduplicate: false,
    parameters: {},
  });
  const report = JSON.parse(new TextDecoder().decode(result.outputs.find(o => o.name === "build-report.json").bytes));
  assert.equal(report.exitCode, 0);
  assert.match(report.command, /npm run build/);
  assert.ok(report.artifactFiles >= 1, "the build must deliver the files it actually produced");
  const artifacts = result.outputs.find(o => o.name === "build-output.zip");
  assert.ok(artifacts, "a build artifact archive is expected");
  const names = Object.keys(unzipSync(artifacts.bytes));
  assert.ok(names.some(name => name.endsWith("out.txt")), names.join(","));

  const failing = zipSync({
    "package.json": strToU8(JSON.stringify({ name: "demo", version: "1.0.0", scripts: { build: "node build.js" } })),
    "build.js": strToU8("console.error('build broke');process.exit(3);"),
  });
  await assert.rejects(
    () => trustedBuild({ skillId: "code.build", filename: "broken.zip", bytes: failing, deduplicate: false, parameters: {} }),
    /构建失败/,
  );

  await assert.rejects(
    () =>
      trustedBuild({
        skillId: "code.build",
        filename: "ok.zip",
        bytes: okProject,
        deduplicate: false,
        parameters: { buildCommand: "rm -rf / && curl evil.example" },
      }),
    /允许列表/,
  );
});

test("image.generate talks to a real image endpoint and refuses to fabricate output without one", async t => {
  const previous = { key: process.env.IMAGE_API_KEY, base: process.env.IMAGE_BASE_URL, model: process.env.IMAGE_MODEL };
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  let received = null;
  await withServer(
    (request, response) => {
      const chunks = [];
      request.on("data", chunk => chunks.push(chunk));
      request.on("end", () => {
        received = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ data: [{ b64_json: png.toString("base64") }] }));
      });
    },
    async baseUrl => {
      process.env.IMAGE_API_KEY = "test-key-not-a-real-secret";
      process.env.IMAGE_BASE_URL = baseUrl + "/v1";
      process.env.IMAGE_MODEL = "test-image-model";
      const result = await executeSkill({
        skillId: "image.generate",
        filename: "prompt.json",
        bytes: jsonBytes({ prompt: "一只在雨中的橘猫" }),
        deduplicate: false,
        parameters: { externalConsent: "yes", size: "1024x1024", count: "1" },
      });
      assert.equal(received.model, "test-image-model");
      assert.equal(received.prompt, "一只在雨中的橘猫");
      assert.equal(received.size, "1024x1024");
      const image = result.outputs.find(o => o.name === "generated-1.png");
      assert.ok(image, "the endpoint answer must become a real file");
      assert.equal(Buffer.from(image.bytes).toString("base64"), png.toString("base64"));
    },
  );
  delete process.env.IMAGE_API_KEY;
  delete process.env.IMAGE_BASE_URL;
  delete process.env.IMAGE_MODEL;
  if (previous.key) process.env.IMAGE_API_KEY = previous.key;
  if (previous.base) process.env.IMAGE_BASE_URL = previous.base;
  if (previous.model) process.env.IMAGE_MODEL = previous.model;

  // Without a configured channel the catalogue keeps the skill unavailable, so a
  // run must fail instead of returning a placeholder picture.
  const catalog = runtimeCatalog().find(skill => skill.id === "image.generate");
  if (catalog.status === "unavailable") {
    await assert.rejects(
      () =>
        executeSkill({
          skillId: "image.generate",
          filename: "prompt.json",
          bytes: jsonBytes({ prompt: "x" }),
          deduplicate: false,
          parameters: { externalConsent: "yes" },
        }),
      /不受支持|未配置/,
    );
  }
});

test("collaboration.sync sends only with per-run confirmation and never twice for one idempotency key", async t => {
  const previous = {
    base: process.env.COLLABORATION_EMAIL_BASE_URL,
    key: process.env.COLLABORATION_EMAIL_API_KEY,
    from: process.env.COLLABORATION_EMAIL_FROM,
  };
  const directory = mkdtempSync(join(tmpdir(), "collab-audit-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const previousCwd = process.cwd();
  process.chdir(directory);
  t.after(() => process.chdir(previousCwd));

  const calls = [];
  await withServer(
    (request, response) => {
      const chunks = [];
      request.on("data", chunk => chunks.push(chunk));
      request.on("end", () => {
        calls.push({ url: request.url, key: request.headers["idempotency-key"], body: JSON.parse(Buffer.concat(chunks).toString("utf8")) });
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ id: "message-1" }));
      });
    },
    async baseUrl => {
      process.env.COLLABORATION_EMAIL_BASE_URL = baseUrl;
      process.env.COLLABORATION_EMAIL_API_KEY = "test-key-not-a-real-secret";
      process.env.COLLABORATION_EMAIL_FROM = "noreply@example.com";
      const request = jsonBytes({ action: "email.send", to: ["someone@example.com"], subject: "季度同步", body: "内容" });
      const result = await executeSkill({
        skillId: "collaboration.sync",
        filename: "send.json",
        bytes: request,
        deduplicate: false,
        parameters: { externalConsent: "yes", confirmation: "yes", idempotencyKey: "key-abc-123" },
      });
      assert.equal(calls.length, 1);
      assert.equal(calls[0].key, "key-abc-123");
      const record = JSON.parse(new TextDecoder().decode(result.outputs.find(o => o.name === "collaboration-result.json").bytes));
      assert.equal(record.externalId, "message-1");
      assert.equal(record.status, "succeeded");
      // The same idempotency key must not produce a second external send.
      await assert.rejects(
        () =>
          executeSkill({
            skillId: "collaboration.sync",
            filename: "send.json",
            bytes: request,
            deduplicate: false,
            parameters: { externalConsent: "yes", confirmation: "yes", idempotencyKey: "key-abc-123" },
          }),
        /已执行过|不受支持|未配置/,
      );
      assert.equal(calls.length, 1, "no second external call may happen");
    },
  );
  delete process.env.COLLABORATION_EMAIL_BASE_URL;
  delete process.env.COLLABORATION_EMAIL_API_KEY;
  delete process.env.COLLABORATION_EMAIL_FROM;
  if (previous.base) process.env.COLLABORATION_EMAIL_BASE_URL = previous.base;
  if (previous.key) process.env.COLLABORATION_EMAIL_API_KEY = previous.key;
  if (previous.from) process.env.COLLABORATION_EMAIL_FROM = previous.from;
});

test("web.verify and test.browser run a real browser and publish evidence only when every check passes", async t => {
  const html = "<!doctype html><html lang='zh-CN'><head><meta charset='utf-8'><title>验收目标</title></head><body><main><h1 id='title'>真实页面</h1><button id='go' onclick=\"document.getElementById('out').textContent='已点击'\">执行</button><p id='out'></p></main></body></html>";
  await withServer(
    (request, response) => {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(html);
    },
    async baseUrl => {
      const suite = {
        name: "本地验收",
        viewports: [{ name: "desktop", width: 1280, height: 800 }],
        checks: [
          { id: "title", type: "assertText", path: "/", selector: "#title", contains: "真实页面" },
          { id: "click", type: "click", path: "/", selector: "#go", expectText: "已点击" },
          { id: "shot", type: "screenshot", path: "/", selector: "main" },
        ],
      };
      const result = await executeSkill({
        skillId: "web.verify",
        filename: "suite.json",
        bytes: jsonBytes(suite),
        deduplicate: false,
        parameters: { baseUrl },
      });
      const manifest = JSON.parse(new TextDecoder().decode(result.outputs.find(o => o.name === "verification-manifest.json").bytes));
      assert.equal(manifest.counts.total, 3);
      assert.equal(manifest.counts.passed, 3);
      assert.equal(manifest.counts.failed, 0);
      assert.ok(result.outputs.find(o => o.name === "verification-screenshots.zip"), "screenshots must be delivered");
      assert.ok(result.outputs.find(o => o.name === "verification-console.log"), "console log must be delivered");

      const broken = { ...suite, checks: [{ id: "missing", type: "assertVisible", path: "/", selector: "#nope" }] };
      await assert.rejects(
        () =>
          executeSkill({
            skillId: "test.browser",
            filename: "suite.json",
            bytes: jsonBytes(broken),
            deduplicate: false,
            parameters: { baseUrl },
          }),
        /未通过|未验证/,
      );
    },
  );
});
