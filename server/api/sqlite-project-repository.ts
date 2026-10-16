import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { ApiProject, ProjectRepository } from "./http-handler";

/** Local-first durable project store for Node 22.5+ deployments. */
export class SQLiteProjectRepository implements ProjectRepository {
  private database: DatabaseSync;
  constructor(filePath = process.env.DESIGNBUDDY_SQLITE_PATH || "./data/designbuddy.sqlite") {
    const fullPath = resolve(filePath);
    mkdirSync(dirname(fullPath), { recursive: true });
    this.database = new DatabaseSync(fullPath);
  }

  private async ready(): Promise<void> {
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS projects (
        owner_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        project_json TEXT NOT NULL,
        PRIMARY KEY (owner_id, project_id)
      );
      CREATE INDEX IF NOT EXISTS projects_owner_updated ON projects(owner_id, updated_at DESC);
    `);
  }

  async listByOwner(ownerId: string): Promise<ApiProject[]> {
    await this.ready();
    const rows = this.database.prepare("SELECT project_json FROM projects WHERE owner_id = ? ORDER BY updated_at DESC").all(ownerId) as Array<{ project_json: string }>;
    return rows.map((row) => JSON.parse(row.project_json) as ApiProject);
  }

  async getById(ownerId: string, projectId: string): Promise<ApiProject | null> {
    await this.ready();
    const row = this.database.prepare("SELECT project_json FROM projects WHERE owner_id = ? AND project_id = ?").get(ownerId, projectId) as { project_json: string } | undefined;
    return row ? JSON.parse(row.project_json) as ApiProject : null;
  }

  async save(ownerId: string, project: ApiProject): Promise<ApiProject> {
    await this.ready();
    const collision = this.database.prepare("SELECT owner_id FROM projects WHERE project_id = ? LIMIT 1").get(project.id) as { owner_id: string } | undefined;
    if (collision && collision.owner_id !== ownerId) throw new Error("Project id is already in use.");
    const saved = { ...structuredClone(project), updatedAt: new Date().toISOString() };
    this.database.prepare(`INSERT INTO projects(owner_id, project_id, name, updated_at, project_json)
      VALUES (?, ?, ?, ?, ?) ON CONFLICT(owner_id, project_id) DO UPDATE SET
      name = excluded.name, updated_at = excluded.updated_at, project_json = excluded.project_json`)
      .run(ownerId, saved.id, saved.name, saved.updatedAt, JSON.stringify(saved));
    return saved;
  }

  async delete(ownerId: string, projectId: string): Promise<boolean> {
    await this.ready();
    return this.database.prepare("DELETE FROM projects WHERE owner_id = ? AND project_id = ?").run(ownerId, projectId).changes > 0;
  }

  close(): void {
    this.database.close();
  }
}
