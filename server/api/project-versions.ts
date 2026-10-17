import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Project source history.
 *
 * Every saved change of a project file is kept as its own version, so a lost
 * edit can be recovered instead of overwritten. The store also keeps the audit
 * trail: who changed what, and when.
 */
export type ProjectVersion = {
  id: string;
  projectId: string;
  ownerId: string;
  path: string;
  version: number;
  content: string;
  hash: string;
  author: string;
  label: string;
  createdAt: number;
};

export type ProjectAuditEntry = {
  id: string;
  projectId: string;
  actor: string;
  action: string;
  detail: string;
  createdAt: number;
};

export type VersionConflict = {
  path: string;
  baseVersion: string;
  headVersion: string;
  headContent: string;
  headAuthor: string;
  headAt: number;
  headLabel: string;
};

const MAX_VERSIONS_PER_FILE = 100;

export class ProjectVersionStore {
  private db: DatabaseSync;

  constructor(file = process.env.DESIGNBUDDY_VERSIONS_SQLITE_PATH || "./data/project-versions.sqlite") {
    const path = resolve(file);
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS project_versions(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,owner_id TEXT NOT NULL,path TEXT NOT NULL,version INTEGER NOT NULL,content TEXT NOT NULL,hash TEXT NOT NULL,author TEXT NOT NULL,label TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL);
      CREATE UNIQUE INDEX IF NOT EXISTS project_versions_head ON project_versions(project_id,path,version);
      CREATE INDEX IF NOT EXISTS project_versions_project ON project_versions(project_id,created_at);
      CREATE TABLE IF NOT EXISTS project_audit(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,actor TEXT NOT NULL,action TEXT NOT NULL,detail TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS project_audit_project ON project_audit(project_id,created_at);`);
  }

  close() {
    this.db.close();
  }

  /** Store a new version of one file and return it. */
  commit(input: { projectId: string; ownerId: string; path: string; content: string; author: string; label?: string }): ProjectVersion {
    const path = String(input.path || "").slice(0, 300);
    if (!path) throw new Error("A file path is required to store a version.");
    const row = this.db
      .prepare("SELECT MAX(version) AS top FROM project_versions WHERE project_id=? AND path=?")
      .get(input.projectId, path) as { top: number | null };
    const version = Number(row?.top ?? 0) + 1;
    const id = randomUUID();
    const createdAt = Date.now();
    const content = String(input.content ?? "");
    this.db
      .prepare("INSERT INTO project_versions(id,project_id,owner_id,path,version,content,hash,author,label,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)")
      .run(id, input.projectId, input.ownerId, path, version, content, hashContent(content), input.author, String(input.label || "").slice(0, 120), createdAt);
    // Keep the history bounded: the oldest versions of a file are dropped.
    this.db
      .prepare("DELETE FROM project_versions WHERE project_id=? AND path=? AND version<=?")
      .run(input.projectId, path, version - MAX_VERSIONS_PER_FILE);
    return {
      id,
      projectId: input.projectId,
      ownerId: input.ownerId,
      path,
      version,
      content,
      hash: hashContent(content),
      author: input.author,
      label: String(input.label || "").slice(0, 120),
      createdAt,
    };
  }

  /** The newest version of a file, or null when the file was never versioned. */
  head(projectId: string, path: string): ProjectVersion | null {
    const row = this.db
      .prepare("SELECT * FROM project_versions WHERE project_id=? AND path=? ORDER BY version DESC LIMIT 1")
      .get(projectId, path) as Record<string, unknown> | undefined;
    return row ? toVersion(row) : null;
  }

  /** Every version of a project, newest first. */
  list(projectId: string, path?: string, limit = 200): ProjectVersion[] {
    const rows = (path
      ? this.db.prepare("SELECT * FROM project_versions WHERE project_id=? AND path=? ORDER BY version DESC LIMIT ?").all(projectId, path, Math.max(1, Math.min(500, limit)))
      : this.db.prepare("SELECT * FROM project_versions WHERE project_id=? ORDER BY created_at DESC LIMIT ?").all(projectId, Math.max(1, Math.min(500, limit)))) as Record<string, unknown>[];
    return rows.map(toVersion);
  }

  /** The newest version id per file — what a client uses as its base version. */
  heads(projectId: string): Record<string, string> {
    const rows = this.db
      .prepare("SELECT path, MAX(version) AS top FROM project_versions WHERE project_id=? GROUP BY path")
      .all(projectId) as { path: string; top: number }[];
    const result: Record<string, string> = {};
    for (const row of rows) {
      const head = this.head(projectId, row.path);
      if (head) result[row.path] = head.id;
    }
    return result;
  }

  get(projectId: string, versionId: string): ProjectVersion | null {
    const row = this.db
      .prepare("SELECT * FROM project_versions WHERE project_id=? AND id=?")
      .get(projectId, versionId) as Record<string, unknown> | undefined;
    return row ? toVersion(row) : null;
  }

  /**
   * Compare the client's base versions with the stored heads.
   *
   * `baseVersions` maps a file path to the version the client started from.
   * An empty value means the client holds a copy that is not based on any
   * stored version, so saving it would silently drop somebody else's work.
   * `contents` is the content the client is about to save; a file that already
   * matches the head never conflicts, because nothing would be lost.
   */
  detectConflicts(
    projectId: string,
    baseVersions: Record<string, string>,
    contents?: Record<string, string>,
  ): VersionConflict[] {
    const conflicts: VersionConflict[] = [];
    for (const [path, baseVersion] of Object.entries(baseVersions)) {
      const head = this.head(projectId, path);
      if (!head) continue;
      if (contents && contents[path] === head.content) continue;
      const base = typeof baseVersion === "string" ? baseVersion : "";
      if (base && head.id === base) continue;
      conflicts.push({
        path,
        baseVersion: base,
        headVersion: head.id,
        headContent: head.content,
        headAuthor: head.author,
        headAt: head.createdAt,
        headLabel: head.label,
      });
    }
    return conflicts;
  }

  recordAudit(projectId: string, actor: string, action: string, detail = ""): void {
    this.db
      .prepare("INSERT INTO project_audit(id,project_id,actor,action,detail,created_at) VALUES(?,?,?,?,?,?)")
      .run(randomUUID(), projectId, actor, String(action).slice(0, 60), String(detail).slice(0, 600), Date.now());
  }

  listAudit(projectId: string, limit = 100): ProjectAuditEntry[] {
    const rows = this.db
      .prepare("SELECT * FROM project_audit WHERE project_id=? ORDER BY created_at DESC LIMIT ?")
      .all(projectId, Math.max(1, Math.min(500, limit))) as Record<string, unknown>[];
    return rows.map((row) => ({
      id: String(row.id),
      projectId: String(row.project_id),
      actor: String(row.actor),
      action: String(row.action),
      detail: String(row.detail || ""),
      createdAt: Number(row.created_at),
    }));
  }
}

function toVersion(row: Record<string, unknown>): ProjectVersion {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    ownerId: String(row.owner_id),
    path: String(row.path),
    version: Number(row.version),
    content: String(row.content),
    hash: String(row.hash),
    author: String(row.author),
    label: String(row.label || ""),
    createdAt: Number(row.created_at),
  };
}

export function hashContent(content: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < content.length; index += 1) {
    hash ^= content.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/** The files whose content differs between two file lists. */
export function changedFiles(
  before: { path: string; content: string }[],
  after: { path: string; content: string }[],
  /** Files that have no history yet are always recorded, so the first state is kept. */
  isNewFile?: (path: string) => boolean,
): { path: string; content: string }[] {
  const previous = new Map(before.map((file) => [file.path, file.content]));
  const changed: { path: string; content: string }[] = [];
  for (const file of after) {
    if (previous.get(file.path) !== file.content) changed.push({ path: file.path, content: file.content });
    else if (isNewFile?.(file.path)) changed.push({ path: file.path, content: file.content });
  }
  return changed;
}
