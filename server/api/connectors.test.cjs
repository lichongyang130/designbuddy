const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { createHmac } = require("node:crypto");
const { mkdtempSync, rmSync, readFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const { ConnectorService, ConnectorInputError, ConnectorNotConfiguredError } = require("../../dist/local/server/api/connectors.js");
const { connectorDefinitions } = require("../../dist/local/shared/connector-catalog.js");

const KEY = Buffer.alloc(32, 7);

function withService(run, options = {}) {
  const directory = mkdtempSync(join(tmpdir(), "connectors-"));
  const service = new ConnectorService(join(directory, "connectors.sqlite"), {
    encryptionKey: KEY,
    allowPrivateNetwork: true,
    ...options,
  });
  return Promise.resolve(run(service, directory)).finally(() => {
    service.close();
    rmSync(directory, { recursive: true, force: true });
  });
}

/** A real HTTP server: the probes in these tests really open a socket. */
async function startServer(handler) {
  const server = createServer(handler);
  await new Promise((accept) => server.listen(0, "127.0.0.1", accept));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((accept) => server.close(accept)),
  };
}

const json = (res, status, body, headers = {}) => {
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(JSON.stringify(body));
};

const request = (path, method = "GET", body, headers = {}) =>
  new Request(`http://local${path}`, {
    method,
    headers: { "content-type": "application/json", origin: "http://local", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

async function readJson(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

/** A fake fetch that only answers the routes a test explicitly declares. */
function routedFetch(routes) {
  return async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    const target = new URL(url);
    for (const [prefix, handler] of routes)
      if (target.href.startsWith(prefix) || target.host === prefix) return handler(target, init);
    throw new Error(`unexpected outbound request: ${url}`);
  };
}

// ---------------------------------------------------------------------------
// Mock remote services
// ---------------------------------------------------------------------------

function mcpStreamableServer(tools = ["search_docs", "create_page"]) {
  return startServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      let payload = {};
      try {
        payload = JSON.parse(raw || "{}");
      } catch {
        payload = {};
      }
      if (payload.method === "initialize")
        return json(res, 200, {
          jsonrpc: "2.0",
          id: payload.id,
          result: {
            protocolVersion: "2025-06-18",
            capabilities: { tools: {} },
            serverInfo: { name: "mock-mcp", version: "1.2.3" },
          },
        });
      if (payload.method === "tools/list")
        return json(res, 200, { jsonrpc: "2.0", id: payload.id, result: { tools: tools.map((name) => ({ name })) } });
      return json(res, 200, { jsonrpc: "2.0", id: payload.id, error: { code: -32601, message: "unknown method" } });
    });
  });
}

function mcpSseServer(tools = ["legacy_tool"]) {
  let stream = null;
  return startServer((req, res) => {
    if (req.method === "GET") {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
      res.write("event: endpoint\ndata: /messages?sessionId=abc\n\n");
      stream = res;
      return;
    }
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const payload = JSON.parse(raw || "{}");
      res.writeHead(202).end();
      if (!stream) return;
      const answer =
        payload.method === "initialize"
          ? {
              jsonrpc: "2.0",
              id: payload.id,
              result: {
                protocolVersion: "2024-11-05",
                capabilities: {},
                serverInfo: { name: "legacy-mcp", version: "0.9.0" },
              },
            }
          : { jsonrpc: "2.0", id: payload.id, result: { tools: tools.map((name) => ({ name })) } };
      stream.write(`event: message\ndata: ${JSON.stringify(answer)}\n\n`);
    });
  });
}

