const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const { mkdtemp, mkdir } = require("node:fs/promises");
const { resolve } = require("node:path");

/**
 * The operator console is booted as a real server, because the point of the
 * test is the real access control: who may open it, what a refused account
 * sees, and what a disabled account can no longer do.
 */
async function boot(dir, admins) {
  const env = {
    ...process.env,
    DESIGNBUDDY_HOST: "0.0.0.0",
    DESIGNBUDDY_PORT: "0",
    DESIGNBUDDY_SQLITE_PATH: resolve(dir, "state.sqlite"),
    DESIGNBUDDY_STORAGE: "sqlite",
    DESIGNBUDDY_ADMIN_ACCOUNTS: admins,
    DESIGNBUDDY_TASKS_SQLITE_PATH: resolve(dir, "tasks.sqlite"),
    DESIGNBUDDY_ASSETS_SQLITE_PATH: resolve(dir, "assets.sqlite"),
    DESIGNBUDDY_ASSET_ROOT: resolve(dir, "files"),
    DESIGNBUDDY_PLUGINS_SQLITE_PATH: resolve(dir, "plugins.sqlite"),
    DESIGNBUDDY_COMMUNITY_SQLITE_PATH: resolve(dir, "community.sqlite"),
    DESIGNBUDDY_PROFILE_SQLITE_PATH: resolve(dir, "profile.sqlite"),
    DESIGNBUDDY_SHARES_SQLITE_PATH: resolve(dir, "shares.sqlite"),
    DESIGNBUDDY_VERSIONS_SQLITE_PATH: resolve(dir, "versions.sqlite"),
    DESIGNBUDDY_WORKFLOWS_SQLITE_PATH: resolve(dir, "workflows.sqlite"),
    DESIGNBUDDY_SKILL_DB: resolve(dir, "skills.sqlite"),
  };
  for (const key of ["AI_API_KEY", "OPENAI_API_KEY", "DESIGNBUDDY_LOCAL_TOKEN", "DESIGNBUDDY_ENABLE_LOCAL_AGENT"])
    delete env[key];
  const child = spawn(process.execPath, ["dist/local/server/local-daemon.js"], { env, stdio: ["ignore", "pipe", "pipe"] });
  let logs = "";
  const base = await new Promise((accept, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(Error("startup timeout " + logs));
    }, 15000);
    child.stdout.on("data", (data) => {
      logs += data;
      const match = logs.match(/listening on 0\.0\.0\.0:(\d+)/);
      if (match) {
        clearTimeout(timer);
        accept("http://127.0.0.1:" + match[1]);
      }
    });
    child.stderr.on("data", (data) => (logs += data));
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

async function call(server, path, { method = "GET", body, cookie, origin } = {}) {
  const http = require("node:http");
  const headers = {
    ...(cookie ? { Cookie: cookie } : {}),
    ...(!["GET", "HEAD"].includes(method) ? { Origin: origin ?? server.base, "Content-Type": "application/json" } : {}),
  };
  return new Promise((accept, reject) => {
    const request = http.request(server.base + path, { method, headers }, (response) => {
      let text = "";
      response.on("data", (chunk) => (text += chunk));
      response.on("end", () => {
        try {
          accept({
            status: response.statusCode,
            data: text ? JSON.parse(text) : {},
            cookie: response.headers["set-cookie"]?.[0]?.split(";")[0],
          });
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
    if (body !== undefined) request.write(JSON.stringify(body));
    request.end();
  });
}

async function register(server, username) {
  const session = await call(server, "/api/local/session", { method: "POST", body: {} });
  const created = await call(server, "/api/auth/register", {
    method: "POST",
    body: { username, password: "test-password-12345" },
    cookie: session.cookie,
  });
  return { id: created.data.user.id, username, cookie: created.cookie, status: created.status };
}

test("only the configured operator may open the console, and the refusals are explicit", async () => {
  await mkdir(".cache/admin-tests", { recursive: true });
  const dir = await mkdtemp(resolve(".cache/admin-tests/run-"));
  const server = await boot(dir, "boss_user");
  try {
    const boss = await register(server, "boss_user");
    assert.equal(boss.status, 201);
    const guest = await register(server, "guest_user");

    // The operator sees the whole server.
    const overview = await call(server, "/api/admin/overview", { cookie: boss.cookie });
    assert.equal(overview.status, 200);
    assert.equal(overview.data.overview.accounts.total, 2);
    assert.ok(overview.data.overview.accounts.list.some((account) => account.username === "boss_user"));
    assert.ok(overview.data.overview.skills.total > 0);
    assert.ok(overview.data.overview.skills.ready > 0);
    assert.ok(Array.isArray(overview.data.overview.audit));
    assert.ok("calls" in overview.data.overview.usage);
    assert.ok("byStatus" in overview.data.overview.tasks);

    // A normal account gets a clear refusal, not a half filled page.
    const refused = await call(server, "/api/admin/overview", { cookie: guest.cookie });
    assert.equal(refused.status, 403);
    assert.match(refused.data.error, /管理员/);
    const refusedAction = await call(server, `/api/admin/accounts/${guest.id}/status`, {
      method: "POST",
      body: { enabled: false },
      cookie: guest.cookie,
    });
    assert.equal(refusedAction.status, 403);

    // The console never returns password material.
    const body = JSON.stringify(overview.data);
    assert.ok(!body.includes("password_hash"));
    assert.ok(!body.includes("salt"));
  } finally {
    await server.stop();
  }
});

test("disabling an account ends its sessions and blocks the next sign in", async () => {
  await mkdir(".cache/admin-tests", { recursive: true });
  const dir = await mkdtemp(resolve(".cache/admin-tests/run-"));
  const server = await boot(dir, "boss_user");
  try {
    const boss = await register(server, "boss_user");
    const guest = await register(server, "guest_user");
    assert.equal((await call(server, "/api/auth/me", { cookie: guest.cookie })).status, 200);

    const disabled = await call(server, `/api/admin/accounts/${guest.id}/status`, {
      method: "POST",
      body: { enabled: false },
      cookie: boss.cookie,
    });
    assert.equal(disabled.status, 200);
    assert.equal(disabled.data.account.enabled, false);

    // The session is gone.
    const afterDisable = await call(server, "/api/auth/me", { cookie: guest.cookie });
    assert.equal(afterDisable.status, 401);

    // The next sign in is refused with a clear reason.
    const session = await call(server, "/api/local/session", { method: "POST", body: {} });
    const login = await call(server, "/api/auth/login", {
      method: "POST",
      body: { username: "guest_user", password: "test-password-12345" },
      cookie: session.cookie,
    });
    assert.equal(login.status, 403);
    assert.match(login.data.error, /停用/);

    // The action is in the audit trail.
    const overview = await call(server, "/api/admin/overview", { cookie: boss.cookie });
    const event = overview.data.overview.audit.find((item) => item.action === "account.disable");
    assert.ok(event, "the disable action must be audited");
    assert.equal(event.accountId, guest.id);

    // The console itself shows the account as disabled.
    const listedAccount = overview.data.overview.accounts.list.find((item) => item.id === guest.id);
    assert.equal(listedAccount.disabled, true);
    assert.equal(overview.data.overview.accounts.disabled, 1);

    // Restoring the account lets the person back in.
    const enabled = await call(server, `/api/admin/accounts/${guest.id}/status`, {
      method: "POST",
      body: { enabled: true },
      cookie: boss.cookie,
    });
    assert.equal(enabled.status, 200);
    const sessionAgain = await call(server, "/api/local/session", { method: "POST", body: {} });
    const loginAgain = await call(server, "/api/auth/login", {
      method: "POST",
      body: { username: "guest_user", password: "test-password-12345" },
      cookie: sessionAgain.cookie,
    });
    assert.equal(loginAgain.status, 200);
  } finally {
    await server.stop();
  }
});

test("the console can retry a failed task and stop a schedule", async () => {
  await mkdir(".cache/admin-tests", { recursive: true });
  const dir = await mkdtemp(resolve(".cache/admin-tests/run-"));
  const server = await boot(dir, "boss_user");
  try {
    const boss = await register(server, "boss_user");
    // A failed task for the operator's own account.
    const created = await call(server, "/api/tasks", {
      method: "POST",
      body: { projectId: "demo", kind: "skill", title: "会失败的任务", status: "failed", error: "真实失败原因" },
      cookie: boss.cookie,
    });
    assert.equal(created.status, 200);
    const taskId = created.data.task.id;
    const retried = await call(server, `/api/admin/tasks/${boss.id}/${taskId}/retry`, {
      method: "POST",
      body: {},
      cookie: boss.cookie,
    });
    assert.equal(retried.status, 200);
    assert.notEqual(retried.data.task.status, "failed");

    // A schedule can be stopped and started again.
    const schedule = await call(server, "/api/schedules", {
      method: "POST",
      body: { name: "夜间备份", cron: "0 3 * * *", timezone: "Asia/Shanghai", url: "http://127.0.0.1:9/health", expectStatus: 200 },
      cookie: boss.cookie,
    });
    assert.equal(schedule.status, 200);
    const scheduleId = schedule.data.schedule.id;
    const stopped = await call(server, `/api/admin/schedules/${boss.id}/${scheduleId}/status`, {
      method: "POST",
      body: { enabled: false },
      cookie: boss.cookie,
    });
    assert.equal(stopped.status, 200);
    assert.equal(stopped.data.schedule.enabled, false);
    const overview = await call(server, "/api/admin/overview", { cookie: boss.cookie });
    const listed = overview.data.overview.schedules.list.find((item) => item.id === scheduleId);
    assert.equal(listed.enabled, false);
  } finally {
    await server.stop();
  }
});
