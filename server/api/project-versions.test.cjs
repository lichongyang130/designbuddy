const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const { ProjectVersionStore, changedFiles, hashContent } = require("../../dist/local/server/api/project-versions.js");
const { createApiHandler } = require("../../dist/local/server/api/http-handler.js");

function withStore(run) {
  const directory = mkdtempSync(join(tmpdir(), "project-versions-"));
  const store = new ProjectVersionStore(join(directory, "versions.sqlite"));
  return Promise.resolve(run(store)).finally(() => {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  });
}

const request = (path, method = "GET", body, headers = {}) =>
  new Request(`http://app.example${path}`, {
    method,
    headers: { "content-type": "application/json", origin: "http://app.example", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

function projectStore() {
  const projects = new Map();
  return {
    listByOwner: async (ownerId) => [...projects.values()].filter((item) => item.ownerId === ownerId),
    getById: async (ownerId, id) => {
      const project = projects.get(id);
      return project && project.ownerId === ownerId ? project : null;
    },
    save: async (ownerId, project) => {
      const saved = { ...project, ownerId, updatedAt: new Date().toISOString() };
      projects.set(project.id, saved);
      return saved;
    },
    delete: async (ownerId, id) => {
      const project = projects.get(id);
      if (!project || project.ownerId !== ownerId) return false;
      return projects.delete(id);
    },
    seed: (project, ownerId = "owner") => projects.set(project.id, { ...project, ownerId }),
    raw: projects,
  };
}

const sample = (id = "p1", content = "<h1>v1</h1>") => ({
  id,
  name: "项目",
  prompt: "做个页面",
  files: [{ path: "index.html", content }],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  status: "draft",
});

test("a saved file becomes a version and the newest one is the head", async () => {
  await withStore((store) => {
    const first = store.commit({ projectId: "p1", ownerId: "owner", path: "index.html", content: "a", author: "owner" });
    const second = store.commit({ projectId: "p1", ownerId: "owner", path: "index.html", content: "b", author: "editor" });
    assert.equal(first.version, 1);
    assert.equal(second.version, 2);
    assert.equal(store.head("p1", "index.html").id, second.id);
    assert.equal(store.list("p1").length, 2);
    assert.equal(store.heads("p1")["index.html"], second.id);
    assert.equal(store.get("p1", first.id).content, "a");
    assert.equal(store.get("p2", first.id), null);
  });
});

test("a stale base version is reported as a conflict with the newer content", async () => {
  await withStore((store) => {
    const base = store.commit({ projectId: "p1", ownerId: "owner", path: "index.html", content: "a", author: "owner" });
    const head = store.commit({ projectId: "p1", ownerId: "owner", path: "index.html", content: "b", author: "other" });
    assert.deepEqual(store.detectConflicts("p1", { "index.html": head.id }), []);
    const conflicts = store.detectConflicts("p1", { "index.html": base.id });
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0].headVersion, head.id);
    assert.equal(conflicts[0].baseVersion, base.id);
    assert.equal(conflicts[0].headContent, "b");
    assert.equal(conflicts[0].headAuthor, "other");
    // A file that was never versioned cannot conflict.
    assert.deepEqual(store.detectConflicts("p1", { "new.html": "whatever" }), []);
  });
});

test("a client that already holds the newest content never conflicts", async () => {
  await withStore((store) => {
    const base = store.commit({ projectId: "p1", ownerId: "owner", path: "index.html", content: "a", author: "owner" });
    const head = store.commit({ projectId: "p1", ownerId: "owner", path: "index.html", content: "b", author: "other" });
    // The client saves exactly what the head holds: nothing would be lost.
    assert.deepEqual(store.detectConflicts("p1", { "index.html": base.id }, { "index.html": "b" }), []);
    // The same client with different content is a real conflict.
    assert.equal(store.detectConflicts("p1", { "index.html": base.id }, { "index.html": "mine" }).length, 1);
    assert.equal(store.detectConflicts("p1", { "index.html": head.id }, { "index.html": "mine" }).length, 0);
  });
});

test("a copy without any server base is reported as a conflict", async () => {
  await withStore((store) => {
    store.commit({ projectId: "p1", ownerId: "owner", path: "index.html", content: "server", author: "owner" });
    // An empty base means the client never saw a server version of this file.
    const conflicts = store.detectConflicts("p1", { "index.html": "" }, { "index.html": "unrelated" });
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0].baseVersion, "");
    assert.equal(conflicts[0].headContent, "server");
    // The same file with the same content is harmless.
    assert.deepEqual(store.detectConflicts("p1", { "index.html": "" }, { "index.html": "server" }), []);
  });
});

test("changed files are detected by content, not by order", () => {
  const before = [{ path: "a.html", content: "1" }, { path: "b.css", content: "2" }];
  const after = [{ path: "b.css", content: "2" }, { path: "a.html", content: "9" }];
  assert.deepEqual(changedFiles(before, after), [{ path: "a.html", content: "9" }]);
  assert.deepEqual(changedFiles(before, before), []);
  assert.equal(hashContent("abc") === hashContent("abc"), true);
  assert.notEqual(hashContent("abc"), hashContent("abd"));
});

