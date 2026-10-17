const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const { mkdtemp, mkdir } = require("node:fs/promises");
const { resolve } = require("node:path");
const { DatabaseSync } = require("node:sqlite");

async function boot(db) {
  const env = {
    ...process.env,
    DESIGNBUDDY_HOST: "0.0.0.0",
    DESIGNBUDDY_PORT: "0",
    DESIGNBUDDY_SQLITE_PATH: db,
    DESIGNBUDDY_STORAGE: "sqlite",
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
  const payload = body === undefined ? "" : JSON.stringify(body);
  const h = {
    ...(cookie ? { Cookie: cookie } : {}),
    ...(!["GET", "HEAD"].includes(method)
      ? {
          Origin: origin ?? server.base,
          "Content-Type": "application/json",
          // Node's HTTP parser refuses a chunked body on DELETE, so send a length.
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        }
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
            accept({
              status: res.statusCode,
              data: JSON.parse(text),
              cookie: res.headers["set-cookie"]?.[0].split(";")[0],
            });
          } catch (e) {
            reject(e);
          }
        });
      },
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

test("real HTTP: account profile editing, password rotation, account deletion and account audit", async () => {
  await mkdir(".cache/backend-tests", { recursive: true });
  const dir = await mkdtemp(resolve(".cache/backend-tests/account-"));
  const db = resolve(dir, "state.sqlite");
  const server = await boot(db);
  try {
    const guest = await call(server, "/api/local/session", {
      method: "POST",
      body: {},
    });
    // A guest session has no account to edit.
    const guestEdit = await call(server, "/api/auth/profile", {
      method: "PATCH",
      cookie: guest.cookie,
      body: { displayName: "游客", email: "guest@example.com" },
    });
    assert.equal(guestEdit.status, 403);
    assert.equal(guestEdit.data.code, "ACCOUNT_REQUIRED");

    const registered = await call(server, "/api/auth/register", {
      method: "POST",
      cookie: guest.cookie,
      body: { username: "account_tester", password: "first-local-pass-123" },
    });
    assert.equal(registered.status, 201);
    let cookie = registered.cookie;
    assert.equal(registered.data.user.kind, "account");
    assert.equal(registered.data.user.username, "account_tester");
    assert.equal(registered.data.user.displayName, "");

    // The registration itself is auditable.
    const auditAfterRegister = await call(server, "/api/auth/audit", { cookie });
    assert.equal(auditAfterRegister.status, 200);
    assert.ok(
      auditAfterRegister.data.some((entry) => entry.action === "account.register"),
      "register is recorded in the account audit",
    );

    // Cross-site writes are rejected.
    const crossSite = await call(server, "/api/auth/profile", {
      method: "PATCH",
      cookie,
      body: { displayName: "越权", email: "" },
      origin: "https://evil.example",
    });
    assert.equal(crossSite.status, 403);

    // A malformed email is refused.
    const badEmail = await call(server, "/api/auth/profile", {
      method: "PATCH",
      cookie,
      body: { displayName: "李工", email: "not-an-email" },
    });
    assert.equal(badEmail.status, 400);

    const updated = await call(server, "/api/auth/profile", {
      method: "PATCH",
      cookie,
      body: { displayName: "李工", email: "li@example.com" },
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.data.user.displayName, "李工");
    assert.equal(updated.data.user.email, "li@example.com");

    // The change survives a fresh login and shows up in the audit trail.
    const audit = await call(server, "/api/auth/audit", { cookie });
    assert.ok(
      audit.data.some((entry) => entry.action === "account.profile.update"),
      "profile update is recorded in the account audit",
    );
    assert.ok(
      audit.data.every((entry) => !JSON.stringify(entry).includes("li@example.com")),
      "the audit trail never stores the profile content",
    );

    // A wrong current password cannot rotate the password.
    const wrongPassword = await call(server, "/api/auth/password", {
      method: "POST",
      cookie,
      body: { currentPassword: "not-the-password", newPassword: "second-local-pass-456" },
    });
    assert.equal(wrongPassword.status, 401);

    // A short new password is refused.
    const shortPassword = await call(server, "/api/auth/password", {
      method: "POST",
      cookie,
      body: { currentPassword: "first-local-pass-123", newPassword: "short" },
    });
    assert.equal(shortPassword.status, 400);

    const rotated = await call(server, "/api/auth/password", {
      method: "POST",
      cookie,
      body: {
        currentPassword: "first-local-pass-123",
        newPassword: "second-local-pass-456",
      },
    });
    assert.equal(rotated.status, 200);
    assert.ok(
      (await call(server, "/api/auth/audit", { cookie })).data.some(
        (entry) => entry.action === "account.password.change",
      ),
      "password change is recorded in the account audit",
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
          body: { username: "account_tester", password: "first-local-pass-123" },
        })
      ).status,
      401,
      "the old password stops working",
    );
    const relogin = await call(server, "/api/auth/login", {
      method: "POST",
      cookie: fresh.cookie,
      body: { username: "account_tester", password: "second-local-pass-456" },
    });
    assert.equal(relogin.status, 200);
    assert.equal(relogin.data.user.displayName, "李工");
    assert.equal(relogin.data.user.email, "li@example.com");

    // Deleting the account needs an explicit confirmation and the current password.
    const noConfirm = await call(server, "/api/auth/account", {
      method: "DELETE",
      cookie,
      body: { currentPassword: "second-local-pass-456" },
    });
    assert.equal(noConfirm.status, 400);
    const wrongDeletePassword = await call(server, "/api/auth/account", {
      method: "DELETE",
      cookie,
      body: { currentPassword: "wrong", confirm: true },
    });
    assert.equal(wrongDeletePassword.status, 401);

    const removed = await call(server, "/api/auth/account", {
      method: "DELETE",
      cookie,
      body: { currentPassword: "second-local-pass-456", confirm: true },
    });
    assert.equal(removed.status, 200);
    assert.ok(
      removed.data.audit.some((entry) => entry.action === "account.delete"),
      "deletion is recorded in the account audit",
    );
    assert.equal(
      (await call(server, "/api/auth/me", { cookie })).status,
      401,
      "the session is gone after the account is deleted",
    );
    assert.equal(
      (
        await call(server, "/api/auth/login", {
          method: "POST",
          cookie: fresh.cookie,
          body: { username: "account_tester", password: "second-local-pass-456" },
        })
      ).status,
      401,
      "the deleted account can no longer log in",
    );
    const view = new DatabaseSync(db);
    assert.equal(
      view.prepare("SELECT COUNT(*) AS n FROM workspace_accounts").get().n,
      0,
      "the account row is really deleted",
    );
    assert.equal(
      view
        .prepare("SELECT COUNT(*) AS n FROM workspace_account_audit")
        .get().n > 0,
      true,
      "the audit trail survives the account",
    );
    view.close();
  } finally {
    await server.stop();
  }
});