/** A DingTalk-style robot: it verifies the HMAC signature before answering. */
function webhookServer({ secret, style }) {
  const received = [];
  return {
    received,
    server: startServer((req, res) => {
      let raw = "";
      req.on("data", (chunk) => (raw += chunk));
      req.on("end", () => {
        const url = new URL(req.url, "http://127.0.0.1");
        received.push({ url: req.url, body: raw, search: url.searchParams });
        if (style === "dingtalk") {
          const timestamp = url.searchParams.get("timestamp") || "";
          const sign = url.searchParams.get("sign") || "";
          const expected = createHmac("sha256", secret)
            .update(`${timestamp}\n${secret}`)
            .digest("base64");
          if (sign !== expected) return json(res, 401, { errcode: 310000, errmsg: "sign not match" });
          return json(res, 200, { errcode: 0, errmsg: "ok" });
        }
        // WeCom style: the key identifies the bot, the body carries the message.
        if (!url.searchParams.get("key")) return json(res, 401, { errcode: 93000, errmsg: "invalid key" });
        return json(res, 200, { errcode: 0, errmsg: "ok" });
      });
    }),
  };
}

// ---------------------------------------------------------------------------

test("every built-in connector is listed, configurable and starts disconnected", async () => {
  await withService(async (service) => {
    const records = service.list("alice");
    assert.equal(records.length, connectorDefinitions.length);
    for (const definition of connectorDefinitions) {
      const record = records.find((item) => item.id === definition.id);
      assert.ok(record, `${definition.id} is missing from the list`);
      assert.equal(record.status, "disconnected");
      assert.equal(record.configured, false);
      assert.ok(record.authTypes.length >= 1, `${definition.id} has no auth type`);
      assert.ok(record.note.length > 0 && record.docsUrl.length > 0);
      assert.ok(!JSON.stringify(record).includes("secret"), `${definition.id} leaks something`);
    }
    // The catalogue is what the browser renders the form from.
    const catalog = service.catalog("alice");
    assert.equal(catalog.length, connectorDefinitions.length);
    const github = catalog.find((item) => item.id === "github");
    assert.deepEqual(github.authTypes, ["oauth", "api_key"]);
    assert.ok(github.fields.api_key.some((field) => field.key === "token"));
    assert.equal(github.oauthConfigured, false, "no OAuth app is configured in the test environment");
  });
});

