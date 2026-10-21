const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, rmSync, writeFileSync, existsSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const { AgentRuntime, InMemoryAgentTaskStore } = require("../../dist/local/packages/ai-core/runtime/AgentRuntime.js");
const { ModelRouter } = require("../../dist/local/packages/ai-core/providers/ModelRouter.js");
const { ProviderError } = require("../../dist/local/packages/ai-core/providers/ModelProvider.js");
const { analyzeDesignProject, analyzeWorkspaceArchitecture } = require("../../dist/local/server/agent/analyzer.js");
const { MemoryEngine } = require("../../dist/local/server/agent/memory-engine.js");
const { buildDeterministicPlan, validatePlanDag } = require("../../dist/local/server/agent/planner-engine.js");
const { runProjectQA, computeProjectDiff } = require("../../dist/local/server/agent/qa-agent.js");
const { AgentOrchestrator, SqliteAgentTaskStore } = require("../../dist/local/server/agent/orchestrator.js");
const { createAgentHubHandler } = require("../../dist/local/server/api/agent-hub.js");
const { ProjectVersionStore } = require("../../dist/local/server/api/project-versions.js");
const { runAgentOnProject, assertIsolatedWorkspaceRoot } = require("../../dist/local/server/agent/project-runner.js");
const { runtimeCatalog } = require("../../dist/local/server/skills/runtime-catalog.js");

test("AgentRuntime persists across restarts via SQLite store, retries retryable errors and supports cancellation", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "agent-rt-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const { DatabaseSync } = require("node:sqlite");
  const dbPath = join(dir, "rt.sqlite");
  const firstDb = new DatabaseSync(dbPath);
  const firstStore = new SqliteAgentTaskStore(firstDb);

  // Simulate crash mid-flight: persisted task left in `running` state
  firstStore.put({
    id: "crashed-task",
    ownerId: "alice",
    input: "fix layout",
    status: "running",
    createdAt: Date.now() - 5000,
    updatedAt: Date.now() - 5000,
    execution: [],
  });
  firstDb.close();

  const secondDb = new DatabaseSync(dbPath);
  t.after(() => secondDb.close());
  const store = new SqliteAgentTaskStore(secondDb);

  // Booting a new AgentRuntime must recover phantom `running` tasks instead of leaving hung state
  let attempts = 0;
  const router = new ModelRouter({
    models: [{ id: "gpt-test", name: "GPT Test", provider: "openai", capabilities: ["chat"], contextWindow: 8192 }],
  });
  router.registerProvider({
    id: "openai",
    config: {},
    async complete() {
      attempts += 1;
      if (attempts === 1) {
        throw new ProviderError("Temporary upstream 429", "openai", 429, true);
      }
      return {
        id: "resp-1",
        provider: "openai",
        model: "gpt-test",
        content: "recovered response",
        latencyMs: 12,
        usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18, estimated: false },
      };
    },
  });

  const runtime = new AgentRuntime({ modelRouter: router, store, defaultMaxRetries: 2, retryDelayMs: 5 });
  const recovered = runtime.getTask("crashed-task");
  assert.equal(recovered.status, "failed");
  assert.match(recovered.error, /interrupted by process restart/);

  // Retryable provider failure succeeds on second attempt and records both attempts
  runtime.createTask({ id: "retry-task", ownerId: "alice", idempotencyKey: "idem-1", input: "hello" });
  const duplicate = runtime.createTask({ id: "retry-task-dup", ownerId: "alice", idempotencyKey: "idem-1", input: "hello" });
  assert.equal(duplicate.id, "retry-task", "idempotency key returns existing task");

  const done = await runtime.run("retry-task");
  assert.equal(done.status, "completed");
  assert.equal(done.attempts, 2);
  assert.equal(done.execution.length, 2);
  assert.equal(done.execution[0].status, "failed");
  assert.equal(done.execution[1].status, "succeeded");

  // Cancellation aborts an in-flight call cleanly
  const slowRouter = new ModelRouter({
    models: [{ id: "slow", name: "Slow", provider: "openai", capabilities: ["chat"], contextWindow: 8192 }],
  });
  slowRouter.registerProvider({
    id: "openai",
    config: {},
    complete: () => new Promise(() => {}),
  });
  const cancellable = new AgentRuntime({ modelRouter: slowRouter, store });
  cancellable.createTask({ id: "cancel-me", ownerId: "alice", input: "long work" });
  const pending = cancellable.run("cancel-me");
  setTimeout(() => cancellable.cancel("cancel-me"), 15);
  await assert.rejects(pending, /cancelled/);
  assert.equal(cancellable.getTask("cancel-me").status, "cancelled");
});

