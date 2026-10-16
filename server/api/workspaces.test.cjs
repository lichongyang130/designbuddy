const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const { SQLiteWorkspaceStore, canEditWorkspace } = require("../../dist/local/server/api/workspaces.js");
const { createApiHandler } = require("../../dist/local/server/api/http-handler.js");

function withStore(run) {
  const directory = mkdtempSync(join(tmpdir(), "workspaces-"));
  const store = new SQLiteWorkspaceStore(join(directory, "workspaces.sqlite"));
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

/** A project store that also answers the workspace lookups. */
function projectStore() {
  const projects = new Map();
  return {
    listByOwner: async (ownerId) => [...projects.values()].filter((item) => item.ownerId === ownerId).map((item) => item.project),
    getById: async (ownerId, id) => {
      const entry = projects.get(id);
      return entry && entry.ownerId === ownerId ? entry.project : null;
    },
    findById: async (id) => {
      const entry = projects.get(id);
      return entry ? { ownerId: entry.ownerId, project: entry.project } : null;
    },
    listByWorkspace: async (workspaceId) =>
      [...projects.values()].filter((item) => item.project.workspaceId === workspaceId).map((item) => ({ ownerId: item.ownerId, project: item.project })),
    save: async (ownerId, project) => {
      const saved = { ...project, ownerId, updatedAt: new Date().toISOString() };
      projects.set(project.id, { ownerId, project: saved });
      return saved;
    },
    delete: async (ownerId, id) => {
      const entry = projects.get(id);
      if (!entry || entry.ownerId !== ownerId) return false;
      return projects.delete(id);
    },
    raw: projects,
  };
}

const sample = (id = "p1", content = "<h1>v1</h1>", workspaceId) => ({
  id,
  name: "项目",
  prompt: "做个页面",
  files: [{ path: "index.html", content }],
  ...(workspaceId ? { workspaceId } : {}),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  status: "draft",
});

test("a new workspace has an owner, a join code and one member", async () => {
  await withStore((store) => {
    const workspace = store.create("owner", "设计团队");
    assert.equal(workspace.name, "设计团队");
    assert.match(workspace.joinCode, /^[A-Z0-9]{6}$/);
    assert.equal(store.roleFor(workspace.id, "owner"), "owner");
    assert.equal(store.listMembers(workspace.id).length, 1);
    assert.equal(store.listFor("owner").length, 1);
    assert.equal(store.listFor("somebody").length, 0);
  });
});

test("a join code adds a member and an unknown code does not", async () => {
  await withStore((store) => {
    const workspace = store.create("owner", "设计团队");
    const joined = store.joinByCode("guest", workspace.joinCode);
    assert.equal(joined.id, workspace.id);
    assert.equal(store.roleFor(workspace.id, "guest"), "member");
    assert.equal(store.joinByCode("other", "NOPE12"), null);
    // The join code can be closed; afterwards nobody can join with it.
    store.setJoinCodeEnabled(workspace.id, "owner", false);
    assert.equal(store.joinByCode("late", workspace.joinCode), null);
    // A new code works again.
    const code = store.rotateJoinCode(workspace.id, "owner");
    assert.equal(store.joinByCode("late", code).id, workspace.id);
  });
});

test("only owners and admins manage the member list", async () => {
  await withStore((store) => {
    const workspace = store.create("owner", "设计团队");
    store.addMember(workspace.id, "owner", "admin", "admin");
    // A member may not add other members.
    store.addMember(workspace.id, "owner", "member", "member");
    assert.throws(() => store.addMember(workspace.id, "member", "intruder", "viewer"), /只有工作空间的所有者或管理员/);
    // An admin may.
    store.addMember(workspace.id, "admin", "guest", "viewer");
    assert.equal(store.roleFor(workspace.id, "guest"), "viewer");
    // The owner cannot be removed or demoted.
    assert.throws(() => store.removeMember(workspace.id, "admin", "owner"), /不能移除工作空间的所有者/);
    assert.throws(() => store.setRole(workspace.id, "admin", "owner", "viewer"), /不能修改所有者的角色/);
    // A member can be removed again.
    assert.equal(store.removeMember(workspace.id, "admin", "guest"), true);
    assert.equal(store.roleFor(workspace.id, "guest"), null);
  });
});

test("the join code is only visible to the people who may manage members", async () => {
  await withStore(async (store) => {
    const workspace = store.create("owner", "设计团队");
    store.addMember(workspace.id, "owner", "admin", "admin");
    store.addMember(workspace.id, "owner", "member", "member");
    assert.equal(store.listFor("owner")[0].joinCode, workspace.joinCode);
    assert.equal(store.listFor("admin")[0].joinCode, workspace.joinCode);
    assert.equal(store.listFor("member")[0].joinCode, "");

    const projects = projectStore();
    const owner = createApiHandler({ authenticate: async () => ({ id: "owner" }), projects, workspaces: store });
    const admin = createApiHandler({ authenticate: async () => ({ id: "admin" }), projects, workspaces: store });
    const member = createApiHandler({ authenticate: async () => ({ id: "member" }), projects, workspaces: store });
    const ownerView = await (await owner(request(`/api/workspaces/${workspace.id}`))).json();
    assert.equal(ownerView.workspace.joinCode, workspace.joinCode);
    const adminView = await (await admin(request(`/api/workspaces/${workspace.id}`))).json();
    assert.equal(adminView.workspace.joinCode, workspace.joinCode);
    const memberView = await (await member(request(`/api/workspaces/${workspace.id}`))).json();
    assert.equal(memberView.workspace.joinCode, "");
  });
});

test("the workspace routes create, list and join workspaces", async () => {
  await withStore(async (store) => {
    const projects = projectStore();
    const owner = createApiHandler({ authenticate: async () => ({ id: "owner" }), projects, workspaces: store });
    const created = await owner(request("/api/workspaces", "POST", { name: "设计团队" }));
    assert.equal(created.status, 200);
    const body = await created.json();
    assert.equal(body.workspace.name, "设计团队");
    assert.equal(body.members.length, 1);
    const code = body.workspace.joinCode;

    // Another account joins with the code.
    const guest = createApiHandler({ authenticate: async () => ({ id: "guest" }), projects, workspaces: store });
    const joined = await guest(request("/api/workspaces/join", "POST", { code }));
    assert.equal(joined.status, 200);
    assert.equal((await joined.json()).role, "member");
    // A wrong code is refused.
    const wrong = await guest(request("/api/workspaces/join", "POST", { code: "ZZZZZZ" }));
    assert.equal(wrong.status, 404);

    // Both accounts see the workspace, an outsider does not.
    const list = await (await owner(request("/api/workspaces"))).json();
    assert.equal(list.workspaces.length, 1);
    assert.equal(list.workspaces[0].role, "owner");
    const outsider = createApiHandler({ authenticate: async () => ({ id: "outsider" }), projects, workspaces: store });
    const denied = await outsider(request(`/api/workspaces/${body.workspace.id}`));
    assert.equal(denied.status, 403);
  });
});

test("a workspace project is visible to members and hidden from outsiders", async () => {
  await withStore(async (store) => {
    const projects = projectStore();
    const owner = createApiHandler({ authenticate: async () => ({ id: "owner" }), projects, workspaces: store });
    const created = await (await owner(request("/api/workspaces", "POST", { name: "设计团队" }))).json();
    const workspaceId = created.workspace.id;
    const saved = await owner(request("/api/projects", "POST", sample("p1", "<h1>工作区版本</h1>", workspaceId)));
    assert.equal(saved.status, 200);

    // A member with the role "member" may read and change the project.
    const member = createApiHandler({ authenticate: async () => ({ id: "member" }), projects, workspaces: store });
    store.addMember(workspaceId, "owner", "member", "member");
    const list = await (await member(request("/api/projects"))).json();
    assert.equal(list.length, 1);
    assert.equal(list[0].access, "editor");
    const memberSave = await member(request("/api/projects", "POST", sample("p1", "<h1>成员改的</h1>", workspaceId)));
    assert.equal(memberSave.status, 200);

    // A viewer may read it but not change it.
    store.addMember(workspaceId, "owner", "viewer", "viewer");
    const viewer = createApiHandler({ authenticate: async () => ({ id: "viewer" }), projects, workspaces: store });
    const viewerList = await (await viewer(request("/api/projects"))).json();
    assert.equal(viewerList[0].access, "viewer");
    const viewerSave = await viewer(request("/api/projects", "POST", sample("p1", "<h1>只读的人改的</h1>", workspaceId)));
    assert.equal(viewerSave.status, 403);
    assert.equal((await viewerSave.json()).error.includes("只读"), true);

    // An outsider sees nothing at all.
    const outsider = createApiHandler({ authenticate: async () => ({ id: "outsider" }), projects, workspaces: store });
    assert.equal((await (await outsider(request("/api/projects"))).json()).length, 0);
    assert.equal((await outsider(request("/api/projects/p1"))).status, 404);
  });
});

test("a project may only be written into a workspace the person belongs to", async () => {
  await withStore(async (store) => {
    const projects = projectStore();
    const owner = createApiHandler({ authenticate: async () => ({ id: "owner" }), projects, workspaces: store });
    const created = await (await owner(request("/api/workspaces", "POST", { name: "设计团队" }))).json();
    const workspaceId = created.workspace.id;
    const stranger = createApiHandler({ authenticate: async () => ({ id: "stranger" }), projects, workspaces: store });
    const refused = await stranger(request("/api/projects", "POST", sample("p2", "<h1>越权</h1>", workspaceId)));
    assert.equal(refused.status, 403);
    assert.equal((await refused.json()).error.includes("工作空间"), true);
    // A project without a workspace is still allowed for everybody.
    const allowed = await stranger(request("/api/projects", "POST", sample("p3", "<h1>个人项目</h1>")));
    assert.equal(allowed.status, 200);
  });
});

test("the roles decide what a member may do with the projects", () => {
  assert.equal(canEditWorkspace("owner"), true);
  assert.equal(canEditWorkspace("admin"), true);
  assert.equal(canEditWorkspace("member"), true);
  assert.equal(canEditWorkspace("viewer"), false);
  assert.equal(canEditWorkspace(null), false);
});
