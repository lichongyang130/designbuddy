const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { ProjectShareStore } = require("../../dist/local/server/api/project-shares.js");
const { createApiHandler } = require("../../dist/local/server/api/http-handler.js");

const request = (path, method = "GET", body, headers = {}) =>
  new Request(`http://local${path}`, {
    method,
    headers: { "content-type": "application/json", origin: "http://local", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

const project = (id = "share-demo") => ({
  id,
  name: "可分享项目",
  prompt: "一个用于验证受控分享的项目",
  files: [{ path: "index.html", content: "<h1>受控分享</h1>" }],
  createdAt: "2026-10-16T00:00:00.000Z",
  updatedAt: "2026-10-16T00:00:00.000Z",
  status: "draft",
});

function withStack(run) {
  const directory = mkdtempSync(join(tmpdir(), "project-shares-"));
  const shares = new ProjectShareStore(join(directory, "shares.sqlite"));
  const projects = new Map();
  const handler = createApiHandler({
    projects: {
      async listByOwner(ownerId) {
        return [...projects.values()].filter((item) => item.ownerId === ownerId).map((item) => item.project);
      },
      async getById(ownerId, projectId) {
        const entry = projects.get(projectId);
        return entry && entry.ownerId === ownerId ? entry.project : null;
      },
      async save(ownerId, value) {
        projects.set(value.id, { ownerId, project: value });
        return value;
      },
      async delete(ownerId, projectId) {
        const entry = projects.get(projectId);
        if (!entry || entry.ownerId !== ownerId) return false;
        projects.delete(projectId);
        return true;
      },
    },
    shares,
    memberships: {
      add() { throw Error("not used"); },
      remove() { return false; },
      list() { return []; },
      ownerFor: (projectId) => (projects.get(projectId)?.ownerId ?? null),
      roleFor: (ownerId, projectId, userId) =>
        userId === "bob" && projects.get(projectId)?.ownerId === ownerId ? "viewer" : null,
      forUser: () => [],
    },
    authenticate: async (req) => {
      const id = req.headers.get("x-test-user");
      return id ? { id } : null;
    },
  });
  return Promise.resolve(run({ handler, shares, projects })).finally(() => {
    shares.close();
    rmSync(directory, { recursive: true, force: true });
  });
}

test("the share store creates unguessable links with a bounded expiry", () => {
  const directory = mkdtempSync(join(tmpdir(), "share-store-"));
  const store = new ProjectShareStore(join(directory, "shares.sqlite"));
  try {
    const first = store.create("alice", "p1", 7);
    const second = store.create("alice", "p1", 7);
    assert.notEqual(first.token, second.token);
    assert.ok(first.token.length >= 22, "the token is long enough to be unguessable");
    assert.equal(first.revokedAt, null);
    assert.equal(first.views, 0);
    const days = Math.round((first.expiresAt - first.createdAt) / 86_400_000);
    assert.equal(days, 7);
    // The expiry is bounded: nobody can ask for a link that lives for a year.
    const long = store.create("alice", "p1", 3650);
    assert.equal(Math.round((long.expiresAt - long.createdAt) / 86_400_000), 30);
    const tiny = store.create("alice", "p1", 0);
    assert.equal(Math.round((tiny.expiresAt - tiny.createdAt) / 86_400_000), 1);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("a share link is public to read, but only the owner can create, list or revoke it", async () => {
  await withStack(async ({ handler, projects }) => {
    projects.set("share-demo", { ownerId: "alice", project: project() });

    // A visitor without a session can read the link, but only the snapshot.
    const created = await handler(
      request("/api/projects/share-demo/shares", "POST", { expiresInDays: 7 }, { "x-test-user": "alice" }),
    );
    assert.equal(created.status, 201);
    const { share } = await created.json();
    assert.ok(share.token);

    const publicRead = await handler(request(`/api/shares/${share.token}`));
    assert.equal(publicRead.status, 200);
    const body = await publicRead.json();
    assert.equal(body.project.name, "可分享项目");
    assert.equal(body.project.files[0].path, "index.html");
    assert.equal(body.project.prompt, "一个用于验证受控分享的项目");
    // The snapshot never leaks the owner id or the internal project id.
    assert.equal(body.share.ownerId, undefined);
    assert.equal(body.project.id, undefined);

    // A stranger cannot even see that the project exists.
    const strangerList = await handler(request("/api/projects/share-demo/shares", "GET", undefined, { "x-test-user": "carol" }));
    assert.equal(strangerList.status, 404);
    // A member who can see the project still cannot list the owner's links.
    const otherList = await handler(request("/api/projects/share-demo/shares", "GET", undefined, { "x-test-user": "bob" }));
    assert.equal(otherList.status, 403);
    const ownList = await handler(request("/api/projects/share-demo/shares", "GET", undefined, { "x-test-user": "alice" }));
    assert.equal(ownList.status, 200);
    assert.equal((await ownList.json()).shares.length, 1);

    // Bob cannot revoke Alice's link.
    const bobRevoke = await handler(request(`/api/shares/${share.token}`, "DELETE", undefined, { "x-test-user": "bob" }));
    assert.equal(bobRevoke.status, 403);
    assert.equal((await handler(request(`/api/shares/${share.token}`))).status, 200);

    // The owner revokes it, and the public read stops working at once.
    const revoke = await handler(request(`/api/shares/${share.token}`, "DELETE", undefined, { "x-test-user": "alice" }));
    assert.equal(revoke.status, 200);
    const afterRevoke = await handler(request(`/api/shares/${share.token}`));
    assert.equal(afterRevoke.status, 410);
    assert.match((await afterRevoke.json()).error, /撤销/);
  });
});

test("an expired or unknown link never hands out the project", async () => {
  await withStack(async ({ handler, shares, projects }) => {
    projects.set("share-demo", { ownerId: "alice", project: project() });
    const share = shares.create("alice", "share-demo", 1);
    // Move the expiry into the past.
    shares.db.prepare("UPDATE project_shares SET expires_at=? WHERE token=?").run(Date.now() - 1000, share.token);
    const expired = await handler(request(`/api/shares/${share.token}`));
    assert.equal(expired.status, 410);
    assert.match((await expired.json()).error, /过期/);
    const unknown = await handler(request("/api/shares/aaaaaaaaaaaaaaaaaaaaaaaa"));
    assert.equal(unknown.status, 404);
  });
});

test("sharing records a view and only the owner sees the project behind the link", async () => {
  await withStack(async ({ handler, shares, projects }) => {
    projects.set("share-demo", { ownerId: "alice", project: project() });
    const share = shares.create("alice", "share-demo", 7);
    assert.equal((await handler(request(`/api/shares/${share.token}`))).status, 200);
    assert.equal((await handler(request(`/api/shares/${share.token}`))).status, 200);
    assert.equal(shares.get(share.token).views, 2);
    // A member with read access can see the project, a stranger cannot.
    const member = await handler(request("/api/projects/share-demo", "GET", undefined, { "x-test-user": "bob" }));
    assert.equal(member.status, 200);
    const foreign = await handler(request("/api/projects/share-demo", "GET", undefined, { "x-test-user": "carol" }));
    assert.equal(foreign.status, 404);
  });
});