test("a connection is only marked connected after the real API answers", async () => {
  const remote = await startServer((req, res) => {
    const ok = req.headers.authorization === "Bearer github_pat_secretvalue";
    if (!ok) return json(res, 401, { message: "Bad credentials" });
    return json(res, 200, { login: "alice-bot", id: 42 });
  });
  try {
    await withService(async (service, directory) => {
      // The catalogued probe URL is used, so point the definition at the mock.
      service.fetchImpl = routedFetch([["https://api.github.com/", (target, init) =>
        fetch(`${remote.url}${target.pathname}`, init)]]);

      // A wrong key is reported with the real remote answer.
      const failed = await service.test("alice", "github", { authType: "api_key", token: "nope" });
      assert.equal(failed.ok, false);
      assert.match(failed.detail, /Bad credentials|HTTP 401/);

      const connected = await service.connect("alice", "github", {
        authType: "api_key",
        token: "github_pat_secretvalue",
      });
      assert.equal(connected.result.ok, true);
      assert.match(connected.result.detail, /HTTP 200/);
      assert.equal(connected.record.status, "connected");
      assert.equal(connected.record.credentialHint, "…alue");

      const listed = service.list("alice").find((item) => item.id === "github");
      assert.equal(listed.status, "connected");
      assert.equal(listed.configured, true);
      assert.ok(listed.connectedAt);
      assert.ok(!JSON.stringify(listed).includes("github_pat_secretvalue"), "the browser must never see the token");

      // The database holds the credential encrypted, never in the clear.
      const raw = readFileSync(join(directory, "connectors.sqlite"));
      assert.equal(raw.includes("github_pat_secretvalue"), false, "plaintext token in the database");
      const db = new DatabaseSync(join(directory, "connectors.sqlite"));
      const row = db.prepare("SELECT credential FROM connector_connections WHERE connector_id='github'").get();
      db.close();
      assert.match(row.credential, /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    });
  } finally {
    await remote.close();
  }
});

test("a failed handshake never stores the credential and records the reason", async () => {
  const remote = await startServer((req, res) => json(res, 403, { errcode: 19001, errmsg: "invalid secret" }));
  try {
    await withService(async (service) => {
      service.fetchImpl = routedFetch([["https://api.notion.com/", (target, init) =>
        fetch(`${remote.url}${target.pathname}`, init)]]);
      const outcome = await service.connect("alice", "notion", { authType: "api_key", token: "secret_123456" });
      assert.equal(outcome.result.ok, false);
      assert.equal(outcome.record.status, "error");
      assert.match(outcome.record.lastError, /invalid secret/);
      const row = service.list("alice").find((item) => item.id === "notion");
      assert.equal(row.status, "error");
      assert.equal(row.credentialHint, undefined, "a rejected key is not kept");
      const events = service.events("alice", "notion");
      assert.equal(events[0].action, "connector.connect");
      assert.equal(events[0].ok, false);
    });
  } finally {
    await remote.close();
  }
});

test("MCP connectors really perform the initialize plus tools/list handshake", async () => {
  const streamable = await mcpStreamableServer();
  const sse = await mcpSseServer();
  try {
    await withService(async (service) => {
      const created = await service.create("alice", {
        name: "团队知识库",
        description: "用于团队资料检索",
        authType: "mcp",
        endpoint: `${streamable.url}/mcp`,
        transport: "streamable-http",
      });
      assert.equal(created.custom, true);
      assert.equal(created.status, "disconnected");

      const result = await service.connect("alice", created.id, { token: "mcp-token-abcdef" });
      assert.equal(result.result.ok, true);
      assert.match(result.result.detail, /mock-mcp 1\.2\.3/);
      assert.match(result.result.detail, /2 个工具/);
      assert.deepEqual(result.record.scopes, ["search_docs", "create_page"]);
      assert.equal(result.record.status, "connected");

      // The legacy HTTP+SSE transport is a different wire protocol, so it is
      // exercised against its own mock server.
      const legacy = await service.create("alice", {
        name: "legacy",
        authType: "mcp",
        endpoint: `${sse.url}/sse`,
        transport: "sse",
      });
      const legacyResult = await service.connect("alice", legacy.id, {});
      assert.equal(legacyResult.result.ok, true);
      assert.deepEqual(legacyResult.result.tools, ["legacy_tool"]);
      assert.match(legacyResult.result.detail, /legacy-mcp/);

      // A service that does not speak MCP at all is reported honestly.
      const notMcp = await startServer((req, res) => {
        res.writeHead(404, { "content-type": "text/html" });
        res.end("<h1>not an MCP server</h1>");
      });
      try {
        const broken = await service.create("alice", {
          name: "broken",
          authType: "mcp",
          endpoint: `${notMcp.url}/mcp`,
        });
        const brokenResult = await service.test("alice", broken.id, {});
        assert.equal(brokenResult.ok, false);
        assert.match(brokenResult.detail, /HTTP 404|无法解析|握手/);
        assert.equal(brokenResult.status, 404);
      } finally {
        await notMcp.close();
      }
    });
  } finally {
    await streamable.close();
    await sse.close();
  }
});

test("webhook connectors really deliver a correctly signed message", async () => {
  const secret = "SEC" + "0".repeat(29);
  const dingtalk = webhookServer({ secret, style: "dingtalk" });
  const wecom = webhookServer({ secret, style: "wecom" });
  const ding = await dingtalk.server;
  const we = await wecom.server;
  try {
    await withService(async (service) => {
      const result = await service.connect("alice", "dingtalk", {
        authType: "webhook",
        endpoint: `${ding.url}/robot/send`,
        secret,
      });
      assert.equal(result.result.ok, true);
      assert.match(result.result.detail, /已送达/);
      const delivered = dingtalk.received.at(-1);
      assert.ok(delivered, "the robot really received a request");
      const body = JSON.parse(delivered.body);
      assert.match(body.content.text, /DesignBuddy 连接器连通性测试/);
      const timestamp = delivered.search.get("timestamp");
      const expected = createHmac("sha256", secret).update(`${timestamp}\n${secret}`).digest("base64");
      assert.equal(delivered.search.get("sign"), expected);

      // A wrong signing secret is rejected by the remote and stays disconnected.
      const bad = await service.connect("alice", "dingtalk", {
        authType: "webhook",
        endpoint: `${ding.url}/robot/send`,
        secret: "wrong-secret-value",
      });
      assert.equal(bad.result.ok, false);
      assert.equal(bad.record.status, "error");

      // WeCom identifies the bot through the key in the URL.
      const ok = await service.connect("alice", "wecom", {
        authType: "webhook",
        endpoint: `${we.url}/cgi-bin/webhook/send?key=abc-123`,
      });
      assert.equal(ok.result.ok, true, ok.result.detail);
      assert.match(wecom.received.at(-1).url, /key=abc-123/);
    });
  } finally {
    await ding.close();
    await we.close();
  }
});

test("OAuth start builds a real provider URL and the callback exchanges, verifies and connects", async () => {
  const provider = await startServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    if (url.pathname === "/login/oauth/access_token")
      return json(res, 200, {
        access_token: "gho_realexchangedtoken",
        refresh_token: "ghr_refresh",
        scope: "repo,read:user",
        token_type: "bearer",
      });
    if (url.pathname === "/user") {
      if (req.headers.authorization !== "Bearer gho_realexchangedtoken")
        return json(res, 401, { message: "Bad credentials" });
      return json(res, 200, { login: "alice-bot", id: 7 });
    }
    return json(res, 404, { message: "not found" });
  });
  try {
    await withService(async (service, directory) => {
      const previousId = process.env.GITHUB_CLIENT_ID;
      const previousSecret = process.env.GITHUB_CLIENT_SECRET;
      process.env.GITHUB_CLIENT_ID = "Iv1.testclient";
      process.env.GITHUB_CLIENT_SECRET = "client-secret-value";
      try {
        // Without an OAuth app the server says so instead of pretending.
        delete process.env.GITHUB_CLIENT_ID;
        assert.throws(
          () => service.startOAuth("alice", "github", "/connectors/oauth", request("/api/connectors/oauth/start")),
          (error) =>
            error instanceof ConnectorNotConfiguredError && /GITHUB_CLIENT_ID/.test(error.message),
        );
        // Through HTTP the missing OAuth app is a 503, not a client error.
        const refused = await service.handle(
          request("/api/connectors/oauth/start", "POST", { connectorId: "github" }),
          "alice",
        );
        assert.equal(refused.status, 503);
        assert.equal((await readJson(refused)).code, "OAUTH_APP_NOT_CONFIGURED");
        process.env.GITHUB_CLIENT_ID = "Iv1.testclient";

        service.fetchImpl = routedFetch([
          ["https://github.com/login/oauth/", (target, init) => fetch(`${provider.url}${target.pathname}`, init)],
          ["https://api.github.com/", (target, init) => fetch(`${provider.url}${target.pathname}`, init)],
        ]);

        const started = service.startOAuth(
          "alice",
          "github",
          "/connectors/oauth",
          request("/api/connectors/oauth/start"),
        );
        const authorization = new URL(started.authorizationUrl);
        assert.equal(authorization.host, "github.com");
        assert.equal(authorization.pathname, "/login/oauth/authorize");
        assert.equal(authorization.searchParams.get("client_id"), "Iv1.testclient");
        assert.equal(authorization.searchParams.get("state"), started.state);
        assert.equal(authorization.searchParams.get("redirect_uri"), "http://local/api/connectors/oauth/callback");
        assert.match(authorization.searchParams.get("scope"), /repo/);

        const completed = await service.completeOAuth("the-authorization-code", started.state, "http://local/api/connectors/oauth/callback");
        assert.equal(completed.ok, true);
        assert.equal(completed.record.status, "connected");
        assert.deepEqual(completed.record.scopes, ["repo", "read:user"]);
        assert.equal(completed.returnTo, "/connectors/oauth");

        // The state is single use: a replayed callback cannot exchange again.
        await assert.rejects(
          () => service.completeOAuth("the-authorization-code", started.state, "http://local/api/connectors/oauth/callback"),
          /授权状态不存在或已被使用/,
        );

        const raw = readFileSync(join(directory, "connectors.sqlite"));
        assert.equal(raw.includes("gho_realexchangedtoken"), false, "the token must be encrypted at rest");

        // Disconnecting drops the credential; the provider is asked to revoke it.
        const disconnected = await service.disconnect("alice", "github");
        assert.equal(disconnected.status, "disconnected");
        assert.equal(disconnected.credentialHint, undefined);
        assert.equal(disconnected.connectedAt, undefined);
        const db = new DatabaseSync(join(directory, "connectors.sqlite"));
        const row = db.prepare("SELECT credential FROM connector_connections WHERE connector_id='github'").get();
        db.close();
        assert.equal(row.credential, null);
      } finally {
        if (previousId === undefined) delete process.env.GITHUB_CLIENT_ID;
        else process.env.GITHUB_CLIENT_ID = previousId;
        if (previousSecret === undefined) delete process.env.GITHUB_CLIENT_SECRET;
        else process.env.GITHUB_CLIENT_SECRET = previousSecret;
      }
    });
  } finally {
    await provider.close();
  }
});

