const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const {
  fetchProviderQuota,
  mapModelOptions,
  classifyProviderError,
  readUsage,
  modelCatalog,
  providerForBaseUrl,
  PROTOCOL,
} = require("../../dist/local/server/api/model-registry.js");
const { TaskBackend } = require("../../dist/local/server/api/task-backend.js");
const { handleAiRegistry } = require("../../dist/local/server/api/ai-models.js");

function withBackend(run) {
  const directory = mkdtempSync(join(tmpdir(), "ai-usage-"));
  const backend = new TaskBackend(join(directory, "tasks.sqlite"));
  return Promise.resolve(run(backend)).finally(() => {
    backend.close();
    rmSync(directory, { recursive: true, force: true });
  });
}

const get = (path) => new Request(`http://local${path}`, { method: "GET" });

test("platform options are mapped onto the wire names of the implemented protocol", () => {
  const mapped = mapModelOptions({ temperature: 0.2, maxTokens: 512, topP: 0.9, responseFormat: "json_object" });
  assert.deepEqual(mapped.body, { temperature: 0.2, max_tokens: 512, top_p: 0.9, response_format: "json_object" });
  assert.deepEqual(mapped.dropped, []);
});

test("an option the provider cannot carry is reported instead of silently dropped", () => {
  const mapped = mapModelOptions({ temperature: 0.2, topP: 0.9 }, ["temperature"]);
  assert.deepEqual(mapped.body, { temperature: 0.2 });
  assert.deepEqual(mapped.dropped, ["topP"]);
});

test("out of range option values are rejected and reported", () => {
  const mapped = mapModelOptions({ temperature: 9, maxTokens: 0, topP: 3, responseFormat: "text" });
  assert.deepEqual(mapped.body, {});
  assert.deepEqual(mapped.dropped.sort(), ["maxTokens", "responseFormat", "temperature", "topP"]);
});

test("provider failures are classified with an actionable message", () => {
  assert.equal(classifyProviderError(401, "bad key").kind, "auth");
  assert.equal(classifyProviderError(429, "slow down").kind, "rate_limit");
  assert.equal(classifyProviderError(402, "no credit").kind, "quota");
  assert.equal(classifyProviderError(404, "no such model").kind, "model");
  assert.equal(classifyProviderError(400, "bad field").kind, "bad_request");
  assert.equal(classifyProviderError(503, "oops").kind, "server");
  assert.equal(classifyProviderError(null, "ECONNRESET").kind, "network");
  assert.match(classifyProviderError(401, "x").message, /凭据/);
});

test("usage is only reported when the provider actually reported it", () => {
  const reported = readUsage({ usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 } });
  assert.equal(reported.reported, true);
  assert.equal(reported.totalTokens, 30);
  const missing = readUsage({ choices: [] });
  assert.equal(missing.reported, false);
  assert.equal(missing.totalTokens, null);
  const partial = readUsage({ usage: { prompt_tokens: 5 } });
  assert.equal(partial.reported, true);
  assert.equal(partial.completionTokens, null);
  assert.equal(partial.totalTokens, 5);
});

test("the registered catalog is marked unverified until a provider answers", () => {
  const catalog = modelCatalog();
  assert.ok(catalog.length >= 6);
  assert.equal(catalog.every((item) => item.verified === false), true);
  // The platform does not invent context windows or capabilities.
  assert.equal(catalog.every((item) => item.contextWindow === null), true);
  assert.equal(catalog.every((item) => item.acceptsImages === null), true);
  assert.equal(PROTOCOL, "openai-compatible");
  assert.equal(providerForBaseUrl("https://api.deepseek.com/v1/"), "deepseek");
  assert.equal(providerForBaseUrl("https://models.internal.example/v1"), "custom");
});

