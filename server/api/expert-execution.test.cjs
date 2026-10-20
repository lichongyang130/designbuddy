const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { randomUUID } = require("node:crypto");
const { setTimeout: delay } = require("node:timers/promises");
const {
  ExpertExecutionService,
} = require("../../dist/local/server/api/expert-execution.js");
const { SkillService } = require("../../dist/local/server/skills/service.js");
const { AssetStore } = require("../../dist/local/server/api/assets.js");
const { TaskBackend } = require("../../dist/local/server/api/task-backend.js");
const {
  WorkflowEngine,
  WorkflowRunStore,
} = require("../../dist/local/server/api/workflows.js");
const {
  createApiHandler,
} = require("../../dist/local/server/api/http-handler.js");
const {
  deliveryProduct,
  productLeads,
  builtinExecutionExpert,
} = require("../../dist/local/shared/expertExecution.js");
const { skillProducts } = require("../../dist/local/shared/skillProducts.js");
const { wordExample } = require("../../dist/local/shared/wordDocument.js");

async function withServices(fn) {
  const dir = mkdtempSync(join(tmpdir(), "expert-execution-"));
  const service = new ExpertExecutionService(join(dir, "expert.sqlite"));
  const skills = new SkillService(":memory:");
  const assets = new AssetStore(join(dir, "assets.sqlite"), join(dir, "files"));
  const tasks = new TaskBackend(join(dir, "tasks.sqlite"));
  const store = new WorkflowRunStore(join(dir, "workflows.sqlite"));
  const workflows = new WorkflowEngine(skills, assets, tasks, store);
  const api = createApiHandler({
    expertExecution: service,
    skills,
    assets,
    workflows,
    projects: {},
    authenticate: async (r) =>
      r.headers.get("x-owner") === "none"
        ? null
        : { id: r.headers.get("x-owner") || "alice" },
  });
  try {
    await fn({ service, skills, assets, tasks, workflows, api });
  } finally {
    await skills.close();
    service.close();
    assets.close();
    tasks.close();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
}
const post = (path, body, owner = "alice") =>
  new Request(`http://app.test/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-owner": owner },
    body: JSON.stringify(body),
  });
const planInput = (productId = "data", extra = {}) => ({
  taskId: randomUUID(),
  goal: "根据实际材料生成可核查交付",
  productId,
  ...extra,
});
function skillRequest(
  plan,
  {
    data = "渠道,金额\n线上,100\n线下,200",
    requestId = randomUUID(),
    ...extra
  } = {},
) {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    taskId: plan.taskId,
    skillId: plan.route.id,
    expertId: plan.route.executorExpertId,
    consent: "true",
    permission: "默认权限",
    deduplicate: "false",
    ...extra,
  }))
    form.set(key, value);
  form.set(
    "file",
    new File(
      [data],
      plan.route.id === "document.create" ? "report.json" : "facts.csv",
    ),
  );
  return new Request(
    `http://app.test/api/expert-task-plans/${plan.id}/execute`,
    {
      method: "POST",
      headers: {
        "x-expert-approval": plan.approvalDigest,
        "x-expert-request": requestId,
      },
      body: form,
    },
  );
}
async function waitSkill(skills, id) {
  for (let i = 0; i < 250; i++) {
    const run = await (
      await skills.handle(
        new Request(`http://app.test/api/skill-runs/${id}`),
        "alice",
      )
    ).json();
    if (!["queued", "running"].includes(run.status)) return run;
    await delay(100);
  }
  throw Error("skill timed out");
}

test("conservative delivery routing covers eight outcomes but never turns a consultation into fake production", () => {
  for (const [goal, id] of [
    ["制作PPTX汇报", "presentations"],
    ["生成可编辑Word报告", "documents"],
    ["生成表格分析报告", "data"],
    ["设计品牌规范", "brand"],
    ["制作营销海报", "visual"],
    ["搭建产品网站", "web"],
    ["生成项目计划", "projects"],
    ["检查网页HTML", "quality"],
  ])
    assert.equal(deliveryProduct(goal), id);
  for (const goal of [
    "如何制作PPT",
    "只要文字建议，不要生成文件",
    "解释Word分页",
    "讨论项目方案",
    "你好",
    "做一个产品介绍",
  ])
    assert.equal(deliveryProduct(goal), undefined);
  for (const p of skillProducts)
    assert.ok(
      builtinExecutionExpert(productLeads[p.id]).productIds.includes(p.id),
    );
});

