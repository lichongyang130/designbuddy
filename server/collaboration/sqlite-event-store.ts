import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { CollaborationEvent, CollaborationEventStore } from "./realtime-hub";

export class SQLiteCollaborationEventStore implements CollaborationEventStore {
  private database: DatabaseSync;

  constructor(filePath = process.env.DESIGNBUDDY_SQLITE_PATH || "./data/designbuddy.sqlite") {
    const fullPath = resolve(filePath);
    mkdirSync(dirname(fullPath), { recursive: true });
    this.database = new DatabaseSync(fullPath);
    this.database.exec(`CREATE TABLE IF NOT EXISTS collaboration_events (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, user_id TEXT NOT NULL,
      event_type TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL
    ); CREATE INDEX IF NOT EXISTS collaboration_project_created ON collaboration_events(project_id, created_at);`);
  }

  append(event: CollaborationEvent): void {
    this.database.prepare("INSERT INTO collaboration_events(id, project_id, user_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(event.id, event.projectId, event.userId, event.type, JSON.stringify(event.payload), event.createdAt);
  }

  recent(projectId: string, limit: number): CollaborationEvent[] {
    const rows = this.database.prepare("SELECT id, project_id, user_id, event_type, payload_json, created_at FROM collaboration_events WHERE project_id = ? ORDER BY created_at DESC LIMIT ?").all(projectId, Math.max(1, Math.min(500, limit))) as Array<Record<string, string>>;
    return rows.reverse().map((row) => ({ id: row.id, projectId: row.project_id, userId: row.user_id, type: row.event_type as CollaborationEvent["type"], payload: JSON.parse(row.payload_json), createdAt: row.created_at }));
  }

  close(): void { this.database.close(); }
}
