const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const { ProfileStore } = require("../../dist/local/server/api/profile.js");
const { handleProfileRequest } = require("../../dist/local/server/api/profile-api.js");

function withStore(run) {
  const directory = mkdtempSync(join(tmpdir(), "profile-"));
  const store = new ProfileStore(join(directory, "profile.sqlite"));
  return Promise.resolve(run(store)).finally(() => {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  });
}

const request = (path, method = "GET", body, headers = {}) =>
  new Request(`http://local${path}`, {
    method,
    headers: { "content-type": "application/json", origin: "http://local", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

test("preferences follow the account and never cross accounts", async () => {
  await withStore((store) => {
    store.savePreference("owner-a", "theme", { mode: "dark" });
    store.savePreference("owner-a", "density", "compact");
    store.savePreference("owner-b", "theme", { mode: "light" });
    const mine = store.listPreferences("owner-a");
    assert.equal(mine.length, 2);
    assert.deepEqual(mine.find((item) => item.key === "theme").value, { mode: "dark" });
    assert.equal(store.listPreferences("owner-b").length, 1);
    assert.equal(store.listPreferences("owner-c").length, 0);
  });
});

test("a memory is only stored with the person's own consent", async () => {
  await withStore((store) => {
    assert.throws(() => store.addMemory("owner-a", { content: "我喜欢简洁的界面", consent: false }), /明确同意/);
    const memory = store.addMemory("owner-a", { content: "我喜欢简洁的界面", kind: "preference", source: "设置页", consent: true });
    assert.equal(memory.consent, true);
    assert.equal(store.listMemories("owner-a").length, 1);
    assert.equal(store.listMemories("owner-b").length, 0);
    assert.equal(store.deleteMemory("owner-b", memory.id), false);
    assert.equal(store.deleteMemory("owner-a", memory.id), true);
  });
});

test("a device is recorded from the real request that used the account", async () => {
  await withStore((store) => {
    const device = store.touchDevice("owner-a", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0 Safari/537.36");
    assert.match(device.label, /Chrome/);
    assert.match(device.label, /macOS/);
    store.touchDevice("owner-a", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0 Safari/537.36");
    assert.equal(store.listDevices("owner-a").length, 1);
    assert.equal(store.listDevices("owner-b").length, 0);
  });
});

test("export contains only the account's own data", async () => {
  await withStore((store) => {
    store.savePreference("owner-a", "theme", "dark");
    store.addMemory("owner-a", { content: "记住这个", consent: true });
    store.touchDevice("owner-a", "Chrome/120");
    const exported = store.exportOwner("owner-a");
    assert.equal(exported.preferences.length, 1);
    assert.equal(exported.memories.length, 1);
    assert.equal(exported.devices.length, 1);
    assert.equal(store.exportOwner("owner-b").preferences.length, 0);
  });
});

test("forget clears the memories and preferences of that account only", async () => {
  await withStore((store) => {
    store.savePreference("owner-a", "theme", "dark");
    store.addMemory("owner-a", { content: "记住这个", consent: true });
    store.savePreference("owner-b", "theme", "light");
    const result = store.forgetOwner("owner-a");
    assert.equal(result.memories, 1);
    assert.equal(result.preferences, 1);
    assert.equal(store.listMemories("owner-a").length, 0);
    assert.equal(store.listPreferences("owner-b").length, 1);
  });
});

test("the profile routes answer with the account's own data", async () => {
  await withStore(async (store) => {
    const response = await handleProfileRequest(request("/api/profile"), "owner-a", store);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.owner, "owner-a");
    assert.deepEqual(payload.preferences, []);
    assert.deepEqual(payload.memories, []);
  });
});

test("writing a preference and a memory goes through the routes", async () => {
  await withStore(async (store) => {
    const saved = await handleProfileRequest(request("/api/profile/preferences", "PUT", { key: "theme", value: { mode: "dark" } }), "owner-a", store);
    assert.equal(saved.status, 200);
    const body = await saved.json();
    assert.equal(body.preference.key, "theme");

    const refused = await handleProfileRequest(request("/api/profile/memories", "POST", { content: "没有同意", consent: false }), "owner-a", store);
    assert.equal(refused.status, 400);
    assert.match((await refused.json()).error, /明确同意/);

    const accepted = await handleProfileRequest(request("/api/profile/memories", "POST", { content: "我喜欢简洁的界面", consent: true, kind: "preference" }), "owner-a", store);
    assert.equal(accepted.status, 200);
    const memory = (await accepted.json()).memory;
    assert.equal(memory.consent, true);

    const other = await handleProfileRequest(request(`/api/profile/memories/${memory.id}`, "DELETE"), "owner-b", store);
    assert.equal(other.status, 404);
  });
});

test("export and forget need the account's own confirmation", async () => {
  await withStore(async (store) => {
    store.savePreference("owner-a", "theme", "dark");
    const exported = await handleProfileRequest(request("/api/profile/export"), "owner-a", store);
    assert.equal(exported.status, 200);
    assert.match(exported.headers.get("content-disposition") || "", /attachment/);

    const refused = await handleProfileRequest(request("/api/profile/forget", "POST", {}), "owner-a", store);
    assert.equal(refused.status, 400);
    assert.match((await refused.json()).error, /本人确认/);

    const confirmed = await handleProfileRequest(request("/api/profile/forget", "POST", { confirm: true }), "owner-a", store);
    assert.equal(confirmed.status, 200);
    assert.equal((await confirmed.json()).forgotten.preferences, 1);
  });
});

test("cross-site writes are refused and unknown routes answer with 404", async () => {
  await withStore(async (store) => {
    const crossSite = await handleProfileRequest(
      request("/api/profile/preferences", "PUT", { key: "theme", value: 1 }, { origin: "https://evil.example" }),
      "owner-a",
      store,
    );
    assert.equal(crossSite.status, 403);
    assert.equal((await handleProfileRequest(request("/api/profile/nope"), "owner-a", store)).status, 404);
  });
});