test("server creates eight versioned routes; reload reuses plans; no tool/AI run is created by planning", async () =>
  withServices(async ({ service, skills }) => {
    for (const product of skillProducts) {
      const input = planInput(product.id);
      const plan = service.create("alice", input);
      assert.equal(plan.route.id, product.primary.replace("workflow:", ""));
      assert.ok(plan.expert.method.length);
      assert.ok(plan.expert.checks.length);
      assert.equal(service.create("alice", input).id, plan.id);
      assert.equal(plan.approvalDigest.length, 64);
      assert.equal(service.list("bob", input.taskId).plans.length, 0);
      assert.throws(() => service.get("bob", plan.id), /没有/);
    }
    assert.equal(
      (
        await (
          await skills.handle(
            new Request("http://app.test/api/skill-runs"),
            "alice",
          )
        ).json()
      ).runs.length,
      0,
    );
  }));

test("unknown IDs, incompatible locked experts, local-only and invented executors are rejected", async () =>
  withServices(async ({ service, api }) => {
    for (const change of [
      { expertId: "brand", lockedExpert: true },
      { expertId: randomUUID() },
      { sceneId: "code.build" },
      { sceneId: "unknown-tool" },
      { permission: "仅本地" },
      { allowedSkills: ["evil"] },
    ])
      assert.throws(() => service.create("alice", planInput("data", change)));
    assert.equal(
      (await api(post("/expert-task-plans", planInput(), "none"))).status,
      401,
    );
    assert.equal(
      (
        await api(
          post("/expert-task-plans", planInput("data", { expertId: "brand" })),
        )
      ).status,
      409,
    );
  }));

test("custom experts bind only existing templates, remain owner scoped and invalidate old approvals after configuration changes", async () =>
  withServices(async ({ service, skills }) => {
    const id = randomUUID();
    const b = service.bind("alice", {
      id,
      name: "我的财务专家",
      description: "按原始凭证核对",
      baseExpertId: "data",
    });
    assert.equal(b.version, 1);
    assert.equal(service.expert("bob", id), undefined);
    assert.throws(() =>
      service.bind("alice", {
        id: randomUUID(),
        name: "越权",
        baseExpertId: "data",
        productIds: ["web"],
      }),
    );
    assert.throws(() =>
      service.bind("alice", {
        id: randomUUID(),
        name: "越权",
        baseExpertId: "data",
        permissions: ["shell"],
      }),
    );
    const plan = service.create(
      "alice",
      planInput("data", { expertId: id, lockedExpert: true }),
    );
    assert.equal(plan.expert.id, id);
    assert.equal(plan.route.executorExpertId, "data");
    service.bind("alice", {
      id,
      name: "我的财务专家第二版",
      baseExpertId: "data",
    });
    await assert.rejects(
      () => service.execute("alice", plan.id, skillRequest(plan), skills),
      /配置已变化/,
    );
  }));

test("approval, actual consent, exact route/task and ownership are enforced before dispatch", async () =>
  withServices(async ({ service, skills }) => {
    const plan = service.create("alice", planInput());
    for (const options of [
      { consent: "false" },
      { permission: "仅本地" },
      { skillId: "code.build" },
      { expertId: "qa" },
      { taskId: randomUUID() },
      { planId: randomUUID() },
    ])
      await assert.rejects(() =>
        service.execute("alice", plan.id, skillRequest(plan, options), skills),
      );
    const badDigest = skillRequest(plan);
    badDigest.headers.set("x-expert-approval", "forged");
    await assert.rejects(
      () => service.execute("alice", plan.id, badDigest, skills),
      /摘要/,
    );
    await assert.rejects(
      () => service.execute("bob", plan.id, skillRequest(plan), skills),
      /没有/,
    );
    assert.equal(service.list("alice", plan.taskId).executions.length, 0);
  }));

