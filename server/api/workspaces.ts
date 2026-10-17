import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { randomBytes, randomUUID } from "node:crypto";

/**
 * Workspaces and organisation members.
 *
 * A workspace is the tenant boundary for projects: the role a person has in a
 * workspace decides what they may do with the projects inside it. Roles are
 * checked on the server for every read and write, never only in the interface.
 */
export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  /** The code that lets somebody join the workspace. Empty means joining is closed. */
  joinCode: string;
  createdAt: string;
}

export interface WorkspaceMember {
  userId: string;
  role: WorkspaceRole;
  createdAt: string;
}

export interface WorkspaceStore {
  create(ownerId: string, name: string): Workspace;
  listFor(userId: string): Workspace[];
  get(workspaceId: string): Workspace | null;
  roleFor(workspaceId: string, userId: string): WorkspaceRole | null;
  listMembers(workspaceId: string): WorkspaceMember[];
  addMember(workspaceId: string, actorId: string, userId: string, role: WorkspaceRole): WorkspaceMember;
  removeMember(workspaceId: string, actorId: string, userId: string): boolean;
  setRole(workspaceId: string, actorId: string, userId: string, role: WorkspaceRole): WorkspaceMember;
  joinByCode(userId: string, code: string): Workspace | null;
  rotateJoinCode(workspaceId: string, actorId: string): string | null;
  setJoinCodeEnabled(workspaceId: string, actorId: string, enabled: boolean): boolean;
  remove(workspaceId: string, actorId: string): boolean;
  close(): void;
}

const ROLES: WorkspaceRole[] = ["owner", "admin", "member", "viewer"];

/** The person may not do this; the server answers 403. */
export class WorkspacePermissionError extends Error {}
/** The request itself is wrong; the server answers 400. */
export class WorkspaceInputError extends Error {}

/** Roles that may read and change the projects of a workspace. */
export function canEditWorkspace(role: WorkspaceRole | null): boolean {
  return role === "owner" || role === "admin" || role === "member";
}

/** Roles that may read the projects of a workspace. */
export function canViewWorkspace(role: WorkspaceRole | null): boolean {
  return role !== null;
}

/** Roles that may manage the members of a workspace. */
export function canManageMembers(role: WorkspaceRole | null): boolean {
  return role === "owner" || role === "admin";
}

function joinCode(): string {
  // Six characters without ambiguous symbols, so a code can be read out loud.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let code = "";
  for (const byte of bytes) code += alphabet[byte % alphabet.length];
  return code;
}

export class SQLiteWorkspaceStore implements WorkspaceStore {
  private database: DatabaseSync;

  constructor(filePath = process.env.DESIGNBUDDY_SQLITE_PATH || "./data/designbuddy.sqlite") {
    const fullPath = resolve(filePath);
    mkdirSync(dirname(fullPath), { recursive: true });
    this.database = new DatabaseSync(fullPath);
    this.database.exec(`CREATE TABLE IF NOT EXISTS workspaces (
      workspace_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      join_code TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    ); CREATE INDEX IF NOT EXISTS workspaces_owner ON workspaces(owner_id);
      CREATE TABLE IF NOT EXISTS workspace_members (
        workspace_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('owner','admin','member','viewer')),
        created_at TEXT NOT NULL,
        PRIMARY KEY(workspace_id, user_id)
      ); CREATE INDEX IF NOT EXISTS workspace_members_user ON workspace_members(user_id);`);
  }

  create(ownerId: string, name: string): Workspace {
    const workspace: Workspace = {
      id: randomUUID(),
      name: name.trim().slice(0, 80) || "未命名工作空间",
      ownerId,
      joinCode: joinCode(),
      createdAt: new Date().toISOString(),
    };
    this.database
      .prepare("INSERT INTO workspaces(workspace_id, name, owner_id, join_code, created_at) VALUES(?,?,?,?,?)")
      .run(workspace.id, workspace.name, workspace.ownerId, workspace.joinCode, workspace.createdAt);
    this.database
      .prepare("INSERT INTO workspace_members(workspace_id, user_id, role, created_at) VALUES(?,?,?,?)")
      .run(workspace.id, ownerId, "owner", workspace.createdAt);
    return workspace;
  }

  listFor(userId: string): Workspace[] {
    const rows = this.database
      .prepare(
        `SELECT w.workspace_id, w.name, w.owner_id, w.join_code, w.created_at
         FROM workspaces w JOIN workspace_members m ON m.workspace_id = w.workspace_id
         WHERE m.user_id = ? ORDER BY w.created_at`,
      )
      .all(userId) as Array<{ workspace_id: string; name: string; owner_id: string; join_code: string; created_at: string }>;
    return rows.map((row) => {
      // The join code is a secret: only the people who may manage members see it.
      const role = this.roleFor(row.workspace_id, userId);
      return {
        id: row.workspace_id,
        name: row.name,
        ownerId: row.owner_id,
        joinCode: canManageMembers(role) ? row.join_code : "",
        createdAt: row.created_at,
      };
    });
  }