test("saving a project stores a version and returns the new heads", async () => {
  await withStore(async (store) => {
    const projects = projectStore();
    projects.seed(sample());
    const handler = createApiHandler({ authenticate: async () => ({ id: "owner" }), projects, versions: store });
    const response = await handler(request("/api/projects", "POST", sample("p1", "<h1>v2</h1>")));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.saved, true);
    assert.ok(body.versions["index.html"]);
    const versions = await (await handler(request("/api/projects/p1/versions"))).json();
    assert.equal(versions.versions.length, 1);
    assert.equal(versions.versions[0].content, "<h1>v2</h1>");
    assert.equal(versions.versions[0].label, "保存");
  });
});

test("a conflicting save is refused with 409 and the newer content", async () => {
  await withStore(async (store) => {
    const projects = projectStore();
    projects.seed(sample());
    const handler = createApiHandler({ authenticate: async () => ({ id: "owner" }), projects, versions: store });
    await handler(request("/api/projects", "POST", sample("p1", "server side")));
    const heads = store.heads("p1");
    // Someone else saves afterwards.
    store.commit({ projectId: "p1", ownerId: "owner", path: "index.html", content: "newer", author: "other" });
    const response = await handler(
      request("/api/projects", "POST", { ...sample("p1", "my side"), baseVersions: heads }),
    );
    assert.equal(response.status, 409);
    const body = await response.json();
    assert.equal(body.conflicts.length, 1);
    assert.equal(body.conflicts[0].headContent, "newer");
    assert.equal(body.conflicts[0].path, "index.html");
    // The refused save did not change the stored project.
    assert.equal(projects.raw.get("p1").files[0].content, "server side");
  });
});

test("a save without a base overwrites and is recorded as a new version", async () => {
  await withStore(async (store) => {
    const projects = projectStore();
    projects.seed(sample());
    const handler = createApiHandler({ authenticate: async () => ({ id: "owner" }), projects, versions: store });
    await handler(request("/api/projects", "POST", sample("p1", "v1")));
    const heads = store.heads("p1");
    store.commit({ projectId: "p1", ownerId: "owner", path: "index.html", content: "newer", author: "other" });
    // No base at all: the person explicitly chose to overwrite.
    const response = await handler(request("/api/projects", "POST", sample("p1", "mine")));
    assert.equal(response.status, 200);
    assert.equal(projects.raw.get("p1").files[0].content, "mine");
    const versions = await (await handler(request("/api/projects/p1/versions"))).json();
    // v1 from the first save, v2 from the other device, v3 from the overwrite.
    assert.equal(versions.versions.length, 3);
    assert.notEqual(versions.heads["index.html"], heads["index.html"]);
    const audit = await (await handler(request("/api/projects/p1/audit"))).json();
    assert.equal(audit.entries[0].action, "project.save");
  });
});

test("a restore brings an old version back and keeps the history", async () => {
  await withStore(async (store) => {
    const projects = projectStore();
    projects.seed(sample("p1", "v1"));
    const handler = createApiHandler({ authenticate: async () => ({ id: "owner" }), projects, versions: store });
    await handler(request("/api/projects", "POST", sample("p1", "v1")));
    const first = store.list("p1")[0];
    await handler(request("/api/projects", "POST", sample("p1", "v2")));
    const restore = await handler(request("/api/projects/p1/restore", "POST", { versionId: first.id }));
    assert.equal(restore.status, 200);
    const body = await restore.json();
    assert.equal(body.project.files[0].content, "v1");
    assert.equal(body.version.label, "恢复自 v1");
    const versions = await (await handler(request("/api/projects/p1/versions"))).json();
    assert.equal(versions.versions.length, 3);
  });
});

test("the audit trail records who changed what", async () => {
  await withStore(async (store) => {
    const projects = projectStore();
    projects.seed(sample());
    const handler = createApiHandler({ authenticate: async () => ({ id: "owner" }), projects, versions: store });
    await handler(request("/api/projects", "POST", sample("p1", "v2")));
    const audit = await (await handler(request("/api/projects/p1/audit"))).json();
    assert.ok(audit.entries.length >= 1);
    assert.equal(audit.entries[0].actor, "owner");
    assert.equal(audit.entries[0].action, "project.save");
    assert.equal(audit.entries[0].detail, "index.html");
  });
});

test("another account cannot read the history of a project it cannot see", async () => {
  await withStore(async (store) => {
    const projects = projectStore();
    projects.seed(sample());
    const owner = createApiHandler({ authenticate: async () => ({ id: "owner" }), projects, versions: store });
    await owner(request("/api/projects", "POST", sample("p1", "v2")));
    const stranger = createApiHandler({ authenticate: async () => ({ id: "stranger" }), projects, versions: store });
    const response = await stranger(request("/api/projects/p1/versions"));
    assert.equal(response.status, 404);
    const restore = await stranger(request("/api/projects/p1/restore", "POST", { versionId: store.list("p1")[0].id }));
    assert.equal(restore.status, 403);
  });
});

test("unknown version ids are refused", async () => {
  await withStore(async (store) => {
    const projects = projectStore();
    projects.seed(sample());
    const handler = createApiHandler({ authenticate: async () => ({ id: "owner" }), projects, versions: store });
    assert.equal((await handler(request("/api/projects/p1/versions/nope"))).status, 404);
    assert.equal((await handler(request("/api/projects/p1/restore", "POST", { versionId: "nope" }))).status, 404);
    assert.equal((await handler(request("/api/projects/p1/versions", "POST", {}))).status, 405);
  });
});