test("real skill execution creates artifacts, duplicate submissions reuse the run, revisions retain actual parent/hash evidence", async () =>
  withServices(async ({ service, skills }) => {
    const plan = service.create("alice", planInput());
    const requestId = randomUUID();
    const first = await (
      await service.execute(
        "alice",
        plan.id,
        skillRequest(plan, { requestId }),
        skills,
      )
    ).json();
    const same = await (
      await service.execute(
        "alice",
        plan.id,
        skillRequest(plan, { requestId }),
        skills,
      )
    ).json();
    assert.equal(same.id, first.id);
    await assert.rejects(
      () =>
        service.execute(
          "alice",
          plan.id,
          skillRequest(plan, { requestId, data: "changed" }),
          skills,
        ),
      /相同执行ID/,
    );
    const result = await waitSkill(skills, first.id);
    assert.equal(result.status, "succeeded", result.error);
    assert.ok(result.artifacts.length);
    const revised = service.create("alice", {
      ...planInput(),
      taskId: plan.taskId,
      goal: "追加实际新数据后重新复算",
    });
    const next = await (
      await service.execute(
        "alice",
        revised.id,
        skillRequest(revised, { data: "渠道,金额\n线上,120\n线下,220" }),
        skills,
      )
    ).json();
    await waitSkill(skills, next.id);
    const history = service.list("alice", plan.taskId).executions;
    assert.equal(history.length, 2);
    assert.equal(history[0].revision, 2);
    assert.equal(history[0].parentId, history[1].id);
    assert.notEqual(history[0].inputHash, history[1].inputHash);
    assert.equal(
      (
        await skills.handle(
          new Request(`http://app.test/api/skill-runs/${result.id}`),
          "bob",
        )
      ).status,
      404,
    );
  }));