test("an OAuth callback that fails verification does not create a connected state", async () => {
  const provider = await startServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    if (url.pathname === "/login/oauth/access_token")
      return json(res, 200, { access_token: "gho_token" });
    // The provider answers the API call with an error.
    return json(res, 401, { message: "Bad credentials" });
  });
  try {
    await withService(async (service) => {
      process.env.GITHUB_CLIENT_ID = "Iv1.testclient";
      process.env.GITHUB_CLIENT_SECRET = "client-secret-value";
      try {
        service.fetchImpl = routedFetch([
          ["https://github.com/login/oauth/", (target, init) => fetch(`${provider.url}${target.pathname}`, init)],
          ["https://api.github.com/", (target, init) => fetch(`${provider.url}${target.pathname}`, init)],
        ]);
        const started = service.startOAuth("alice", "github", "/connectors/oauth", request("/api/connectors/oauth/start"));
        const completed = await service.completeOAuth("code", started.state, "http://local/api/connectors/oauth/callback");
        assert.equal(completed.ok, false);
        assert.equal(completed.record.status, "error");
        assert.match(completed.record.lastError, /Bad credentials|HTTP 401/);
      } finally {
        delete process.env.GITHUB_CLIENT_ID;
        delete process.env.GITHUB_CLIENT_SECRET;
      }
    });
  } finally {
    await provider.close();
  }
});

