const { test } = require("node:test");
const assert = require("node:assert/strict");
const { PluginRegistry, loadBundles } = require("../../dist/local/server/api/plugin-registry.js");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

function withRegistry(run, bundles) {
  const directory = mkdtempSync(join(tmpdir(), "plugin-registry-"));
  const registry = new PluginRegistry(join(directory, "plugins.sqlite"), bundles);
  return Promise.resolve(run(registry)).finally(() => {
    registry.close();
    rmSync(directory, { recursive: true, force: true });
  });
}

const request = (path, method = "GET", body, headers = {}) =>
  new Request(`http://local${path}`, {
    method,
    headers: { "content-type": "application/json", origin: "http://local", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

const realBundles = () => loadBundles(join(__dirname, "../../server/plugins/bundles.json"));

test("the shipped bundles only name skills the server really registers", () => {
  const bundles = realBundles();
  assert.ok(bundles.length >= 4, "at least four bundles are offered");
  const { runtimeCatalog } = require("../../dist/local/server/skills/runtime-catalog.js");
  const known = new Set(runtimeCatalog().map(skill => skill.id));
  for (const bundle of bundles) {
    assert.ok(bundle.skills.length > 0);
    for (const skill of bundle.skills) {
      assert.ok(known.has(skill), `${bundle.id} references unknown skill ${skill}`);
    }
    assert.ok(bundle.permissions.length > 0, "a bundle must declare its permissions");
  }
});

test("install, disable, enable and uninstall are real persisted state changes", async () => {
  await withRegistry(async registry => {
    const bundle = realBundles()[0];
    const installed = registry.install("alice", bundle.id);
    assert.equal(installed.ok, true);
    assert.equal(installed.plugin.status, "enabled");
    assert.equal(registry.listInstalled("alice").length, 1);
    assert.equal(registry.listInstalled("bob").length, 0, "another identity must not see the plugin");

    const disabled = registry.setStatus("alice", bundle.id, "disabled");
    assert.equal(disabled.ok, true);
    assert.equal(disabled.plugin.status, "disabled");
    const enabled = registry.setStatus("alice", bundle.id, "enabled");
    assert.equal(enabled.plugin.status, "enabled");

    const events = registry.listEvents("alice");
    assert.deepEqual(events.map(event => event.action), ["enabled", "disabled", "installed"]);
    assert.equal(registry.listEvents("bob").length, 0);

    const removed = registry.uninstall("alice", bundle.id);
    assert.equal(removed.ok, true);
    assert.equal(registry.listInstalled("alice").length, 0);
    assert.equal(registry.listEvents("alice")[0].action, "uninstalled");
  });
});

test("an unknown bundle or an unknown skill is refused with a reason", async () => {
  await withRegistry(async registry => {
    const missing = registry.install("alice", "bundle-does-not-exist");
    assert.equal(missing.ok, false);
    assert.match(missing.error, /没有这个插件包/);
    assert.equal(registry.listInstalled("alice").length, 0);

    const broken = registry.install("alice", "bundle-broken");
    assert.equal(broken.ok, false);
    assert.match(broken.error, /不存在的技能/);
    assert.equal(registry.listInstalled("alice").length, 0);
  }, [
    {
      id: "bundle-broken",
      name: "引用了不存在的技能",
      version: "1.0.0",
      description: "测试用",
      skills: ["skill.that.does.not.exist"],
      permissions: ["read_uploaded_files"],
      requires: [],
    },
  ]);
});

test("one identity cannot disable or uninstall another identity's plugin", async () => {
  await withRegistry(async registry => {
    const bundle = realBundles()[0];
    registry.install("alice", bundle.id);
    const blocked = registry.setStatus("bob", bundle.id, "disabled");
    assert.equal(blocked.ok, false);
    assert.match(blocked.error, /不属于当前身份/);
    const removed = registry.uninstall("bob", bundle.id);
    assert.equal(removed.ok, false);
    assert.equal(registry.listInstalled("alice").length, 1);
    assert.equal(registry.listInstalled("alice")[0].status, "enabled");
  });
});

test("the HTTP surface lists, installs, toggles and removes plugins", async () => {
  await withRegistry(async registry => {
    const bundle = realBundles()[0];
    const listed = await registry.handle(request("/api/plugins"), "alice");
    assert.equal(listed.status, 200);
    const listedBody = await listed.json();
    assert.ok(listedBody.bundles.length >= 4);
    assert.equal(listedBody.installed.length, 0);

    const installed = await registry.handle(request("/api/plugins/install", "POST", { id: bundle.id }), "alice");
    assert.equal(installed.status, 200);
    const installedBody = await installed.json();
    assert.equal(installedBody.plugin.id, bundle.id);

    const disabled = await registry.handle(request(`/api/plugins/${bundle.id}/status`, "POST", { status: "disabled" }), "alice");
    assert.equal((await disabled.json()).plugin.status, "disabled");

    const events = await registry.handle(request("/api/plugins/events"), "alice");
    const eventsBody = await events.json();
    assert.ok(eventsBody.events.length >= 2, "install and disable are logged");

    const removed = await registry.handle(request(`/api/plugins/${bundle.id}`, "DELETE"), "alice");
    assert.equal(removed.status, 200);
    const after = await registry.handle(request("/api/plugins"), "alice");
    assert.equal((await after.json()).installed.length, 0);

    const crossSite = await registry.handle(
      request(`/api/plugins/${bundle.id}/status`, "POST", { status: "enabled" }, { origin: "http://elsewhere.test" }),
      "alice",
    );
    assert.equal(crossSite.status, 403);
  });
});

test("a bundle that asks for another plugin interface version is refused with the reason", async () => {
  await withRegistry(async registry => {
    const future = registry.install("alice", "bundle-future");
    assert.equal(future.ok, false);
    assert.match(future.error, /插件接口/);
    assert.match(future.error, /2\.0/);
    assert.equal(registry.listInstalled("alice").length, 0);
  }, [
    {
      id: "bundle-future",
      name: "要求新接口的插件包",
      version: "1.0.0",
      apiVersion: "2.0",
      description: "测试用",
      skills: ["web.audit"],
      permissions: ["local.read", "local.write"],
      requires: [],
    },
  ]);
});

test("a bundle must declare exactly the permissions its skills really use", async () => {
  await withRegistry(async registry => {
    const missing = registry.install("alice", "bundle-under");
    assert.equal(missing.ok, false);
    assert.match(missing.error, /没有声明它需要的权限/);
    const extra = registry.install("alice", "bundle-over");
    assert.equal(extra.ok, false);
    assert.match(extra.error, /不会使用的权限/);
    assert.equal(registry.listInstalled("alice").length, 0);
  }, [
    {
      id: "bundle-under",
      name: "少声明权限的插件包",
      version: "1.0.0",
      apiVersion: "1.0",
      description: "测试用",
      skills: ["test.browser"],
      permissions: ["local.read", "local.write"],
      requires: [],
    },
    {
      id: "bundle-over",
      name: "多声明权限的插件包",
      version: "1.0.0",
      apiVersion: "1.0",
      description: "测试用",
      skills: ["web.audit"],
      permissions: ["local.read", "local.write", "network"],
      requires: [],
    },
  ]);
});

test("the shipped bundles declare exactly what their skills need and install with resolved versions", async () => {
  await withRegistry(async registry => {
    const { skillPermissions } = require("../../dist/local/server/skills/skill-permissions.js");
    for (const bundle of realBundles()) {
      const needed = new Set();
      for (const skill of bundle.skills) for (const permission of skillPermissions(skill)) needed.add(permission);
      assert.deepEqual(new Set(bundle.permissions), needed, bundle.id + " declares the real permissions");
      const compatibility = registry.compatibility(bundle);
      assert.equal(compatibility.compatible, true, bundle.id + " is compatible: " + compatibility.compatibleReason);
    }
    const bundle = realBundles()[0];
    const installed = registry.install("alice", bundle.id);
    assert.equal(installed.ok, true);
    assert.equal(installed.plugin.apiVersion, "1.0");
    assert.equal(installed.plugin.skillVersions.length, bundle.skills.length);
    for (const entry of installed.plugin.skillVersions) assert.match(entry, /@1\.\d+\.\d+$/);
    const listed = registry.list("alice");
    assert.equal(listed.apiVersion, "1.0");
    assert.ok(listed.bundles.every(item => item.compatible));
  });
});