test("real marketing workflow is delegated, idempotent and scoped to its conversation with actual PNG/WebP outputs", async () =>
  withServices(async ({ service, skills, workflows, assets }) => {
    const sharp = require("sharp");
    const bytes = await sharp({
      create: { width: 120, height: 80, channels: 3, background: "#649563" },
    })
      .png()
      .toBuffer();
    const asset = assets.create("alice", {
      name: "synthetic.png",
      mime: "image/png",
      bytes,
    });
    const plan = service.create(
      "alice",
      planInput("visual", { expertId: "product-visual", lockedExpert: true }),
    );
    const requestId = randomUUID();
    const body = {
      fields: {
        title: "执行验证",
        subtitle: "合成图片，非客户项目",
        action: "查看详情",
      },
      files: { file: { assetId: asset.id, name: asset.name } },
      consent: true,
    };
    const request = () =>
      new Request(`http://app.test/api/expert-task-plans/${plan.id}/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-expert-approval": plan.approvalDigest,
          "x-expert-request": requestId,
        },
        body: JSON.stringify(body),
      });
    const { run } = await (
      await service.execute("alice", plan.id, request(), skills, workflows)
    ).json();
    const again = await (
      await service.execute("alice", plan.id, request(), skills, workflows)
    ).json();
    assert.equal(again.run.id, run.id);
    const finished = await workflows.waitFor("alice", run.id);
    assert.equal(finished.status, "succeeded", JSON.stringify(finished.steps));
    assert.equal(finished.parentTaskId, plan.taskId);
    assert.ok(
      finished.steps[0].outputs.some((a) => a.name === "poster-portrait.png"),
    );
    assert.ok(finished.steps[1].outputs.some((a) => a.name.endsWith(".webp")));
    assert.equal(workflows.list("alice", plan.taskId).length, 1);
    assert.equal(workflows.list("alice", randomUUID()).length, 0);
    assert.equal(
      finished.delivery.commercialAcceptance,
      "pending-human-review",
    );
  }));

test("Word route runs the native source-bound renderer and returns real DOCX/PDF, not a Markdown substitute", async () =>
  withServices(async ({ service, skills }) => {
    const plan = service.create("alice", planInput("documents"));
    assert.equal(plan.ready, true, plan.blockers.join(";"));
    const run = await (
      await service.execute(
        "alice",
        plan.id,
        skillRequest(plan, { data: JSON.stringify(wordExample()) }),
        skills,
      )
    ).json();
    const finished = await waitSkill(skills, run.id);
    assert.equal(finished.status, "succeeded", finished.error);
    for (const name of [
      "document.docx",
      "document.pdf",
      "word-quality-report.json",
    ])
      assert.ok(
        finished.artifacts.some((a) => a.name === name),
        name,
      );
  }));

test("missing PPT configuration is a real blocker and never silently falls back to slides.compose", async () =>
  withServices(async ({ service, skills }) => {
    const saved = process.env.AI_API_KEY,
      open = process.env.OPENAI_API_KEY;
    delete process.env.AI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const plan = service.create("alice", planInput("presentations"));
      assert.equal(plan.ready, false);
      assert.equal(plan.route.id, "slides.create");
      await assert.rejects(
        () => service.execute("alice", plan.id, skillRequest(plan), skills),
        /AI_API_KEY/,
      );
    } finally {
      if (saved !== undefined) process.env.AI_API_KEY = saved;
      if (open !== undefined) process.env.OPENAI_API_KEY = open;
    }
  }));

test("Word drafting is explicitly authorized, source-bound, bounded to one model call, cached and schema validated", async () =>
  withServices(async ({ service }) => {
    const fetch = global.fetch,
      key = process.env.AI_API_KEY;
    process.env.AI_API_KEY = "test-only-not-a-secret";
    let calls = 0,
      captured;
    global.fetch = async (_url, options) => {
      calls++;
      captured = JSON.parse(options.body);
      return new Response(
        JSON.stringify({
          model: "controlled-fixture",
          choices: [
            {
              message: {
                content: JSON.stringify({
                  sections: [
                    {
                      role: "summary",
                      paragraphs: ["原始事实：测试材料明确不含业务数字。"],
                    },
                    {
                      role: "analysis",
                      paragraphs: ["合理推断：需要先核对原稿。"],
                    },
                    {
                      role: "recommendations",
                      paragraphs: ["建议：人工确认后使用。"],
                    },
                  ],
                }),
              },
            },
          ],
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    };
    try {
      const plan = service.create("alice", planInput("documents"));
      const input = {
        requestId: randomUUID(),
        externalConsent: true,
        title: "来源测试",
        audience: "执行团队",
        sourceName: "test.txt",
        sourceText: "测试材料明确不含业务数字。",
        documentType: "business-report",
      };
      await assert.rejects(
        () =>
          service.wordDraft("alice", plan.id, {
            ...input,
            externalConsent: false,
          }),
        /授权/,
      );
      assert.equal(calls, 0);
      const result = await service.wordDraft("alice", plan.id, input);
      const cached = await service.wordDraft("alice", plan.id, input);
      assert.equal(calls, 1);
      assert.deepEqual(cached, result);
      assert.equal(result.document.sources[0].text, input.sourceText);
      assert.equal(result.document.blocks.length, 6);
      assert.match(captured.messages[1].content, /expertMethods/);
      assert.match(captured.messages[0].content, /Do not invent/);
      await assert.rejects(
        () =>
          service.wordDraft("alice", plan.id, {
            ...input,
            sourceText: "changed",
          }),
        /相同内容请求ID/,
      );
      global.fetch = async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"sections":[]}' } }],
          }),
        );
      await assert.rejects(
        () =>
          service.wordDraft("alice", plan.id, {
            ...input,
            requestId: randomUUID(),
          }),
        /章节结构/,
      );
    } finally {
      global.fetch = fetch;
      if (key === undefined) delete process.env.AI_API_KEY;
      else process.env.AI_API_KEY = key;
    }
  }));

test("asset byte download preserves exact source bytes and denies another owner", async () =>
  withServices(async ({ assets, api }) => {
    const asset = assets.create("alice", {
      name: "真实材料.txt",
      mime: "text/plain",
      bytes: Buffer.from("真实来源正文"),
    });
    const get = (owner) =>
      api(
        new Request(`http://app.test/api/assets/${asset.id}/download`, {
          headers: { "x-owner": owner },
        }),
      );
    const response = await get("alice");
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "真实来源正文");
    assert.equal((await get("bob")).status, 403);
  }));

test("original skill input is byte-exact, no-store, owner-protected and disappears with its run", async () =>
  withServices(async ({ service, skills, api }) => {
    const plan = service.create("alice", planInput("data"));
    const source = "字段,金额\r\n实际原文,123\r\n";
    const run = await (
      await service.execute(
        "alice",
        plan.id,
        skillRequest(plan, { data: source }),
        skills,
      )
    ).json();
    await waitSkill(skills, run.id);
    const input = (owner) =>
      api(
        new Request(`http://app.test/api/skill-runs/${run.id}/input`, {
          headers: { "x-owner": owner },
        }),
      );
    const response = await input("alice");
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.match(response.headers.get("content-disposition"), /attachment/);
    assert.deepEqual(
      Buffer.from(await response.arrayBuffer()),
      Buffer.from(source),
    );
    assert.equal((await input("bob")).status, 404);
    assert.equal((await input("none")).status, 401);
    assert.equal(
      (
        await skills.handle(
          new Request(`http://app.test/api/skill-runs/${run.id}`, {
            method: "DELETE",
          }),
          "alice",
        )
      ).status,
      200,
    );
    assert.equal((await input("alice")).status, 404);
  }));

