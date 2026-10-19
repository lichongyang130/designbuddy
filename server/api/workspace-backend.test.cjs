const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const { mkdtemp, mkdir } = require("node:fs/promises");
const { resolve } = require("node:path");
const { DatabaseSync } = require("node:sqlite");
async function boot(db, extraEnv = {}) {
  const env = {
    ...process.env,
    DESIGNBUDDY_HOST: "0.0.0.0",
    DESIGNBUDDY_PORT: "0",
    DESIGNBUDDY_SQLITE_PATH: db,
    DESIGNBUDDY_STORAGE: "sqlite",
    ...extraEnv,
  };
  for (const k of [
    "AI_API_KEY",
    "OPENAI_API_KEY",
    "DESIGNBUDDY_LOCAL_TOKEN",
    "DESIGNBUDDY_ENABLE_LOCAL_AGENT",
  ])
    delete env[k];
  const child = spawn(process.execPath, ["dist/local/server/local-daemon.js"], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  const base = await new Promise((accept, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(Error("startup timeout " + logs));
    }, 10000);
    child.stdout.on("data", (data) => {
      logs += data;
      const match = logs.match(/listening on 0\.0\.0\.0:(\d+)/);
      if (match) {
        clearTimeout(timer);
        accept("http://127.0.0.1:" + match[1]);
      }
    });
    child.stderr.on("data", (d) => (logs += d));
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(Error("exit " + code + " " + logs));
    });
  });
  return {
    base,
    stop: async () => {
      if (child.exitCode !== null) return;
      child.kill("SIGTERM");
      await once(child, "exit");
    },
  };
}
async function call(
  server,
  path,
  { method = "GET", body, cookie, origin, headers = {} } = {},
) {
  const http = require("node:http");
  const h = {
    ...(cookie ? { Cookie: cookie } : {}),
    ...(!["GET", "HEAD"].includes(method)
      ? { Origin: origin ?? server.base, "Content-Type": "application/json" }
      : {}),
    ...headers,
  };
  return new Promise((accept, reject) => {
    const req = http.request(
      server.base + path,
      { method, headers: h },
      (res) => {
        let text = "";
        res.on("data", (d) => (text += d));
        res.on("end", () => {
          try {
            assert.match(
              res.headers["content-type"] || "",
              /application\/json/,
            );
            const headers = new Headers();
            for (const [k, v] of Object.entries(res.headers))
              if (v) headers.set(k, Array.isArray(v) ? v.join(",") : v);
            accept({
              status: res.statusCode,
              data: JSON.parse(text),
              cookie: res.headers["set-cookie"]?.[0].split(";")[0],
              headers,
            });
          } catch (e) {
            reject(e);
          }
        });
      },
    );
    req.on("error", reject);
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

test("real HTTP: sessions, durable accounts/projects/templates, isolation, CAS, CSRF, restart and honest failures", async () => {
  await mkdir(".cache/backend-tests", { recursive: true });
  const dir = await mkdtemp(resolve(".cache/backend-tests/run-"));
  const db = resolve(dir, "state.sqlite");
  let server = await boot(db);
  try {
    assert.equal((await call(server, "/api/health")).data.ok, true);
    assert.equal((await call(server, "/api/projects")).status, 401);
    assert.equal((await call(server, "/api/skill-runtime")).status, 200, "read-only skill catalogue is visible before login");
    assert.equal((await call(server, "/api/skill-runs")).status, 401, "skill runs remain private until authenticated");
    assert.equal(
      (
        await call(server, "/api/local/session", {
          method: "POST",
          body: {},
          origin: "https://evil.example",
        })
      ).status,
      403,
    );
    const a = await call(server, "/api/local/session", {
        method: "POST",
        body: {},
      }),
      b = await call(server, "/api/local/session", {
        method: "POST",
        body: {},
      });
    assert.notEqual(a.data.user.id, b.data.user.id);
    let cookie = a.cookie;
    const snapshot = {
      revision: 0,
      state: { title: "持久化方案", frames: [{ title: "测试", duration: 4 }] },
    };
    assert.equal(
      (
        await call(server, "/api/templates/hyperframes/sample", {
          method: "PUT",
          cookie,
          body: snapshot,
        })
      ).data.revision,
      1,
    );
    assert.equal(
      (
        await call(server, "/api/templates/hyperframes/sample", {
          cookie: b.cookie,
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await call(server, "/api/templates/hyperframes/sample", {
          method: "PUT",
          cookie,
          body: snapshot,
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await call(server, "/api/templates/notreal/sample", {
          method: "PUT",
          cookie,
          body: snapshot,
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await call(server, "/api/templates/hyperframes/sample", {
          method: "PUT",
          cookie,
          body: { revision: 1, state: [] },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await call(server, "/api/templates/hyperframes/sample", {
          method: "PUT",
          cookie,
          body: { revision: 1, state: { text: "x".repeat(500001) } },
        })
      ).status,
      413,
    );
    assert.equal(
      (
        await call(server, "/api/templates/hyperframes/sample", {
          method: "PUT",
          cookie,
          body: { revision: 1, state: { title: "hacked" } },
          origin: "https://evil.example",
        })
      ).status,
      403,
    );
    const registered = await call(server, "/api/auth/register", {
      method: "POST",
      cookie,
      body: { username: "persistent_test", password: "test-local-pass-123" },
    });
    assert.equal(registered.status, 201);
    cookie = registered.cookie;
    assert.equal(registered.data.user.id, a.data.user.id);
    assert.equal(
      (await call(server, "/api/auth/me", { cookie: a.cookie })).status,
      401,
    );
    const p = {
      id: "persist-project",
      name: "服务器项目",
      prompt: "test",
      files: [{ path: "index.html", content: "<h1>真实存储</h1>" }],
    };
    assert.equal(
      (await call(server, "/api/projects", { method: "POST", cookie, body: p }))
        .data.saved,
      true,
    );
    assert.equal(
      (
        await call(server, "/api/projects/persist-project", {
          cookie: b.cookie,
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await call(server, "/api/projects/persist-project", {
          method: "DELETE",
          cookie: b.cookie,
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await call(server, "/api/projects/persist-project/agent", {
          method: "POST",
          cookie,
          body: { agent: "codex", prompt: "test" },
        })
      ).status,
      403,
    );
    assert.equal(
      (await call(server, "/api/connectors", { cookie })).status,
      503,
    );
    assert.equal(
      (
        await call(server, "/api/video/transcode", {
          method: "POST",
          cookie,
          body: { url: "http://example.invalid/not-a-video" },
        })
      ).status,
      400,
    );
    const ai = await call(server, "/api/chat", {
      method: "POST",
      cookie,
      body: { messages: [{ role: "user", content: "hello" }] },
    });
    assert.equal(ai.status, 502);
    assert.match(ai.data.error, /尚未配置/);
    const view = new DatabaseSync(db);
    const row = view
      .prepare("SELECT password_hash FROM workspace_accounts")
      .get();
    assert.notEqual(row.password_hash, "test-local-pass-123");
    assert.equal(row.password_hash.length, 128);
    view.close();
    await server.stop();
    server = await boot(db);
    assert.equal(
      (await call(server, "/api/projects/persist-project", { cookie })).data
        .files[0].content,
      "<h1>真实存储</h1>",
    );
    assert.equal(
      (await call(server, "/api/templates/hyperframes/sample", { cookie })).data
        .state.title,
      "持久化方案",
    );
    const fresh = await call(server, "/api/local/session", {
      method: "POST",
      body: {},
    });
    assert.equal(
      (
        await call(server, "/api/auth/login", {
          method: "POST",
          cookie: fresh.cookie,
          body: { username: "persistent_test", password: "incorrect-pass" },
        })
      ).status,
      401,
    );
    const login = await call(server, "/api/auth/login", {
      method: "POST",
      cookie: fresh.cookie,
      body: { username: "persistent_test", password: "test-local-pass-123" },
    });
    assert.equal(login.status, 200);
    assert.equal(
      (await call(server, "/api/projects", { cookie: login.cookie })).data
        .length,
      1,
    );
    assert.equal(
      (await call(server, "/api/templates", { cookie: login.cookie })).data
        .length,
      1,
    );
    const updated = await call(server, "/api/projects/persist-project", {
      method: "PUT",
      cookie: login.cookie,
      body: { ...p, name: "更新后的真实项目" },
    });
    assert.equal(updated.data.saved, true);
    assert.equal(
      (
        await call(server, "/api/projects/persist-project", {
          cookie: login.cookie,
        })
      ).data.name,
      "更新后的真实项目",
    );
    assert.equal(
      (
        await call(server, "/api/projects/persist-project", {
          method: "DELETE",
          cookie: login.cookie,
        })
      ).data.deleted,
      true,
    );
    assert.equal(
      (
        await call(server, "/api/projects/persist-project", {
          cookie: login.cookie,
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await call(server, "/api/templates/hyperframes/sample", {
          method: "PUT",
          cookie: login.cookie,
          body: { revision: 1, state: { title: "更新快照" } },
        })
      ).data.revision,
      2,
    );
    assert.equal(
      (
        await call(server, "/api/auth/logout", {
          method: "POST",
          cookie: login.cookie,
          body: {},
        })
      ).status,
      200,
    );
    assert.equal(
      (await call(server, "/api/auth/me", { cookie: login.cookie })).status,
      401,
    );
    const remote = await call(server, "/api/local/session", {
      method: "POST",
      body: {},
      origin: "https://5173-review.e2b.app",
      headers: { host: "5173-review.e2b.app" },
    });
    assert.equal(remote.status, 200);
    assert.match(
      remote.headers.get("set-cookie"),
      /Secure; SameSite=None; Partitioned/,
    );
    assert.equal(
      (
        await call(server, "/api/local/session", {
          method: "POST",
          body: {},
          origin: "http://5173-review.e2b.app",
          headers: { host: "5173-review.e2b.app" },
        })
      ).status,
      403,
    );
  } finally {
    await server.stop();
  }
});

test("canonical HTTPS origin is checked explicitly without trusting forwarded headers", (t) => {
  const previous = process.env.DESIGNBUDDY_PUBLIC_ORIGIN;
  process.env.DESIGNBUDDY_PUBLIC_ORIGIN = "https://app.example.com";
  t.after(() => {
    if (previous === undefined) delete process.env.DESIGNBUDDY_PUBLIC_ORIGIN;
    else process.env.DESIGNBUDDY_PUBLIC_ORIGIN = previous;
  });
  const {
    sameOrigin,
  } = require("../../dist/local/server/api/workspace-backend.js");
  const request = (origin) =>
    new Request("http://app.example.com/api/local/session", {
      method: "POST",
      headers: { Origin: origin, "X-Forwarded-Proto": "https" },
    });
  assert.equal(sameOrigin(request("https://app.example.com")), true);
  assert.equal(sameOrigin(request("http://app.example.com")), false);
  const browserSameOrigin = new Request("http://app.example.com/api/local/session", {
    method: "POST",
    headers: { "Sec-Fetch-Site": "same-origin" },
  });
  assert.equal(sameOrigin(browserSameOrigin), true);
  assert.equal(sameOrigin(new Request("http://app.example.com/api/local/session", { method: "POST" })), false);
  assert.equal(sameOrigin(new Request("http://app.example.com/api/local/session", { method: "POST", headers: { "Sec-Fetch-Site": "cross-site" } })), false);
  assert.equal(sameOrigin(request("https://evil.example.com")), false);
  assert.equal(
    sameOrigin(request("https://name:password@app.example.com")),
    false,
  );
  assert.equal(sameOrigin(request("null")), false);
});

test('15 welcome image template states persist with owner isolation and revision checks', async () => {
  const dir = await mkdtemp(resolve('.cache/', 'welcome-template-test-'));
  const server = await boot(resolve(dir, 'state.sqlite'));
  try {
    const a = await call(server, '/api/local/session', {method:'POST',body:{}});
    const b = await call(server, '/api/local/session', {method:'POST',body:{}});
    for (let id=1;id<=15;id++) {
      const path=`/api/templates/welcome-${String(id).padStart(2,'0')}/sample`;
      const saved=await call(server,path,{method:'PUT',cookie:a.cookie,body:{revision:0,state:{notes:`welcome ${id}`}}});
      assert.equal(saved.status,200);assert.equal(saved.data.revision,1);
      const loaded=await call(server,path,{cookie:a.cookie});
      assert.equal(loaded.data.state.notes,`welcome ${id}`);
      assert.equal((await call(server,path,{cookie:b.cookie})).status,404);
      assert.equal((await call(server,path,{method:'PUT',cookie:a.cookie,body:{revision:0,state:{notes:'stale'}}})).status,409);
    }
    assert.equal((await call(server,'/api/templates/welcome-16/sample',{method:'PUT',cookie:a.cookie,body:{revision:0,state:{}}})).status,404);
  } finally {await server.stop();}
});

test('Arena HTTPS alias establishes a secure isolated session and rejects HTTP spoofing', async () => {
 const dir=await mkdtemp(resolve('.cache/','welcome-origin-test-'));
 const server=await boot(resolve(dir,'state.sqlite'));
 try {
  const headers={host:'welcome-preview.arena.site'};
  const result=await call(server,'/api/local/session',{method:'POST',body:{},headers,origin:'https://welcome-preview.arena.site'});
  assert.equal(result.status,200);
  assert.match(result.headers.get('set-cookie'),/Secure; SameSite=None; Partitioned/);
  assert.equal((await call(server,'/api/local/session',{method:'POST',body:{},headers,origin:'http://welcome-preview.arena.site'})).status,403);
  for(const path of ['/api/projects','/api/tasks','/api/plugins','/api/profile','/api/ai/providers'])
   assert.equal((await call(server,path)).status,401,`missing sessions cannot access ${path}`);
 }finally{await server.stop()}
});

test('OAuth provider authorization redirects, safe next, invalid and one-time states (no token exchange)', async () => {
 const dir=await mkdtemp(resolve('.cache/','welcome-oauth-test-'));
 // Deliberately fake credentials exercise redirects only, never provider authentication.
 const server=await boot(resolve(dir,'state.sqlite'),{GOOGLE_CLIENT_ID:'test-google-client',GOOGLE_CLIENT_SECRET:'test-only-fake-secret',GITHUB_CLIENT_ID:'test-github-client',GITHUB_CLIENT_SECRET:'test-only-fake-secret',DESIGNBUDDY_PUBLIC_ORIGIN:'https://welcome-preview.arena.site'});
 try {
  const session=await call(server,'/api/local/session',{method:'POST',body:{}});
  assert.deepEqual((await call(server,'/api/auth/providers',{cookie:session.cookie})).data,{google:true,github:true});
  for(const provider of ['google','github']){
   const headers={Cookie:session.cookie};
   const result=await fetch(`${server.base}/api/auth/oauth/${provider}?next=%2F%2Fevil.example`,{headers,redirect:'manual'});
   assert.equal(result.status,302);
   const location=new URL(result.headers.get('location'));
   assert.equal(location.hostname,provider==='google'?'accounts.google.com':'github.com');
   assert.equal(location.searchParams.get('redirect_uri'),`https://welcome-preview.arena.site/api/auth/oauth/${provider}/callback`);
   const state=location.searchParams.get('state');assert.ok(state);
   const invalid=await fetch(`${server.base}/api/auth/oauth/${provider}/callback?state=invalid&code=unused`,{headers,redirect:'manual'});
   assert.match(invalid.headers.get('location'),/reason=invalid_state/);
   const missing=await fetch(`${server.base}/api/auth/oauth/${provider}/callback?state=${state}`,{headers,redirect:'manual'});
   assert.match(missing.headers.get('location'),/reason=missing_code/);
   const replay=await fetch(`${server.base}/api/auth/oauth/${provider}/callback?state=${state}&code=unused`,{headers,redirect:'manual'});
   assert.match(replay.headers.get('location'),/reason=invalid_state/);
  }
 }finally{await server.stop()}
});
