import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export type ProjectMemberRole = "viewer" | "editor";
export interface ProjectMember { userId: string; role: ProjectMemberRole; createdAt: string; }
export interface ProjectMembershipStore {
  add(ownerId: string, projectId: string, userId: string, role: ProjectMemberRole): ProjectMember;
  remove(ownerId: string, projectId: string, userId: string): boolean;
  list(ownerId: string, projectId: string): ProjectMember[];
  ownerFor(projectId: string): string | null;
  roleFor(ownerId: string, projectId: string, userId: string): ProjectMemberRole | null;
  forUser(userId: string): Array<{ ownerId: string; projectId: string; role: ProjectMemberRole }>;
}

export class SQLiteProjectMembershipStore implements ProjectMembershipStore {
  private database: DatabaseSync;
  constructor(filePath = process.env.DESIGNBUDDY_SQLITE_PATH || "./data/designbuddy.sqlite") {
    const fullPath = resolve(filePath);
    mkdirSync(dirname(fullPath), { recursive: true });
    this.database = new DatabaseSync(fullPath);
    this.database.exec(`CREATE TABLE IF NOT EXISTS project_members (
      owner_id TEXT NOT NULL, project_id TEXT NOT NULL, user_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('viewer','editor')), created_at TEXT NOT NULL,
      PRIMARY KEY(owner_id, project_id, user_id)
    ); CREATE INDEX IF NOT EXISTS project_members_user ON project_members(user_id, project_id);`);
  }

  add(ownerId: string, projectId: string, userId: string, role: ProjectMemberRole): ProjectMember {
    const createdAt = new Date().toISOString();
    this.database.prepare(`INSERT INTO project_members(owner_id, project_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(owner_id, project_id, user_id) DO UPDATE SET role=excluded.role, created_at=excluded.created_at`).run(ownerId, projectId, userId, role, createdAt);
    return { userId, role, createdAt };
  }

  remove(ownerId: string, projectId: string, userId: string): boolean {
    return this.database.prepare("DELETE FROM project_members WHERE owner_id=? AND project_id=? AND user_id=?").run(ownerId, projectId, userId).changes > 0;
  }

  list(ownerId: string, projectId: string): ProjectMember[] {
    return (this.database.prepare("SELECT user_id, role, created_at FROM project_members WHERE owner_id=? AND project_id=? ORDER BY created_at").all(ownerId, projectId) as Array<{ user_id: string; role: ProjectMemberRole; created_at: string }>).map((row) => ({ userId: row.user_id, role: row.role, createdAt: row.created_at }));
  }

  ownerFor(projectId: string): string | null {
    return (this.database.prepare("SELECT owner_id FROM project_members WHERE project_id=? LIMIT 1").get(projectId) as { owner_id: string } | undefined)?.owner_id ?? null;
  }

  roleFor(ownerId: string, projectId: string, userId: string): ProjectMemberRole | null {
    return (this.database.prepare("SELECT role FROM project_members WHERE owner_id=? AND project_id=? AND user_id=?").get(ownerId, projectId, userId) as { role: ProjectMemberRole } | undefined)?.role ?? null;
  }

  forUser(userId: string): Array<{ ownerId: string; projectId: string; role: ProjectMemberRole }> {
    return (this.database.prepare("SELECT owner_id, project_id, role FROM project_members WHERE user_id=?").all(userId) as Array<{ owner_id: string; project_id: string; role: ProjectMemberRole }>).map((row) => ({ ownerId: row.owner_id, projectId: row.project_id, role: row.role }));
  }

  close(): void { this.database.close(); }
}
