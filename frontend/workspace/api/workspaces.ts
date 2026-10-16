import { apiFetch, readJSON } from "../../../apps/web/src/api/client";
import type { DesignProject } from "../models/project";

/** The role a person has inside a workspace. */
export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

export type Workspace = {
  id: string;
  name: string;
  ownerId: string;
  /** Only the owner sees the join code. */
  joinCode: string;
  createdAt: string;
  role?: WorkspaceRole;
};

export type WorkspaceMember = {
  userId: string;
  role: WorkspaceRole;
  createdAt: string;
};

export type WorkspaceDetail = {
  workspace: Workspace;
  role: WorkspaceRole;
  members: WorkspaceMember[];
  projects: DesignProject[];
};

const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: "所有者",
  admin: "管理员",
  member: "成员",
  viewer: "只读成员",
};

export function workspaceRoleLabel(role: WorkspaceRole | undefined): string {
  return role ? ROLE_LABELS[role] : "未知角色";
}

/** The workspaces the signed in account belongs to. */
export async function listWorkspaces(): Promise<Workspace[]> {
  const body = await readJSON<{ workspaces?: Workspace[] }>(
    await apiFetch("/workspaces", { headers: { Accept: "application/json" } }),
  );
  return Array.isArray(body.workspaces) ? body.workspaces : [];
}

/** Create a workspace. The creator becomes its owner. */
export async function createWorkspace(name: string): Promise<{ workspace: Workspace; members: WorkspaceMember[] }> {
  return readJSON<{ workspace: Workspace; members: WorkspaceMember[] }>(
    await apiFetch("/workspaces", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),
  );
}

/** Join a workspace with its join code. */
export async function joinWorkspace(code: string): Promise<Workspace> {
  const body = await readJSON<{ workspace?: Workspace }>(
    await apiFetch("/workspaces/join", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    }),
  );
  if (!body.workspace) throw Error("服务器没有确认加入结果。");
  return body.workspace;
}

/** The workspace, its members and its projects. */
export async function getWorkspace(workspaceId: string): Promise<WorkspaceDetail> {
  return readJSON<WorkspaceDetail>(
    await apiFetch(`/workspaces/${encodeURIComponent(workspaceId)}`, { headers: { Accept: "application/json" } }),
  );
}

/** Add a member, or change the role of an existing one. */
export async function setWorkspaceMember(
  workspaceId: string,
  userId: string,
  role: WorkspaceRole,
): Promise<{ members: WorkspaceMember[] }> {
  return readJSON<{ members: WorkspaceMember[] }>(
    await apiFetch(`/workspaces/${encodeURIComponent(workspaceId)}/members`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role }),
    }),
  );
}

export async function changeWorkspaceMemberRole(
  workspaceId: string,
  userId: string,
  role: WorkspaceRole,
): Promise<{ members: WorkspaceMember[] }> {
  return readJSON<{ members: WorkspaceMember[] }>(
    await apiFetch(`/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    }),
  );
}

export async function removeWorkspaceMember(
  workspaceId: string,
  userId: string,
): Promise<{ members: WorkspaceMember[] }> {
  return readJSON<{ members: WorkspaceMember[] }>(
    await apiFetch(`/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(userId)}`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
    }),
  );
}

/** Rotate the join code, or close joining altogether. */
export async function updateWorkspaceJoinCode(
  workspaceId: string,
  options: { enabled?: boolean; rotate?: boolean } = {},
): Promise<{ joinCode: string; enabled: boolean }> {
  return readJSON<{ joinCode: string; enabled: boolean }>(
    await apiFetch(`/workspaces/${encodeURIComponent(workspaceId)}/join-code`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(options),
    }),
  );
}

export async function deleteWorkspace(workspaceId: string): Promise<{ deleted: boolean }> {
  return readJSON<{ deleted: boolean }>(
    await apiFetch(`/workspaces/${encodeURIComponent(workspaceId)}`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
    }),
  );
}