test("connections belong to their owner and never cross accounts", async () => {
  await withService(async (service) => {
    await service.configure("alice", "tencent-meeting", {
      authType: "api_key",
      endpoint: "https://api.example.com/v1",
      secretId: "alice-id",
      secretKey: "alice-key-value",
    });
    const mine = service.list("alice").find((item) => item.id === "tencent-meeting");
    assert.equal(mine.configured, true);
    assert.equal(mine.endpoint, "https://api.example.com/v1");
    const theirs = service.list("bob").find((item) => item.id === "tencent-meeting");
    assert.equal(theirs.configured, false);
    assert.equal(theirs.status, "disconnected");
    assert.equal(service.events("bob", "tencent-meeting").length, 0);
  });
});

test("the HTTP routes guard CSRF, ownership and bad input", async () => {
  await withService(async (service) => {
    const list = await service.handle(request("/api/connectors"), "alice");
    assert.equal(list.status, 200);
    const records = await readJson(list);
    assert.equal(records.length, connectorDefinitions.length);

    const catalog = await service.handle(request("/api/connectors/catalog"), "alice");
    const body = await readJson(catalog);
    assert.equal(body.connectors.length, connectorDefinitions.length);

    // A cross-site write is refused before anything is stored.
    const crossSite = new Request("http://local/api/connectors", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://evil.example" },
      body: JSON.stringify({ name: "x" }),
    });
    const refused = await service.handle(crossSite, "alice");
    assert.equal(refused.status, 403);

    // Missing name, missing endpoint, and a secret in the URL are all refused.
    for (const payload of [
      { description: "no name" },
      { name: "没有地址" },
      { name: "带密钥", endpoint: "https://api.example.com/mcp?token=abc" },
      { name: "带账号", endpoint: "https://user:pass@api.example.com/mcp" },
      { name: "不是 https", endpoint: "ftp://api.example.com/mcp" },
    ]) {
      const response = await service.handle(request("/api/connectors", "POST", payload), "alice");
      assert.equal(response.status, 400, JSON.stringify(payload));
      const error = await readJson(response);
      assert.equal(error.code, "INVALID_INPUT");
    }

    const created = await service.handle(
      request("/api/connectors", "POST", {
        name: "自建 MCP",
        description: "内部服务",
        authType: "mcp",
        endpoint: "https://mcp.example.com/rpc",
        transport: "sse",
      }),
      "alice",
    );
    assert.equal(created.status, 201);
    const record = await readJson(created);
    assert.equal(record.transport, "sse");
    assert.equal(record.custom, true);

    // Built-in connectors cannot be deleted, only disconnected.
    const deleteBuiltIn = await service.handle(request("/api/connectors/github", "DELETE"), "alice");
    assert.equal(deleteBuiltIn.status, 400);

    const removed = await service.handle(request(`/api/connectors/${record.id}`, "DELETE"), "alice");
    assert.equal(removed.status, 200);
    assert.equal(service.list("alice").some((item) => item.id === record.id), false);

    // A connector that does not exist is a 404, not a silent success.
    const missing = await service.handle(request("/api/connectors/mcp-does-not-exist/configure", "POST", {}), "alice");
    assert.equal(missing.status, 404);
  });
});