test("model usage is recorded per owner and never crosses owners", async () => {
  await withBackend((backend) => {
    backend.recordAiUsage("owner-a", {
      model: "gpt-4o-mini", provider: "openai", promptTokens: 10, completionTokens: 20, totalTokens: 30,
      reported: true, latencyMs: 120, status: "succeeded",
    });
    backend.recordAiUsage("owner-a", {
      model: "gpt-4o-mini", provider: "openai", promptTokens: null, completionTokens: null, totalTokens: null,
      reported: false, latencyMs: 30, status: "failed", error: "限流",
    });
    backend.recordAiUsage("owner-b", {
      model: "gpt-4o-mini", provider: "openai", promptTokens: 1, completionTokens: 1, totalTokens: 2,
      reported: true, latencyMs: 10, status: "succeeded",
    });

    const mine = backend.listAiUsage("owner-a");
    assert.equal(mine.length, 2);
    assert.equal(mine[0].status, "failed");
    assert.equal(mine[1].totalTokens, 30);
    assert.equal(backend.listAiUsage("owner-b").length, 1);
    assert.equal(backend.listAiUsage("owner-c").length, 0);
  });
});

test("the model registry endpoint tells the truth about what is verified", async () => {
  await withBackend(async (backend) => {
    const previousKey = process.env.AI_API_KEY;
    const previousOpenAi = process.env.OPENAI_API_KEY;
    delete process.env.AI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const response = await handleAiRegistry(get("/api/ai/models?verify=1"), "owner-a", backend);
      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.equal(payload.configured, false);
      assert.equal(payload.catalog.every((item) => item.verified === false), true);
      assert.match(payload.live.error, /没有配置/);
      assert.match(payload.note, /未经核验/);
    } finally {
      if (previousKey !== undefined) process.env.AI_API_KEY = previousKey;
      if (previousOpenAi !== undefined) process.env.OPENAI_API_KEY = previousOpenAi;
    }
  });
});

test("the usage endpoint only sums the calls the provider actually reported", async () => {
  await withBackend(async (backend) => {
    backend.recordAiUsage("owner-a", {
      model: "gpt-4o-mini", provider: "openai", promptTokens: 10, completionTokens: 20, totalTokens: 30,
      reported: true, latencyMs: 120, status: "succeeded",
    });
    backend.recordAiUsage("owner-a", {
      model: "gpt-4o-mini", provider: "openai", promptTokens: null, completionTokens: null, totalTokens: null,
      reported: false, latencyMs: 30, status: "failed", error: "限流",
    });
    const response = await handleAiRegistry(get("/api/ai/usage"), "owner-a", backend);
    const payload = await response.json();
    assert.equal(payload.totals.calls, 2);
    assert.equal(payload.totals.reportedCalls, 1);
    assert.equal(payload.totals.failedCalls, 1);
    assert.equal(payload.totals.totalTokens, 30);
    assert.match(payload.note, /未回报的不会被估算/);

    const other = await (await handleAiRegistry(get("/api/ai/usage"), "owner-b", backend)).json();
    assert.equal(other.totals.calls, 0);
  });
});

test("a quota probe without credentials reports the missing key instead of a balance", async () => {
  const probe = await fetchProviderQuota("deepseek", "");
  assert.equal(probe.balance, null);
  assert.equal(probe.unit, null);
  assert.match(probe.error, /没有配置模型凭据/);
});

test("a provider without a known quota endpoint says so plainly", async () => {
  const probe = await fetchProviderQuota("mistral", "test-only-key");
  assert.equal(probe.supported, false);
  assert.equal(probe.balance, null);
  assert.match(probe.detail, /没有公开的额度查询接口/);
});

test("the quota endpoint refuses to invent a balance without credentials", async () => {
  await withBackend(async (backend) => {
    const previousKey = process.env.AI_API_KEY;
    const previousOpenAi = process.env.OPENAI_API_KEY;
    delete process.env.AI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const response = await handleAiRegistry(get("/api/ai/quota"), "owner-a", backend);
      const payload = await response.json();
      assert.equal(payload.balance, null);
      assert.match(payload.error, /没有配置模型凭据/);
    } finally {
      if (previousKey !== undefined) process.env.AI_API_KEY = previousKey;
      if (previousOpenAi !== undefined) process.env.OPENAI_API_KEY = previousOpenAi;
    }
  });
});

test("unknown registry routes answer with 404 and writes are refused", async () => {
  await withBackend(async (backend) => {
    assert.equal((await handleAiRegistry(get("/api/ai/nope"), "owner-a", backend)).status, 404);
    const post = await handleAiRegistry(new Request("http://local/api/ai/models", { method: "POST" }), "owner-a", backend);
    assert.equal(post.status, 405);
  });
});