test("deleting Word drafts cannot reset daily model attempts or reuse a deleted paid request; owner and plan isolation hold", async () =>
  withServices(async ({ service, api }) => {
    const savedFetch = global.fetch,
      savedKey = process.env.AI_API_KEY;
    process.env.AI_API_KEY = "test-only-not-a-secret";
    let calls = 0;
    global.fetch = async () => {
      calls++;
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"sections":[]}' } }],
        }),
      );
    };
    try {
      const plan = service.create("alice", planInput("documents"));
      const other = service.create("alice", planInput("documents"));
      const input = {
        requestId: randomUUID(),
        externalConsent: true,
        title: "配额测试",
        audience: "内部核对",
        sourceName: "fact.txt",
        sourceText: "只有明确提供的原始材料。",
        documentType: "business-report",
      };
      await assert.rejects(
        () => service.wordDraft("alice", plan.id, input),
        /章节结构/,
      );
      assert.equal(calls, 1);
      assert.equal(service.removeWordDrafts("alice", other.id), 0);
      assert.throws(() => service.removeWordDrafts("bob", plan.id), /没有这份/);
      assert.equal(
        (
          await api(
            new Request(
              `http://app.test/api/expert-task-plans/${plan.id}/word-draft`,
              { method: "DELETE", headers: { "x-owner": "bob" } },
            ),
          )
        ).status,
        404,
      );
      const deleted = await api(
        new Request(
          `http://app.test/api/expert-task-plans/${plan.id}/word-draft`,
          { method: "DELETE", headers: { "x-owner": "alice" } },
        ),
      );
      assert.equal(deleted.status, 200);
      assert.equal(service.removeWordDrafts("alice", plan.id), 0);
      await assert.rejects(
        () => service.wordDraft("alice", plan.id, input),
        /草稿已删除/,
      );
      assert.equal(calls, 1);
      for (let n = 1; n < 20; n++) {
        await assert.rejects(
          () =>
            service.wordDraft("alice", plan.id, {
              ...input,
              requestId: randomUUID(),
            }),
          /章节结构/,
        );
        assert.equal(service.removeWordDrafts("alice", plan.id), 1);
      }
      assert.equal(calls, 20);
      await assert.rejects(
        () =>
          service.wordDraft("alice", plan.id, {
            ...input,
            requestId: randomUUID(),
          }),
        /调用上限/,
      );
      assert.equal(calls, 20);
      const bob = service.create("bob", planInput("documents"));
      await assert.rejects(
        () =>
          service.wordDraft("bob", bob.id, {
            ...input,
            requestId: randomUUID(),
          }),
        /章节结构/,
      );
      assert.equal(calls, 21);
    } finally {
      global.fetch = savedFetch;
      if (savedKey === undefined) delete process.env.AI_API_KEY;
      else process.env.AI_API_KEY = savedKey;
    }
  }));

test("Word draft storage ceiling blocks before a model call and deleting a plan's drafts releases storage only", async () =>
  withServices(async ({ service }) => {
    const savedFetch = global.fetch,
      savedKey = process.env.AI_API_KEY;
    process.env.AI_API_KEY = "test-only-not-a-secret";
    let calls = 0;
    global.fetch = async () => {
      calls++;
      throw new Error("must not call model");
    };
    try {
      const plan = service.create("alice", planInput("documents"));
      // Seed old stored drafts without using today's attempts: independent storage and call ceilings.
      for (let n = 0; n < 100; n++)
        service.db
          .prepare("INSERT INTO expert_word_drafts VALUES(?,?,?,?,?)")
          .run(
            "alice",
            randomUUID(),
            "fixture",
            JSON.stringify({ state: "failed", planId: plan.id }),
            Date.now() - 172800000,
          );
      await assert.rejects(
        () =>
          service.wordDraft("alice", plan.id, {
            requestId: randomUUID(),
            externalConsent: true,
            title: "保存上限",
            audience: "测试",
            sourceName: "fact.txt",
            sourceText: "真实原文",
            documentType: "business-report",
          }),
        /已保存100份/,
      );
      assert.equal(calls, 0);
      assert.equal(service.removeWordDrafts("alice", plan.id), 100);
      assert.equal(
        service.db
          .prepare("SELECT count(*) AS n FROM expert_word_drafts WHERE owner=?")
          .get("alice").n,
        0,
      );
    } finally {
      global.fetch = savedFetch;
      if (savedKey === undefined) delete process.env.AI_API_KEY;
      else process.env.AI_API_KEY = savedKey;
    }
  }));