test("project-runner blocks protected source paths, isolates concurrent runs on the same project id, and validates syntax", async (t) => {
  const sandboxRoot = mkdtempSync(join(tmpdir(), "proj-runner-"));
  t.after(() => rmSync(sandboxRoot, { recursive: true, force: true }));

  // Protected source directories must never be accepted as mutable agent workspaces
  assert.throws(() => assertIsolatedWorkspaceRoot("."), /Refusing to use repository root/);
  assert.throws(() => assertIsolatedWorkspaceRoot("./server"), /protected source directory/);
  assert.throws(() => assertIsolatedWorkspaceRoot("./data"), /dedicated subdirectory/);

  const project = {
    id: "proj-concurrent",
    ownerId: "alice",
    name: "Concurrent Demo",
    files: [
      { path: "index.html", content: "<!doctype html><html><head><title>Demo</title></head><body></body></html>", language: "html" },
      { path: "app.js", content: "export const version = 0;\n", language: "javascript" },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Run two concurrent executions against the SAME project id with overlapping async work
  const seenCwds = [];
  const [resA, resB] = await Promise.all([
    runAgentOnProject(project, "codex", "update A", sandboxRoot, {
      executor: async (_agent, _prompt, cwd) => {
        seenCwds.push(cwd);
        await new Promise((r) => setTimeout(r, 30));
        assert.equal(existsSync(join(cwd, "app.js")), true, "workspace files stay intact while sibling run executes");
        writeFileSync(join(cwd, "app.js"), "export const version = 1;\n", "utf8");
        return { agent: "codex", output: "ok A", exitCode: 0 };
      },
    }),
    runAgentOnProject(project, "codex", "update B", sandboxRoot, {
      executor: async (_agent, _prompt, cwd) => {
        seenCwds.push(cwd);
        writeFileSync(join(cwd, "app.js"), "export const version = 2;\n", "utf8");
        return { agent: "codex", output: "ok B", exitCode: 0 };
      },
    }),
  ]);

  assert.notEqual(seenCwds[0], seenCwds[1], "each run gets a unique per-run directory");
  assert.deepEqual(resA.diff.modified, ["app.js"]);
  assert.deepEqual(resB.diff.modified, ["app.js"]);
  assert.equal(existsSync(seenCwds[0]), false, "ephemeral run directory is cleaned up after exit");

  // Broken JS syntax produced by an agent run is caught before overwriting user project state
  await assert.rejects(
    () =>
      runAgentOnProject(project, "codex", "break syntax", sandboxRoot, {
        executor: async (_agent, _prompt, cwd) => {
          writeFileSync(join(cwd, "app.js"), "function broken( {", "utf8");
          return { agent: "codex", output: "bad js", exitCode: 0 };
        },
      }),
    /Post-run syntax verification failed/,
  );
});

test("ProjectAnalyzer, PlannerAgent, MemoryEngine, QAAgent and HTTP AgentHub work end-to-end with strict isolation & rollback", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "agent-hub-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  // 1. Live workspace architecture graph accurately classifies canonical vs bridged/coupled layers after skeleton cleanup
  const arch = analyzeWorkspaceArchitecture();
  assert.ok(arch.totalSourceFiles > 350);
  assert.equal(arch.layers.find((l) => l.layer === "apps/web/src").classification, "canonical-active");
  assert.equal(arch.layers.find((l) => l.layer === "frontend/workspace").classification, "active-coupled");
  assert.equal(arch.layers.find((l) => l.layer === "packages/ai-core").classification, "bridged-core");

  // 2. ProjectAnalyzer detects broken references, missing viewport, eval() and module cycles
  const sampleAnalysis = analyzeDesignProject({
    id: "p1",
    name: "Broken App",
    files: [
      { path: "index.html", content: '<html><body><img src="missing.png"><script src="a.js"></script></body></html>' },
      { path: "a.js", content: 'import "./b.js"; eval("1+1");' },
      { path: "b.js", content: 'import "./a.js"; export const x = 1;' },
    ],
  });
  assert.ok(sampleAnalysis.cycles.length >= 1, "detects JS cycle a.js <-> b.js");
  assert.ok(sampleAnalysis.risks.some((r) => r.category === "security"), "detects eval()");
  assert.ok(sampleAnalysis.risks.some((r) => r.category === "broken-reference"), "detects missing.png");

  // 3. Planner DAG validator rejects cyclic step graphs
  const plan = buildDeterministicPlan("添加价格对比与响应式导航", sampleAnalysis, []);
  assert.equal(validatePlanDag(plan.steps), null);
  assert.match(
    validatePlanDag([{ ...plan.steps[0], dependsOn: ["step-analyze"] }]),
    /循环依赖/,
  );

  // 4. Full HTTP end-to-end orchestration + Memory isolation + QA + 1-click Rollback
  const storeMap = new Map();
  const projectsRepo = {
    listByOwner: async (ownerId) => [...storeMap.values()].filter((e) => e.ownerId === ownerId).map((e) => e.project),
    getById: async (ownerId, id) => {
      const entry = storeMap.get(id);
      return entry && entry.ownerId === ownerId ? entry.project : null;
    },
    findById: async (id) => storeMap.get(id) ?? null,
    save: async (ownerId, proj) => {
      const cloned = structuredClone(proj);
      storeMap.set(proj.id, { ownerId, project: cloned });
      return cloned;
    },
    delete: async (_ownerId, id) => storeMap.delete(id),
  };
  await projectsRepo.save("user-alice", {
    id: "proj-1",
    name: "Studio Landing",
    prompt: "Studio landing page",
    status: "draft",
    files: [
      { path: "index.html", content: "<!doctype html><html><head></head><body><h1>Initial</h1></body></html>", language: "html" },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const versions = new ProjectVersionStore(join(dir, "versions.sqlite"));
  const orchestrator = new AgentOrchestrator(join(dir, "agent.sqlite"));
  t.after(() => {
    versions.close();
    orchestrator.close();
  });
  const hub = createAgentHubHandler({ orchestrator, projects: projectsRepo, versions });

  const call = (path, method, owner, body, headers = {}) =>
    hub(
      new Request(`http://local${path}`, {
        method,
        headers: { "Content-Type": "application/json", ...headers },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
      owner,
    );

  // Save a pinned color constraint for Alice's project
  const memCreate = await call("/api/agent-core/memories", "POST", "user-alice", {
    projectId: "proj-1",
    category: "constraint",
    title: "品牌主色",
    content: "主色调必须采用 #2a6f97 深海蓝",
    pinned: true,
  });
  assert.equal(memCreate.status, 201);
  const { memory } = await memCreate.json();

  // Bob cannot see or delete Alice's memories or run against Alice's project
  assert.equal((await (await call("/api/agent-core/memories", "GET", "user-bob")).json()).memories.length, 0);
  assert.equal((await call(`/api/agent-core/memories/${memory.id}`, "DELETE", "user-bob")).status, 404);
  assert.equal(
    (await call("/api/agent-core/runs", "POST", "user-bob", { projectId: "proj-1", goal: "tamper" })).status,
    403,
  );

  // Alice executes a full Analyzer -> Planner -> Designer/Coder -> QA run
  const runRes = await call(
    "/api/agent-core/runs",
    "POST",
    "user-alice",
    { projectId: "proj-1", goal: "增加核心能力展示模块并套用品牌色" },
    { "Idempotency-Key": "run-key-001" },
  );
  assert.equal(runRes.status, 200);
  const { run } = await runRes.json();
  assert.equal(run.status, "succeeded");
  assert.equal(run.qaReport.passed, true);
  assert.ok(run.steps.every((s) => s.status === "succeeded"));

  const updatedProject = await projectsRepo.getById("user-alice", "proj-1");
  assert.ok(updatedProject.files.some((f) => f.path === "styles.css" && f.content.includes("#2a6f97")));
  assert.ok(updatedProject.files.find((f) => f.path === "index.html").content.includes('name="viewport"'));

  // Re-submitting with the same Idempotency-Key does not duplicate execution
  const dupRes = await call(
    "/api/agent-core/runs",
    "POST",
    "user-alice",
    { projectId: "proj-1", goal: "增加核心能力展示模块并套用品牌色" },
    { "Idempotency-Key": "run-key-001" },
  );
  assert.equal((await dupRes.json()).run.id, run.id);

  // 1-click rollback restores the exact initial baseline files and records version history
  const rbRes = await call(`/api/agent-core/runs/${run.id}/rollback`, "POST", "user-alice", {});
  assert.equal(rbRes.status, 200);
  const rolledBack = await projectsRepo.getById("user-alice", "proj-1");
  assert.equal(rolledBack.files.length, 1);
  assert.equal(rolledBack.files[0].content, "<!doctype html><html><head></head><body><h1>Initial</h1></body></html>");
  assert.ok(versions.list("proj-1").length >= 2);

  // 5. Human-in-the-loop pause gate (waiting_approval -> staged edit QA check -> approve / reject)
  const hitlRes = await call("/api/agent-core/runs", "POST", "user-alice", {
    projectId: "proj-1",
    goal: "添加双列产品方案模块",
    pauseBeforeApply: true,
  });
  assert.equal(hitlRes.status, 200);
  const { run: hitlRun } = await hitlRes.json();
  assert.equal(hitlRun.status, "waiting_approval");
  assert.equal(hitlRun.awaitingApproval, true);
  // Live project MUST remain untouched while staged in waiting_approval
  const stillBaseline = await projectsRepo.getById("user-alice", "proj-1");
  assert.equal(stillBaseline.files.length, 1);
  assert.equal(stillBaseline.files[0].content, "<!doctype html><html><head></head><body><h1>Initial</h1></body></html>");

  // Broken manual JS override with eval() is blocked by QA before touching live project
  const badApprove = await call(`/api/agent-core/runs/${hitlRun.id}/approve`, "POST", "user-alice", {
    files: [{ path: "app.js", content: 'eval("bad");' }],
  });
  assert.equal(badApprove.status, 422);

  // Clean manual CSS override passes QA and atomically commits to live project + version store
  const customCss = hitlRun.resultFiles.find((f) => f.path === "styles.css").content + "\n/* human-approved-token */\n";
  const goodApprove = await call(`/api/agent-core/runs/${hitlRun.id}/approve`, "POST", "user-alice", {
    files: [{ path: "styles.css", content: customCss }],
    note: "审阅 Diff 后微调样式批准",
  });
  assert.equal(goodApprove.status, 200);
  const { run: approvedRun } = await goodApprove.json();
  assert.equal(approvedRun.status, "succeeded");
  assert.equal(approvedRun.awaitingApproval, false);
  const committedAfterHitl = await projectsRepo.getById("user-alice", "proj-1");
  assert.ok(committedAfterHitl.files.some((f) => f.path === "styles.css" && f.content.includes("human-approved-token")));

  // Reject path leaves project untouched and marks run cancelled
  const rejectCandidate = await (
    await call("/api/agent-core/runs", "POST", "user-alice", {
      projectId: "proj-1",
      goal: "待驳回草稿变更",
      pauseBeforeApply: true,
    })
  ).json();
  const rejectedRes = await call(`/api/agent-core/runs/${rejectCandidate.run.id}/reject`, "POST", "user-alice", {
    reason: "暂不合并此草稿",
  });
  assert.equal(rejectedRes.status, 200);
  assert.equal((await rejectedRes.json()).run.status, "cancelled");

  // 6. Skill 5-tier capabilityState verification
  const catalog = runtimeCatalog();
  assert.equal(catalog.length, 47);
  assert.ok(catalog.every((s) => ["ready", "needs_config", "needs_auth", "unavailable"].includes(s.capabilityState)));
  assert.equal(catalog.find((s) => s.id === "document.summarize").capabilityState, "needs_config");
});
