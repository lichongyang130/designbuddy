const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

// The limits are read from the environment when the module is loaded, so they
// are set before the store is required.
process.env.DESIGNBUDDY_ASSET_MAX_FILE_BYTES = "2000";
process.env.DESIGNBUDDY_ASSET_MAX_FILES = "3";

const { AssetStore } = require("../../dist/local/server/api/assets.js");
const { createApiHandler } = require("../../dist/local/server/api/http-handler.js");

const request = (path, method = "GET", body, headers = {}) =>
  new Request(`http://local${path}`, {
    method,
    headers: { "content-type": "application/json", origin: "http://local", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

const upload = (name, mime, text, user = "alice", visibility) =>
  request(
    "/api/assets",
    "POST",
    { name, mime, dataBase64: Buffer.from(text, "utf8").toString("base64"), ...(visibility ? { visibility } : {}) },
    { "x-test-user": user },
  );

function withStack(run) {
  const directory = mkdtempSync(join(tmpdir(), "assets-"));
  const assets = new AssetStore(join(directory, "assets.sqlite"), join(directory, "files"));
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
    assets,
    workspaces,
    authenticate: async (req) => {
      const id = req.headers.get("x-test-user");
      return id ? { id } : null;
    },
  });
  return Promise.resolve(run({ handler, assets })).finally(() => {
    assets.close();
    rmSync(directory, { recursive: true, force: true });
  });
}

test("an uploaded text file is parsed on the server and stays with its owner", async () => {
  await withStack(async ({ handler }) => {
    const created = await handler(upload("brief.md", "text/markdown", "# 需求\n请做一个活动页面。"));
    assert.equal(created.status, 201);
    const { asset } = await created.json();
    assert.equal(asset.name, "brief.md");
    assert.equal(asset.extracted, true);
    assert.match(asset.excerpt, /请做一个活动页面/);
    assert.ok(asset.sha256.length === 64, "the server stores a fingerprint of the file");

    // The owner sees it in the library and can read the parsed text back.
    const list = await handler(request("/api/assets", "GET", undefined, { "x-test-user": "alice" }));
    assert.equal(list.status, 200);
    assert.equal((await list.json()).assets.length, 1);
    const content = await handler(request(`/api/assets/${asset.id}/content`, "GET", undefined, { "x-test-user": "alice" }));
    assert.equal(content.status, 200);
    assert.match((await content.json()).text, /活动页面/);

    // Another account does not see it and cannot read it.
    const otherList = await handler(request("/api/assets", "GET", undefined, { "x-test-user": "bob" }));
    assert.equal((await otherList.json()).assets.length, 0);
    const otherRead = await handler(request(`/api/assets/${asset.id}`, "GET", undefined, { "x-test-user": "bob" }));
    assert.equal(otherRead.status, 403);
  });
});

test("a binary file is stored but never invented into text", async () => {
  await withStack(async ({ handler }) => {
    const created = await handler(upload("logo.png", "image/png", "\x89PNG\r\n\x1a\n\u0000binary"));
    assert.equal(created.status, 201);
    const { asset } = await created.json();
    assert.equal(asset.extracted, false);
    assert.equal(asset.excerpt, "");
    const content = await handler(request(`/api/assets/${asset.id}/content`, "GET", undefined, { "x-test-user": "alice" }));
    assert.equal(content.status, 415);
    assert.match((await content.json()).error, /不是文本/);
  });
});

test("the visibility of an asset decides who may see it", async () => {
  await withStack(async ({ handler }) => {
    const created = await handler(upload("plan.txt", "text/plain", "计划", "alice"));
    const { asset } = await created.json();

    // A workspace peer sees a workspace asset.
    const updated = await handler(request(`/api/assets/${asset.id}`, "PATCH", { visibility: "workspace" }, { "x-test-user": "alice" }));
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).asset.visibility, "workspace");
    const peerList = await handler(request("/api/assets", "GET", undefined, { "x-test-user": "bob" }));
    assert.equal((await peerList.json()).assets.length, 1, "a teammate sees the shared asset");

    // A published asset is visible to every signed in account.
    const published = await handler(request(`/api/assets/${asset.id}`, "PATCH", { visibility: "public" }, { "x-test-user": "alice" }));
    assert.equal(published.status, 200);
    const strangerList = await handler(request("/api/assets", "GET", undefined, { "x-test-user": "carol" }));
    assert.equal((await strangerList.json()).assets.length, 1);
    const strangerRead = await handler(request(`/api/assets/${asset.id}`, "GET", undefined, { "x-test-user": "carol" }));
    assert.equal(strangerRead.status, 200);

    // Only the owner may change the visibility or delete the asset.
    const otherPatch = await handler(request(`/api/assets/${asset.id}`, "PATCH", { visibility: "private" }, { "x-test-user": "bob" }));
    assert.equal(otherPatch.status, 403);
  });
});

test("the library enforces real limits instead of storing everything", async () => {
  await withStack(async ({ handler }) => {
    const tooBig = await handler(upload("big.txt", "text/plain", "x".repeat(4000)));
    assert.equal(tooBig.status, 413);
    assert.match((await tooBig.json()).error, /不能超过/);

    const empty = await handler(upload("empty.txt", "text/plain", ""));
    assert.equal(empty.status, 400);

    for (let index = 0; index < 3; index += 1) {
      const created = await handler(upload(`file-${index}.txt`, "text/plain", `内容 ${index}`));
      assert.equal(created.status, 201);
    }
    const overflow = await handler(upload("file-4.txt", "text/plain", "第 4 个文件"));
    assert.equal(overflow.status, 413);
    assert.match((await overflow.json()).error, /上限/);
  });
});

test("the owner can delete an asset and every change is recorded", async () => {
  await withStack(async ({ handler }) => {
    const created = await handler(upload("draft.txt", "text/plain", "草稿"));
    const { asset } = await created.json();

    const otherDelete = await handler(request(`/api/assets/${asset.id}`, "DELETE", undefined, { "x-test-user": "bob" }));
    assert.equal(otherDelete.status, 403);

    const removed = await handler(request(`/api/assets/${asset.id}`, "DELETE", undefined, { "x-test-user": "alice" }));
    assert.equal(removed.status, 200);
    const afterDelete = await handler(request(`/api/assets/${asset.id}`, "GET", undefined, { "x-test-user": "alice" }));
    assert.equal(afterDelete.status, 404);

    const events = await handler(request(`/api/assets/${asset.id}/events`, "GET", undefined, { "x-test-user": "alice" }));
    assert.equal(events.status, 200);
    const actions = (await events.json()).events.map((event) => event.action);
    assert.deepEqual(actions, ["asset.upload", "asset.delete"]);
  });
});
