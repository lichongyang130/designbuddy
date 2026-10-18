const { test } = require("node:test");
const assert = require("node:assert/strict");
const { TaskBackend, parseCron, nextRunAt, validTimezone } = require("../../dist/local/server/api/task-backend.js");
const { ScheduleRunner } = require("../../dist/local/server/api/scheduler.js");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { createServer } = require("node:http");

function withBackend(run) {
  const directory = mkdtempSync(join(tmpdir(), "task-backend-"));
  const backend = new TaskBackend(join(directory, "tasks.sqlite"));
  return Promise.resolve(run(backend)).finally(() => {
    backend.close();
    rmSync(directory, { recursive: true, force: true });
  });
}

const request = (path, method = "GET", body, headers = {}) =>
  new Request(`http://local${path}`, {
    method,
    headers: { "content-type": "application/json", origin: "http://local", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

test("tasks persist, stay owner scoped and support real retries", async () => {
  await withBackend(async backend => {
    const created = backend.saveTask("alice", { projectId: "p1", kind: "skill", title: "表格清洗", status: "queued" });
    assert.equal(created.ownerId, "alice");
    assert.equal(backend.listTasks("alice").length, 1);
    assert.equal(backend.listTasks("bob").length, 0, "another identity must not see the task");
    assert.equal(backend.getTask("bob", created.id), undefined);

    const failed = backend.saveTask("alice", { id: created.id, projectId: "p1", kind: "skill", title: "表格清洗", status: "failed", error: "文件格式不对" });
    assert.equal(failed.status, "failed");
    assert.equal(failed.error, "文件格式不对");
    // A task that is still running must not be retried.
    const running = backend.saveTask("alice", { projectId: "p1", kind: "skill", title: "进行中的任务", status: "running" });
    assert.throws(() => backend.retryTask("alice", running.id), /失败或已取消/);

    const retried = backend.retryTask("alice", created.id);
    assert.equal(retried.status, "queued");
    assert.equal(retried.attempts, 1);
    assert.equal(retried.error, "");
    assert.equal(backend.getTask("bob", created.id), undefined);
    assert.equal(backend.deleteTask("bob", created.id), false);
    assert.equal(backend.deleteTask("alice", created.id), true);
  });
});

test("notifications are a real inbox with unread state, read and delete", async () => {
  await withBackend(async backend => {
    backend.addNotification("alice", { kind: "error", title: "构建失败", description: "退出码 3" });
    backend.addNotification("alice", { kind: "complete", title: "OCR 完成", description: "4 页" });
    const list = backend.listNotifications("alice");
    assert.equal(list.length, 2);
    assert.equal(list.filter(item => item.read).length, 0);
    assert.equal(backend.listNotifications("bob").length, 0);
    backend.markNotificationRead("alice", list[0].id);
    assert.equal(backend.listNotifications("alice").filter(item => item.read).length, 1);
    backend.markNotificationRead("alice");
    assert.equal(backend.listNotifications("alice").filter(item => item.read).length, 2);
    assert.equal(backend.deleteNotification("alice", list[0].id), true);
    assert.equal(backend.listNotifications("alice").length, 1);
  });
});

test("the HTTP surface refuses cross-site writes and unknown owners see nothing", async () => {
  await withBackend(async backend => {
    const created = await backend.handle(
      request("/api/tasks", "POST", { projectId: "p1", kind: "conversation", title: "对话", status: "succeeded" }),
      "alice",
    );
    assert.equal(created.status, 200);
    const body = await created.json();
    assert.equal(body.task.status, "succeeded");
    const list = await backend.handle(request("/api/tasks"), "bob");
    assert.deepEqual((await list.json()).tasks, []);
    const crossSite = await backend.handle(
      request("/api/tasks", "POST", { projectId: "p1", kind: "manual", title: "x", status: "queued" }, { origin: "http://evil.example" }),
      "alice",
    );
    assert.equal(crossSite.status, 403);
  });
});

test("cron rules and time zones are validated, and the next run is computed in that zone", () => {
  assert.ok(parseCron("*/15 * * * *"));
  assert.ok(parseCron("0 9 * * 1-5"));
  assert.equal(parseCron("not a cron"), null);
  assert.equal(parseCron("99 * * * *"), null);
  assert.equal(parseCron("* * * *"), null);
  assert.equal(validTimezone("Asia/Shanghai"), true);
  assert.equal(validTimezone("Not/AZone"), false);
  const next = nextRunAt("0 9 * * *", "Asia/Shanghai", new Date("2026-10-16T00:30:00Z"));
  assert.ok(next, "a next run must be found");
  // 09:00 in Asia/Shanghai is 01:00 UTC.
  assert.equal(new Date(next).toISOString(), "2026-10-16T01:00:00.000Z");
});

test("the scheduler really runs due schedules, records history and raises a failure notification", async () => {
  const directory = mkdtempSync(join(tmpdir(), "scheduler-"));
  const backend = new TaskBackend(join(directory, "tasks.sqlite"));
  const runner = new ScheduleRunner(backend);
  try {
    const hits = { "/ok": 0, "/bad": 0 };
    const server = createServer((request_, response) => {
      hits[request_.url] = (hits[request_.url] || 0) + 1;
      response.writeHead(request_.url === "/ok" ? 200 : 500);
      response.end("ok");
    });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;
    const ok = backend.saveSchedule("alice", { name: "本机检查", cron: "* * * * *", timezone: "UTC", url: `http://127.0.0.1:${port}/ok` });
    const bad = backend.saveSchedule("alice", { name: "失败检查", cron: "* * * * *", timezone: "UTC", url: `http://127.0.0.1:${port}/bad` });
    assert.ok(ok.nextRunAt, "a schedule must get a next run time");
    await runner.tick(Date.now() + 120000);
    assert.equal(hits["/ok"], 1, "the due schedule must actually be requested");
    assert.equal(hits["/bad"], 1, "the failing schedule must actually be requested");
    const okRuns = backend.listScheduleRuns("alice", ok.id);
    assert.equal(okRuns[0].status, "succeeded");
    assert.match(okRuns[0].detail, /HTTP 200/);
    const badRuns = backend.listScheduleRuns("alice", bad.id);
    assert.equal(badRuns[0].status, "failed");
    const notifications = backend.listNotifications("alice");
    assert.equal(notifications.length, 1);
    assert.match(notifications[0].title, /定时检查失败/);
    assert.equal(backend.getSchedule("alice", ok.id).lastStatus, "succeeded");

    // A schedule whose previous run is still marked running must not start twice.
    backend.startScheduleRun(backend.getSchedule("alice", ok.id));
    const okRunsBefore = backend.listScheduleRuns("alice", ok.id).length;
    await runner.tick(Date.now() + 240000);
    assert.equal(hits["/ok"], 1, "a running schedule must not be requested again");
    assert.equal(backend.listScheduleRuns("alice", ok.id).length, okRunsBefore, "no second run record for a running schedule");
    server.closeAllConnections?.();
    server.close();
  } finally {
    backend.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