  get(workspaceId: string): Workspace | null {
    const row = this.database
      .prepare("SELECT workspace_id, name, owner_id, join_code, created_at FROM workspaces WHERE workspace_id=?")
      .get(workspaceId) as { workspace_id: string; name: string; owner_id: string; join_code: string; created_at: string } | undefined;
    return row
      ? { id: row.workspace_id, name: row.name, ownerId: row.owner_id, joinCode: row.join_code, createdAt: row.created_at }
      : null;
  }

  roleFor(workspaceId: string, userId: string): WorkspaceRole | null {
    const row = this.database
      .prepare("SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?")
      .get(workspaceId, userId) as { role: WorkspaceRole } | undefined;
    return row?.role ?? null;
  }

  listMembers(workspaceId: string): WorkspaceMember[] {
    const rows = this.database
      .prepare("SELECT user_id, role, created_at FROM workspace_members WHERE workspace_id=? ORDER BY created_at")
      .all(workspaceId) as Array<{ user_id: string; role: WorkspaceRole; created_at: string }>;
    return rows.map((row) => ({ userId: row.user_id, role: row.role, createdAt: row.created_at }));
  }

  addMember(workspaceId: string, actorId: string, userId: string, role: WorkspaceRole): WorkspaceMember {
    if (!ROLES.includes(role)) throw new WorkspaceInputError("未知的工作空间成员角色。");
    this.assertManager(workspaceId, actorId);
    const createdAt = new Date().toISOString();
    this.database
      .prepare(
        `INSERT INTO workspace_members(workspace_id, user_id, role, created_at) VALUES(?,?,?,?)
         ON CONFLICT(workspace_id, user_id) DO UPDATE SET role=excluded.role`,
      )
      .run(workspaceId, userId, role, createdAt);
    return { userId, role, createdAt };
  }

  removeMember(workspaceId: string, actorId: string, userId: string): boolean {
    const workspace = this.get(workspaceId);
    if (!workspace) return false;
    this.assertManager(workspaceId, actorId);
    if (workspace.ownerId === userId) throw new WorkspacePermissionError("不能移除工作空间的所有者。");
    return (
      this.database
        .prepare("DELETE FROM workspace_members WHERE workspace_id=? AND user_id=?")
        .run(workspaceId, userId).changes > 0
    );
  }

  setRole(workspaceId: string, actorId: string, userId: string, role: WorkspaceRole): WorkspaceMember {
    if (!ROLES.includes(role)) throw new WorkspaceInputError("未知的工作空间成员角色。");
    this.assertManager(workspaceId, actorId);
    const workspace = this.get(workspaceId);
    if (!workspace) throw new WorkspaceInputError("工作空间不存在。");
    if (workspace.ownerId === userId) throw new WorkspacePermissionError("不能修改所有者的角色。");
    return this.addMember(workspaceId, actorId, userId, role);
  }

  joinByCode(userId: string, code: string): Workspace | null {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return null;
    const row = this.database
      .prepare("SELECT workspace_id, name, owner_id, join_code, created_at FROM workspaces WHERE join_code=?")
      .get(trimmed) as { workspace_id: string; name: string; owner_id: string; join_code: string; created_at: string } | undefined;
    if (!row) return null;
    const existing = this.roleFor(row.workspace_id, userId);
    if (!existing) {
      this.database
        .prepare("INSERT INTO workspace_members(workspace_id, user_id, role, created_at) VALUES(?,?,?,?)")
        .run(row.workspace_id, userId, "member", new Date().toISOString());
    }
    return {
      id: row.workspace_id,
      name: row.name,
      ownerId: row.owner_id,
      joinCode: row.owner_id === userId ? row.join_code : "",
      createdAt: row.created_at,
    };
  }

  rotateJoinCode(workspaceId: string, actorId: string): string | null {
    const workspace = this.get(workspaceId);
    if (!workspace) return null;
    this.assertManager(workspaceId, actorId);
    const code = joinCode();
    this.database.prepare("UPDATE workspaces SET join_code=? WHERE workspace_id=?").run(code, workspaceId);
    return code;
  }

  setJoinCodeEnabled(workspaceId: string, actorId: string, enabled: boolean): boolean {
    const workspace = this.get(workspaceId);
    if (!workspace) return false;
    this.assertManager(workspaceId, actorId);
    const code = enabled ? joinCode() : "";
    this.database.prepare("UPDATE workspaces SET join_code=? WHERE workspace_id=?").run(code, workspaceId);
    return true;
  }

  remove(workspaceId: string, actorId: string): boolean {
    const workspace = this.get(workspaceId);
    if (!workspace || workspace.ownerId !== actorId) return false;
    this.database.prepare("DELETE FROM workspace_members WHERE workspace_id=?").run(workspaceId);
    return this.database.prepare("DELETE FROM workspaces WHERE workspace_id=?").run(workspaceId).changes > 0;
  }

  /** Only the owner and admins may change the member list. */
  private assertManager(workspaceId: string, actorId: string): void {
    const workspace = this.get(workspaceId);
    if (!workspace) throw new WorkspaceInputError("工作空间不存在。");
    if (!canManageMembers(this.roleFor(workspaceId, actorId)))
      throw new WorkspacePermissionError("只有工作空间的所有者或管理员可以管理成员。");
  }

  close(): void {
    this.database.close();
  }
}
