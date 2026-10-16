import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomBytes } from "node:crypto";

/**
 * Server controlled read-only shares.
 *
 * A share is a random token that lets anybody with the link read one project
 * snapshot until it expires or the owner revokes it. Nothing is embedded in
 * the URL, the server decides who may see it and for how long, and every
 * create/revoke is written into the project audit trail.
 */
export type ProjectShare = {
  token: string;
  projectId: string;
  ownerId: string;
  createdAt: number;
  expiresAt: number;
  revokedAt: number | null;
  views: number;
  lastViewedAt: number | null;
};

export const SHARE_MIN_DAYS = 1;
export const SHARE_MAX_DAYS = 30;
const DAY = 86_400_000;

export class ProjectShareStore {
  private db: DatabaseSync;

  constructor(file = process.env.DESIGNBUDDY_SHARES_SQLITE_PATH || "./data/shares.sqlite") {
    const path = resolve(file);
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS project_shares(token TEXT PRIMARY KEY,project_id TEXT NOT NULL,owner_id TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,revoked_at INTEGER NOT NULL DEFAULT 0,views INTEGER NOT NULL DEFAULT 0,last_viewed_at INTEGER NOT NULL DEFAULT 0);
      CREATE INDEX IF NOT EXISTS project_shares_project ON project_shares(project_id,created_at);`);
  }

  close() {
    this.db.close();
  }

  private row(value: Record<string, unknown>): ProjectShare {
    return {
      token: String(value.token),
      projectId: String(value.project_id),
      ownerId: String(value.owner_id),
      createdAt: Number(value.created_at),
      expiresAt: Number(value.expires_at),
      revokedAt: Number(value.revoked_at) || null,
      views: Number(value.views) || 0,
      lastViewedAt: Number(value.last_viewed_at) || null,
    };
  }

  /** Create a share link. The token is unguessable and the expiry is bounded. */
  create(ownerId: string, projectId: string, days: number): ProjectShare {
    const span = Math.min(SHARE_MAX_DAYS, Math.max(SHARE_MIN_DAYS, Math.round(days) || SHARE_MIN_DAYS));
    const now = Date.now();
    const token = randomBytes(24).toString("base64url");
    this.db
      .prepare("INSERT INTO project_shares(token,project_id,owner_id,created_at,expires_at,revoked_at,views,last_viewed_at) VALUES(?,?,?,?,?,0,0,0)")
      .run(token, projectId, ownerId, now, now + span * DAY);
    return this.row(this.db.prepare("SELECT * FROM project_shares WHERE token=?").get(token) as Record<string, unknown>);
  }

  get(token: string): ProjectShare | null {
    const row = this.db.prepare("SELECT * FROM project_shares WHERE token=?").get(token) as Record<string, unknown> | undefined;
    return row ? this.row(row) : null;
  }

  /** A share that can still be used: not revoked and not expired. */
  active(token: string): ProjectShare | null {
    const share = this.get(token);
    if (!share) return null;
    if (share.revokedAt) return null;
    if (share.expiresAt <= Date.now()) return null;
    return share;
  }

  listForProject(projectId: string, ownerId: string): ProjectShare[] {
    const rows = this.db
      .prepare("SELECT * FROM project_shares WHERE project_id=? AND owner_id=? ORDER BY created_at DESC")
      .all(projectId, ownerId) as Record<string, unknown>[];
    return rows.map((row) => this.row(row));
  }

  /** Revoke a share. Only the owner of the project may do this. */
  revoke(token: string, ownerId: string): boolean {
    const share = this.get(token);
    if (!share || share.ownerId !== ownerId) return false;
    if (share.revokedAt) return true;
    this.db.prepare("UPDATE project_shares SET revoked_at=? WHERE token=?").run(Date.now(), token);
    return true;
  }

  recordView(token: string) {
    this.db.prepare("UPDATE project_shares SET views=views+1, last_viewed_at=? WHERE token=?").run(Date.now(), token);
  }
}