test("outbound probes refuse private network targets unless an operator allows them", async () => {
  const remote = await startServer((req, res) => json(res, 200, { ok: true }));
  try {
    await withService(
      async (service) => {
        const port = new URL(remote.url).port;
        const probe = (endpoint) =>
          service.test("alice", "kling", {
            authType: "api_key",
            endpoint,
            accessKey: "ak",
            secretKey: "sk",
          });
        await assert.rejects(() => probe(`http://127.0.0.1:${port}/probe`), /HTTPS/);
        await assert.rejects(() => probe(`https://127.0.0.1:${port}/probe`), /保留网段/);
        await assert.rejects(() => probe("https://localhost/probe"), /内网/);
        await assert.rejects(() => probe("https://10.0.0.5/probe"), /保留网段/);
        await assert.rejects(() => probe("https://metadata.google.internal/probe"), /内网/);
        assert.equal(
          service.list("alice").find((item) => item.id === "kling").status,
          "disconnected",
          "a blocked probe must not leave a connection behind",
        );
      },
      { allowPrivateNetwork: false },
    );
  } finally {
    await remote.close();
  }
});

test("every built-in connector can be configured, tested, connected and disconnected", async () => {
  // One chameleon service: it answers MCP handshakes, webhook deliveries and
  // the documented API probes, so the whole catalogue can be exercised for real.
  const remote = await startServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      let body = {};
      try {
        body = JSON.parse(raw || "{}");
      } catch {
        body = {};
      }
      if (body.method === "initialize")
        return json(res, 200, {
          jsonrpc: "2.0",
          id: body.id,
          result: {
            protocolVersion: "2025-06-18",
            capabilities: { tools: {} },
            serverInfo: { name: "mock-service", version: "1.0.0" },
          },
        });
      if (body.method === "tools/list")
        return json(res, 200, {
          jsonrpc: "2.0",
          id: body.id,
          result: { tools: [{ name: "do_thing" }] },
        });
      return json(res, 200, {
        ok: true,
        errcode: 0,
        code: 0,
        id: 1,
        login: "mock-user",
        viewer: { id: "1", name: "mock-user", email: "mock@example.com" },
      });
    });
  });
  try {
    await withService(async (service) => {
      // Every catalogued provider host is answered by the local service.
      service.fetchImpl = async (input, init = {}) => {
        const target = typeof input === "string" ? new URL(input) : new URL(input.url);
        return fetch(`${remote.url}${target.pathname}${target.search}`, init);
      };
      for (const definition of connectorDefinitions) {
        for (const authType of definition.authTypes) {
          if (authType === "oauth") {
            // OAuth is exercised separately; here only the contract is checked.
            assert.ok(definition.oauth.authorizationUrl.startsWith("https://"), definition.id);
            assert.ok(definition.oauth.tokenUrl.startsWith("https://"), definition.id);
            assert.ok(definition.oauth.probe.url.startsWith("https://"), definition.id);
            assert.ok(definition.oauth.clientIdEnv && definition.oauth.clientSecretEnv, definition.id);
            continue;
          }
          const catalog = service.catalog("alice").find((item) => item.id === definition.id);
          const fields = catalog.fields[authType] ?? [];
          const body = { authType };
          for (const field of fields) {
            if (field.kind === "select") continue;
            if (field.key === "endpoint") body[field.key] = `${remote.url}/service`;
            else body[field.key] = `fixture-${field.key}-0123456789`;
          }
          const label = `${definition.id}/${authType}`;
          const saved = await service.configure("alice", definition.id, body);
          assert.equal(saved.status, "disconnected", label);
          const checked = await service.test("alice", definition.id, body);
          assert.equal(checked.ok, true, `${label}: ${checked.detail}`);
          const connected = await service.connect("alice", definition.id, body);
          assert.equal(connected.record.status, "connected", `${label}: ${connected.result.detail}`);
          // A masked tail is only expected where a secret was really collected
          // (a WeCom bot is identified by its URL, not by a signing secret).
          if (fields.some((field) => field.hintable))
            assert.ok(connected.record.credentialHint, `${label} should report a masked credential`);
          const listed = service.list("alice").find((item) => item.id === definition.id);
          assert.equal(listed.status, "connected", label);
          const disconnected = await service.disconnect("alice", definition.id);
          assert.equal(disconnected.status, "disconnected", label);
        }
      }
    });
  } finally {
    await remote.close();
  }
});

test("a custom connector keeps its configuration and can be configured again", async () => {
  await withService(async (service) => {
    const created = await service.create("alice", {
      name: "内部检索",
      description: "",
      authType: "mcp",
      endpoint: "https://mcp.example.com/rpc",
    });
    assert.equal(created.description, "自定义 MCP 连接器配置");
    const configured = await service.configure("alice", created.id, {
      authType: "mcp",
      endpoint: "https://mcp.example.com/v2/rpc",
      transport: "streamable-http",
      token: "token-value-1234",
    });
    assert.equal(configured.endpoint, "https://mcp.example.com/v2/rpc");
    assert.equal(configured.status, "disconnected", "saving a configuration is not a connection");
    assert.equal(configured.credentialHint, "…1234");
    // An empty password field keeps the credential already on the server.
    const kept = await service.configure("alice", created.id, { authType: "mcp" });
    assert.equal(kept.credentialHint, "…1234");
  });
});