for (const [productId, fields, expectedArtifact] of [
  [
    "brand",
    {
      brandName: "合成品牌",
      description: "只用于执行验证，不是客户项目。",
      concept: "清晰自然",
      tagline: "让信息容易理解",
      voice: "明确",
      logoShape: "seed",
      primary: "#294C3B",
      secondary: "#F4F1E9",
      accent: "#D2744C",
    },
    "css-audit.json",
  ],
  [
    "web",
    {
      title: "专家网页样例",
      description: "合成执行测试",
      language: "zh-CN",
      primary: "#335C4A",
      surface: "#F5F4EF",
      text: "#202720",
      accent: "#D8774A",
      heroTitle: "保留实际执行证据",
      heroEyebrow: "TEST",
      heroBody: "依据实际输入制作，未部署。",
      heroButton: "了解服务",
      featuresTitle: "实际服务",
      navFeatures: "服务",
      contactTitle: "联系我们",
      contactBody: "合成测试联系信息。",
      contactEmail: "studio@example.com",
      navContact: "联系",
      rows: [{ title: "静态页面", body: "不代表后端已构建。" }],
    },
    "html-audit.json",
  ],
  [
    "projects",
    {
      project: "专家项目规格测试",
      owner: "",
      problem: "需求散落",
      goals: "集中展示真实范围",
      nonGoals: "不安排未确认工期",
      priority: "should",
      rows: [{ title: "展示项目范围", check: "页面包含范围外事项" }],
    },
    "product-spec.md",
  ],
])
  test(`expert-owned ${productId} delivery dispatches actual registered steps and preserves pending human acceptance`, async () =>
    withServices(async ({ service, skills, workflows }) => {
      const plan = service.create("alice", planInput(productId));
      const request = new Request(
        `http://app.test/api/expert-task-plans/${plan.id}/execute`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-expert-approval": plan.approvalDigest,
            "x-expert-request": randomUUID(),
          },
          body: JSON.stringify({ fields, consent: true }),
        },
      );
      const response = await service.execute(
        "alice",
        plan.id,
        request,
        skills,
        workflows,
      );
      assert.equal(response.status, 202);
      const { run } = await response.json();
      const finished = await workflows.waitFor("alice", run.id);
      assert.equal(
        finished.status,
        "succeeded",
        JSON.stringify(finished.steps),
      );
      assert.equal(finished.parentTaskId, plan.taskId);
      assert.equal(
        finished.delivery.commercialAcceptance,
        "pending-human-review",
      );
      assert.ok(finished.steps.every((s) => s.skillRunId));
      assert.ok(
        finished.steps.some((s) =>
          s.outputs.some((a) => a.name === expectedArtifact),
        ),
      );
      assert.equal(
        service.list("alice", plan.taskId).executions[0].runId,
        finished.id,
      );
      assert.equal(workflows.get("bob", run.id), null);
    }));

test("quality expert audits actual HTML and returns a real report without claiming certification", async () =>
  withServices(async ({ service, skills }) => {
    const plan = service.create("alice", planInput("quality"));
    const initial = skillRequest(plan);
    const form = await initial.formData();
    const headers = new Headers(initial.headers);
    headers.delete("content-type");
    form.set(
      "file",
      new File(
        [
          '<!doctype html><html lang="zh-CN"><head><title>合成审核样例</title></head><body><main><h1>实际待检查页面</h1><p>仅自动检查，不是无障碍认证。</p></main></body></html>',
        ],
        "actual-page.html",
      ),
    );
    const run = await (
      await service.execute(
        "alice",
        plan.id,
        new Request(initial.url, {
          method: "POST",
          headers,
          body: form,
        }),
        skills,
      )
    ).json();
    const finished = await waitSkill(skills, run.id);
    assert.equal(finished.status, "succeeded", finished.error);
    const artifact = finished.artifacts.find(
      (a) => a.name === "html-audit.json",
    );
    assert.ok(artifact);
    const report = await (
      await skills.handle(
        new Request(
          `http://app.test/api/skill-runs/${run.id}/artifacts/${artifact.id}`,
        ),
        "alice",
      )
    ).json();
    assert.equal(report.elements, 7);
    assert.equal(
      service.list("alice", plan.taskId).executions[0].runId,
      run.id,
    );
  }));
