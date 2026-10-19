const { test } = require("node:test");
const assert = require("node:assert/strict");
const { requestAI } = require("../../dist/local/server/api/ai.js");

test("AI fails closed without configured credentials, for normal and server-only requests", async () => {
  const before = {
    ai: process.env.AI_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    fetch: global.fetch,
  };
  delete process.env.AI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  let calls = 0;
  global.fetch = async () => {
    calls++;
    throw Error("No provider request should be attempted");
  };
  try {
    for (const serverConfigurationOnly of [false, true]) {
      await assert.rejects(
        requestAI({
          userId: "configuration-test",
          prompt: "Test only",
          serverConfigurationOnly,
        }),
        /AI provider is not configured/,
      );
    }
    assert.equal(calls, 0);
  } finally {
    global.fetch = before.fetch;
    for (const [name, value] of [
      ["AI_API_KEY", before.ai],
      ["OPENAI_API_KEY", before.openai],
    ]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
