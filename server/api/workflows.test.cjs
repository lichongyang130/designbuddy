const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const { SkillService } = require("../../dist/local/server/skills/service.js");
const { AssetStore } = require("../../dist/local/server/api/assets.js");
const { TaskBackend } = require("../../dist/local/server/api/task-backend.js");
const { WorkflowEngine, WorkflowRunStore, workflowCatalog } = require("../../dist/local/server/api/workflows.js");
const { createApiHandler } = require("../../dist/local/server/api/http-handler.js");

const csv = "渠道,确认收入\n线上直营,128.5\n线下门店,96.2\n合作渠道,73.8\n";
const faqRows = [
  { category: "报名", question: "如何报名活动？", answer: "打开活动详情页并点击报名入口。" },
  { category: "参与", question: "报名后如何取消？", answer: "请根据活动说明联系主办方处理。" },
];

function withEngine(run) {
  const directory = mkdtempSync(join(tmpdir(), "workflows-"));
  const skills = new SkillService(":memory:");
  const assets = new AssetStore(join(directory, "assets.sqlite"), join(directory, "files"));
  const tasks = new TaskBackend(join(directory, "tasks.sqlite"));
  const store = new WorkflowRunStore(join(directory, "workflows.sqlite"));
  const engine = new WorkflowEngine(skills, assets, tasks, store);
  const context = { engine, skills, assets, tasks, store };
  return Promise.resolve(run(context)).finally(async () => {
    // Let a background step finish before the stores are closed.
    await new Promise((resolve) => setTimeout(resolve, 100));
    await skills.close();
    assets.close();
    tasks.close();
    store.close();
    rmSync(directory, { recursive: true, force: true });
  });
}

