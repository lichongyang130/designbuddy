const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { CommunityTemplateStore } = require("../../dist/local/server/api/community-templates.js");
const { createApiHandler } = require("../../dist/local/server/api/http-handler.js");

const request = (path, method = "GET", body, headers = {}) =>
  new Request(`http://local${path}`, {
    method,
    headers: { "content-type": "application/json", origin: "http://local", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

const state = { headline: "已发布的模板", pages: 3 };

function withStack(run) {
  const directory = mkdtempSync(join(tmpdir(), "community-"));
  const community = new CommunityTemplateStore(join(directory, "community.sqlite"));
  const workspaces = {
    listFor: (userId) => (userId === "alice" || userId === "bob" ? [{ id: "team", name: "团队", ownerId: "alice", joinCode: "", createdAt: "" }] : []),
    listMembers: () => [
      { userId: "alice", role: "owner", createdAt: "" },
      { userId: "bob", role: "member", createdAt: "" },
    ],
  };
  const handler = createApiHandler({
    projects: {
      async listByOwner() { return []; },
      async getById() { return null; },
      async save() { throw Error("not used"); },
      async delete() { return false; },
    },
    community,
    workspaces,
    authenticate: async (req) => {
      const id = req.headers.get("x-test-user");
      return id ? { id } : null;
    },
  });
  return Promise.resolve(run({ handler, community })).finally(() => {
    community.close();
    rmSync(directory, { recursive: true, force: true });
  });
}

test("publishing a template is a real server side change with an owner and a revision", async () => {
  await withStack(async ({ handler, community }) => {
    const published = await handler(request("/api/community/templates", "POST", {
      sample: "travel",
      title: "我的旅行模板",
      description: "24 页行程模板",
      visibility: "private",
      state,
    }, { "x-test-user": "alice" }));
    assert.equal(published.status, 201);
    const { template } = await published.json();
    assert.equal(template.ownerId, "alice");
    assert.equal(template.title, "我的旅行模板");
    assert.equal(template.revision, 1);
    assert.ok(template.publishedAt > 0);
    assert.equal(template.unpublishedAt, null);

    // The published state is really stored and can be read back.
    const read = await handler(request(`/api/community/templates/${template.id}/state`, "GET", undefined, { "x-test-user": "alice" }));
    assert.equal(read.status, 200);
    assert.deepEqual((await read.json()).state, state);

    // Publishing the same family again updates the entry and grows the revision.
    const again = await handler(request("/api/community/templates", "POST", {
      sample: "travel", title: "我的旅行模板 v2", visibility: "private", state: { ...state, headline: "改过的标题" },
    }, { "x-test-user": "alice" }));
    assert.equal(again.status, 201);
    const updated = (await again.json()).template;
    assert.equal(updated.id, template.id);
    assert.equal(updated.revision, 2);
    assert.equal(updated.title, "我的旅行模板 v2");
    assert.equal((await handler(request("/api/community/templates", "GET", undefined, { "x-test-user": "alice" }))).status, 200);
    assert.equal(((await (await handler(request("/api/community/templates", "GET", undefined, { "x-test-user": "alice" }))).json()).templates.length), 1);
  });
});

test("the visibility of a published template decides who may see and copy it", async () => {
  await withStack(async ({ handler }) => {
    const published = await handler(request("/api/community/templates", "POST", {
      sample: "luma", title: "公开的演示模板", visibility: "private", state,
    }, { "x-test-user": "alice" }));
    const { template } = await published.json();

    // A stranger cannot see a private template.
    const strangerList = await handler(request("/api/community/templates", "GET", undefined, { "x-test-user": "carol" }));
    assert.equal((await strangerList.json()).templates.length, 0);
    const strangerRead = await handler(request(`/api/community/templates/${template.id}`, "GET", undefined, { "x-test-user": "carol" }));
    assert.equal(strangerRead.status, 403);

    // A workspace peer sees it once it is shared with the workspace.
    await handler(request(`/api/community/templates/${template.id}`, "PATCH", { visibility: "workspace" }, { "x-test-user": "alice" }));
    const peerList = await handler(request("/api/community/templates", "GET", undefined, { "x-test-user": "bob" }));
    assert.equal((await peerList.json()).templates.length, 1);
    const peerRead = await handler(request(`/api/community/templates/${template.id}/state`, "GET", undefined, { "x-test-user": "bob" }));
    assert.equal(peerRead.status, 200);

    // A published template is visible to every signed in account.
    await handler(request(`/api/community/templates/${template.id}`, "PATCH", { visibility: "public" }, { "x-test-user": "alice" }));
    const publicList = await handler(request("/api/community/templates", "GET", undefined, { "x-test-user": "carol" }));
    assert.equal((await publicList.json()).templates.length, 1);
    const publicState = await handler(request(`/api/community/templates/${template.id}/state`, "GET", undefined, { "x-test-user": "carol" }));
    assert.equal(publicState.status, 200);
  });
});

test("only the author can change or unpublish a template, and the trail survives", async () => {
  await withStack(async ({ handler }) => {
    const published = await handler(request("/api/community/templates", "POST", {
      sample: "research", title: "研究报告模板", visibility: "public", state,
    }, { "x-test-user": "alice" }));
    const { template } = await published.json();

    const otherPatch = await handler(request(`/api/community/templates/${template.id}`, "PATCH", { visibility: "private" }, { "x-test-user": "bob" }));
    assert.equal(otherPatch.status, 403);
    const otherDelete = await handler(request(`/api/community/templates/${template.id}`, "DELETE", undefined, { "x-test-user": "bob" }));
    assert.equal(otherDelete.status, 403);

    const removed = await handler(request(`/api/community/templates/${template.id}`, "DELETE", undefined, { "x-test-user": "alice" }));
    assert.equal(removed.status, 200);
    // The template is off the community list but its history is still there.
    const list = await handler(request("/api/community/templates", "GET", undefined, { "x-test-user": "alice" }));
    const mine = (await list.json()).templates.filter((item) => item.id === template.id);
    assert.equal(mine.length, 1);
    assert.equal(mine[0].visibility, "private");
    assert.ok(mine[0].unpublishedAt > 0);
    const strangerList = await handler(request("/api/community/templates", "GET", undefined, { "x-test-user": "carol" }));
    assert.equal((await strangerList.json()).templates.length, 0);

    const events = await handler(request(`/api/community/templates/${template.id}/events`, "GET", undefined, { "x-test-user": "alice" }));
    const actions = (await events.json()).events.map((event) => event.action);
    assert.deepEqual(actions, ["community.publish", "community.unpublish"]);
    // Another account cannot read the trail of somebody else's template.
    const otherEvents = await handler(request(`/api/community/templates/${template.id}/events`, "GET", undefined, { "x-test-user": "bob" }));
    assert.deepEqual((await otherEvents.json()).events, []);
  });
});

test("the server refuses a template without a title, with an unknown family or with oversized content", async () => {
  await withStack(async ({ handler }) => {
    const noTitle = await handler(request("/api/community/templates", "POST", { sample: "travel", state }, { "x-test-user": "alice" }));
    assert.equal(noTitle.status, 400);
    const badSample = await handler(request("/api/community/templates", "POST", { sample: "../etc", title: "坏标识", state }, { "x-test-user": "alice" }));
    assert.equal(badSample.status, 400);
    const noState = await handler(request("/api/community/templates", "POST", { sample: "travel", title: "空内容" }, { "x-test-user": "alice" }));
    assert.equal(noState.status, 400);
    const huge = await handler(request("/api/community/templates", "POST", { sample: "travel", title: "超大内容", state: { blob: "x".repeat(300_000) } }, { "x-test-user": "alice" }));
    assert.equal(huge.status, 413);
  });
});