const request = (path, method = "GET", body, user = "alice") =>
  new Request(`http://local${path}`, {
    method,
    headers: { "content-type": "application/json", origin: "http://local", "x-test-user": user },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

test("the catalogue lists real recipes and says which steps cannot run here", () => {
  const catalog = workflowCatalog();
  const ids = catalog.map((workflow) => workflow.id);
  for (const expected of ["business-infographic", "faq-page", "table-insights", "doc-structure", "doc-brief"]) {
    assert.ok(ids.includes(expected), `missing workflow ${expected}`);
  }
  for (const workflow of catalog) {
    assert.ok(workflow.steps.length >= 1);
    for (const step of workflow.steps) {
      assert.equal(typeof step.availability.ready, "boolean");
      if (!step.availability.ready) assert.ok(step.availability.reason.length > 0, "an unavailable step must say why");
    }
  }
  // Every recipe names the skills it calls, and every skill is a registered one.
  const skills = require("../../dist/local/shared/skillRuntime.js").runtimeSkills.map((skill) => skill.id);
  for (const workflow of catalog) for (const step of workflow.steps) assert.ok(skills.includes(step.skill));
});

test("a missing answer is refused before any step runs", async () => {
  await withEngine(async ({ engine, store }) => {
    await assert.rejects(
      () => engine.start("alice", "business-infographic", { fields: { title: "只有标题" } }),
      /请先填写/,
    );
    assert.equal(store.list("alice").length, 0);
  });
});

test("a form driven run really executes the skill and returns its artifacts", async () => {
  await withEngine(async ({ engine, skills }) => {
    const run = await engine.start("bob", "business-infographic", {
      fields: {
        title: "渠道收入对比",
        purpose: "comparison",
        metric: "确认收入",
        unit: "万元",
        scope: "2026年9月已确认收入；各渠道采用相同记账口径",
        source: "测试样例，不代表真实业务",
        rows: [
          { label: "线上直营", value: "128.5" },
          { label: "线下门店", value: "96.2" },
        ],
      },
    });
    assert.equal(run.status, "running");
    const finished = await engine.waitFor("bob", run.id);
    assert.equal(finished.status, "succeeded", finished.error);
    assert.equal(finished.steps.length, 1);
    const step = finished.steps[0];
    assert.equal(step.status, "succeeded");
    assert.equal(step.skill, "infographic.compose");
    assert.ok(step.skillRunId);
    const names = step.outputs.map((artifact) => artifact.name);
    assert.ok(names.some((name) => name.endsWith(".svg")), `no svg in ${names.join(",")}`);
    assert.ok(names.some((name) => name.endsWith(".png")), `no png in ${names.join(",")}`);
    // The artifact bytes are real and only the owner can download them.
    const svg = step.outputs.find((artifact) => artifact.name.endsWith(".svg"));
    const response = await skills.handle(
      new Request(`http://local/api/skill-runs/${step.skillRunId}/artifacts/${svg.id}`),
      "bob",
    );
    assert.equal(response.status, 200);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.ok(bytes.length > 1000);
    assert.match(bytes.toString(), /<path /);
    const other = await skills.handle(
      new Request(`http://local/api/skill-runs/${step.skillRunId}/artifacts/${svg.id}`),
      "carol",
    );
    assert.equal(other.status, 404);
  });
});

test("the FAQ run produces a searchable page and an offline package", async () => {
  await withEngine(async ({ engine, skills }) => {
    const run = await engine.start("alice", "faq-page", {
      fields: {
        title: "报名帮助中心",
        brand: "社区活动",
        intro: "活动与报名相关的常见问题。",
        primary: "#28634D",
        surface: "#F2F5F1",
        text: "#24352D",
        rows: faqRows,
      },
    });
    const finished = await engine.waitFor("alice", run.id);
    assert.equal(finished.status, "succeeded", finished.error);
    const step = finished.steps[0];
    assert.equal(step.status, "succeeded");
    const html = step.outputs.find((artifact) => artifact.name.endsWith(".html"));
    const zip = step.outputs.find((artifact) => artifact.name.endsWith(".zip"));
    assert.ok(html && zip);
    const response = await skills.handle(
      new Request(`http://local/api/skill-runs/${step.skillRunId}/artifacts/${html.id}`),
      "alice",
    );
    const text = Buffer.from(await response.arrayBuffer()).toString();
    assert.match(text, /如何报名活动/);
    assert.match(text, /<details class="faq"/);
  });
});

test("a table run reads the file from the asset library and produces the workbook", async () => {
  await withEngine(async ({ engine, assets }) => {
    const asset = assets.create("alice", { name: "channels.csv", mime: "text/csv", bytes: Buffer.from(csv, "utf8") });
    const run = await engine.start("alice", "table-insights", {
      files: { file: { assetId: asset.id, name: asset.name } },
    });
    const finished = await engine.waitFor("alice", run.id);
    assert.equal(finished.status, "succeeded", finished.error);
    const names = finished.steps[0].outputs.map((artifact) => artifact.name);
    assert.ok(names.some((name) => name.endsWith(".xlsx")), `no xlsx in ${names.join(",")}`);
    assert.ok(names.some((name) => name.endsWith(".json")), `no json in ${names.join(",")}`);
  });
});

test("a file that belongs to somebody else is refused with a clear reason", async () => {
  await withEngine(async ({ engine, assets }) => {
    const asset = assets.create("bob", { name: "channels.csv", mime: "text/csv", bytes: Buffer.from(csv, "utf8") });
    const run = await engine.start("alice", "table-insights", {
      files: { file: { assetId: asset.id, name: asset.name } },
    });
    const finished = await engine.waitFor("alice", run.id);
    assert.equal(finished.status, "failed");
    assert.equal(finished.steps[0].status, "failed");
    assert.match(finished.steps[0].error, /不属于当前账号/);
  });
});

test("a step that needs credentials says what is missing instead of faking a result", async () => {
  const before = { ai: process.env.AI_API_KEY, openai: process.env.OPENAI_API_KEY };
  delete process.env.AI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  await withEngine(async ({ engine, assets }) => {
    const asset = assets.create("alice", { name: "note.md", mime: "text/markdown", bytes: Buffer.from("# 标题\n\n一段正文。\n", "utf8") });
    const run = await engine.start("alice", "doc-brief", {
      fields: { externalConsent: "yes" },
      files: { file: { assetId: asset.id, name: asset.name } },
    });
    // The first step runs locally, the second one needs a credential the
    // server does not have: it must say so instead of faking a summary.
    const finished = await engine.waitFor("alice", run.id);
    assert.equal(finished.steps[0].status, "succeeded", finished.steps[0].error);
    assert.equal(finished.steps[1].status, "unavailable");
    assert.match(finished.steps[1].error, /AI_API_KEY|未配置/);
    assert.equal(finished.status, "partial");
    assert.match(finished.error, /AI_API_KEY|未配置/);
  });
  if (before.ai) process.env.AI_API_KEY = before.ai;
  if (before.openai) process.env.OPENAI_API_KEY = before.openai;
});

test("a step that needs a single authorisation is skipped and says so", async () => {
  const before = process.env.AI_API_KEY;
  process.env.AI_API_KEY = "test-only-not-used";
  await withEngine(async ({ engine, assets }) => {
    const asset = assets.create("alice", { name: "note.md", mime: "text/markdown", bytes: Buffer.from("# 标题\n\n一段正文。\n", "utf8") });
    const run = await engine.start("alice", "doc-brief", {
      fields: { externalConsent: "" },
      files: { file: { assetId: asset.id, name: asset.name } },
    });
    const finished = await engine.waitFor("alice", run.id);
    assert.equal(finished.steps[0].status, "succeeded", finished.steps[0].error);
    assert.equal(finished.steps[1].status, "skipped");
    assert.match(finished.steps[1].error, /没有单次授权/);
    assert.equal(finished.status, "partial");
  });
  if (before) process.env.AI_API_KEY = before;
  else delete process.env.AI_API_KEY;
});

test("a failed step can be retried and the reason comes from the real run", async () => {
  await withEngine(async ({ engine }) => {
    const run = await engine.start("alice", "faq-page", {
      fields: {
        title: "重复问题",
        primary: "#28634D",
        surface: "#F2F5F1",
        text: "#24352D",
        rows: [
          { category: "报名", question: "同一个问题？", answer: "答案一" },
          { category: "参与", question: "同一个问题？", answer: "答案二" },
        ],
      },
    });
    const failed = await engine.waitFor("alice", run.id);
    assert.equal(failed.status, "failed");
    assert.equal(failed.steps[0].status, "failed");
    assert.match(failed.steps[0].error, /重复/);
    const firstSkillRun = failed.steps[0].skillRunId;
    await engine.retryStep("alice", run.id, "page");
    const retried = await engine.waitFor("alice", run.id);
    assert.equal(retried.steps[0].status, "failed");
    assert.match(retried.steps[0].error, /重复/);
    assert.notEqual(retried.steps[0].skillRunId, firstSkillRun);
  });
});

test("one person cannot read or retry another person's run", async () => {
  await withEngine(async ({ engine }) => {
    const run = await engine.start("alice", "faq-page", {
      fields: { title: "帮助", primary: "#28634D", surface: "#F2F5F1", text: "#24352D", rows: faqRows },
    });
    await engine.waitFor("alice", run.id);
    assert.equal(engine.get("bob", run.id), null);
    assert.equal(engine.list("bob").length, 0);
    await assert.rejects(() => engine.retryStep("bob", run.id, "page"), /没有这次工作流运行记录/);
  });
});

test("the http api starts, reads and retries workflow runs", async () => {
  await withEngine(async ({ engine }) => {
    const handler = createApiHandler({
      projects: {
        async listByOwner() { return []; },
        async getById() { return null; },
        async save() { throw Error("not used"); },
        async delete() { return false; },
      },
      workflows: engine,
      authenticate: async (req) => {
        const id = req.headers.get("x-test-user");
        return id ? { id } : null;
      },
    });
    const list = await handler(request("/api/workflows"));
    assert.equal(list.status, 200);
    const body = await list.json();
    assert.ok(body.workflows.length >= 5);

    const refused = await handler(
      request("/api/workflows/business-infographic/runs", "POST", { fields: { title: "只有标题" } }),
    );
    assert.equal(refused.status, 400);
    assert.match((await refused.json()).error, /请先填写/);

    const started = await handler(
      request("/api/workflows/faq-page/runs", "POST", {
        fields: { title: "帮助", primary: "#28634D", surface: "#F2F5F1", text: "#24352D", rows: faqRows },
      }),
    );
    assert.equal(started.status, 202);
    const run = (await started.json()).run;
    assert.equal(run.workflowId, "faq-page");
    assert.equal(run.ownerId, "alice");

    const fetched = await handler(request(`/api/workflow-runs/${run.id}`));
    assert.equal(fetched.status, 200);
    const mine = await engine.waitFor("alice", run.id);
    assert.equal(mine.status, "succeeded", mine.error);

    const runs = await handler(request("/api/workflow-runs"));
    const listed = (await runs.json()).runs;
    assert.equal(listed.length, 1);
    assert.equal(listed[0].id, run.id);

    const hidden = await handler(request(`/api/workflow-runs/${run.id}`, "GET", undefined, "bob"));
    assert.equal(hidden.status, 404);

    const retried = await handler(request(`/api/workflow-runs/${run.id}/steps/page/retry`, "POST"));
    assert.equal(retried.status, 202);
    // Wait for the retried step so the background run does not outlive the test.
    await engine.waitFor("alice", run.id);
    const unknown = await handler(request(`/api/workflow-runs/${run.id}/steps/nope/retry`, "POST"));
    assert.equal(unknown.status, 400);
  });
});
