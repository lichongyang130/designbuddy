import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export type MemoryCategory = "constraint" | "decision" | "preference" | "lesson";

export interface MemoryRecord {
  id: string;
  ownerId: string;
  /** Empty string ("") denotes account-level global preference; otherwise scoped to a single project. */
  projectId: string;
  category: MemoryCategory;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface UpsertMemoryInput {
  projectId?: string;
  category?: MemoryCategory;
  title: string;
  content: string;
  tags?: string[];
  pinned?: boolean;
}

export interface UpdateMemoryInput {
  category?: MemoryCategory;
  title?: string;
  content?: string;
  tags?: string[];
  pinned?: boolean;
}

const VALID_CATEGORIES = new Set<MemoryCategory>(["constraint", "decision", "preference", "lesson"]);
const MAX_MEMORIES_PER_OWNER = 500;

function sanitizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const out: string[] = [];
  for (const item of tags) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim().slice(0, 32);
    if (trimmed && !out.includes(trimmed)) out.push(trimmed);
    if (out.length >= 10) break;
  }
  return out;
}

/**
 * Persistent SQLite Memory Engine strictly isolated by (ownerId, projectId).
 * Never shares memories across accounts or across unrelated projects.
 */
export class MemoryEngine {
  private readonly db: DatabaseSync;
  private readonly ownsDb: boolean;

  constructor(dbOrPath: DatabaseSync | string = process.env.DESIGNBUDDY_AGENT_DB || "./data/agent-core.sqlite") {
    if (typeof dbOrPath === "string") {
      if (dbOrPath !== ":memory:") mkdirSync(dirname(resolve(dbOrPath)), { recursive: true });
      this.db = new DatabaseSync(dbOrPath);
      this.ownsDb = true;
    } else {
      this.db = dbOrPath;
      this.ownsDb = false;
    }
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS agent_memories (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        project_id TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        tags_json TEXT NOT NULL DEFAULT '[]',
        pinned INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_agent_memories_owner_project
        ON agent_memories(owner_id, project_id, pinned DESC, updated_at DESC);
    `);
  }

  private mapRow(row: Record<string, unknown>): MemoryRecord {
    let tags: string[] = [];
    try {
      tags = sanitizeTags(JSON.parse(String(row.tags_json || "[]")));
    } catch {
      tags = [];
    }
    return {
      id: String(row.id),
      ownerId: String(row.owner_id),
      projectId: String(row.project_id || ""),
      category: VALID_CATEGORIES.has(row.category as MemoryCategory) ? (row.category as MemoryCategory) : "constraint",
      title: String(row.title),
      content: String(row.content),
      tags,
      pinned: Boolean(row.pinned),
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
    };
  }

  create(ownerId: string, input: UpsertMemoryInput): MemoryRecord {
    if (!ownerId.trim()) throw new Error("Owner identity is required.");
    const title = String(input.title || "").trim().slice(0, 120);
    const content = String(input.content || "").trim().slice(0, 4000);
    if (!title || !content) throw new Error("记忆标题与内容均不能为空。");
    const category: MemoryCategory = VALID_CATEGORIES.has(input.category as MemoryCategory)
      ? (input.category as MemoryCategory)
      : "constraint";
    const projectId = String(input.projectId || "").trim().slice(0, 120);
    const total = Number(
      (this.db.prepare("SELECT count(*) AS n FROM agent_memories WHERE owner_id=?").get(ownerId) as { n: number })?.n || 0,
    );
    if (total >= MAX_MEMORIES_PER_OWNER) {
      throw new Error(`单账号最多保存 ${MAX_MEMORIES_PER_OWNER} 条记忆，请清理旧条目后重试。`);
    }
    const now = Date.now();
    const id = randomUUID();
    const tags = sanitizeTags(input.tags);
    const pinned = input.pinned ? 1 : 0;
    this.db
      .prepare(
        `INSERT INTO agent_memories (id, owner_id, project_id, category, title, content, tags_json, pinned, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, ownerId, projectId, category, title, content, JSON.stringify(tags), pinned, now, now);
    return { id, ownerId, projectId, category, title, content, tags, pinned: Boolean(pinned), createdAt: now, updatedAt: now };
  }

  list(
    ownerId: string,
    filter: { projectId?: string; includeGlobal?: boolean; category?: MemoryCategory; query?: string } = {},
  ): MemoryRecord[] {
    const rows = (
      filter.projectId !== undefined
        ? filter.includeGlobal !== false && filter.projectId !== ""
          ? this.db
              .prepare(
                `SELECT * FROM agent_memories
                 WHERE owner_id=? AND (project_id=? OR project_id='')
                 ORDER BY pinned DESC, updated_at DESC`,
              )
              .all(ownerId, filter.projectId)
          : this.db
              .prepare(
                `SELECT * FROM agent_memories
                 WHERE owner_id=? AND project_id=?
                 ORDER BY pinned DESC, updated_at DESC`,
              )
              .all(ownerId, filter.projectId)
        : this.db
            .prepare(`SELECT * FROM agent_memories WHERE owner_id=? ORDER BY pinned DESC, updated_at DESC`)
            .all(ownerId)
    ) as Array<Record<string, unknown>>;

    let items = rows.map((r) => this.mapRow(r));
    if (filter.category && VALID_CATEGORIES.has(filter.category)) {
      items = items.filter((m) => m.category === filter.category);
    }
    if (filter.query && filter.query.trim()) {
      const needle = filter.query.trim().toLowerCase();
      items = items.filter(
        (m) =>
          m.title.toLowerCase().includes(needle) ||
          m.content.toLowerCase().includes(needle) ||
          m.tags.some((t) => t.toLowerCase().includes(needle)),
      );
    }
    return items;
  }

  get(ownerId: string, memoryId: string): MemoryRecord | null {
    const row = this.db
      .prepare("SELECT * FROM agent_memories WHERE id=? AND owner_id=?")
      .get(memoryId, ownerId) as Record<string, unknown> | undefined;
    return row ? this.mapRow(row) : null;
  }

  update(ownerId: string, memoryId: string, patch: UpdateMemoryInput): MemoryRecord | null {
    const existing = this.get(ownerId, memoryId);
    if (!existing) return null;
    const category = patch.category && VALID_CATEGORIES.has(patch.category) ? patch.category : existing.category;
    const title = patch.title !== undefined ? patch.title.trim().slice(0, 120) : existing.title;
    const content = patch.content !== undefined ? patch.content.trim().slice(0, 4000) : existing.content;
    if (!title || !content) throw new Error("记忆标题与内容均不能为空。");
    const tags = patch.tags !== undefined ? sanitizeTags(patch.tags) : existing.tags;
    const pinned = patch.pinned !== undefined ? Boolean(patch.pinned) : existing.pinned;
    const now = Date.now();
    this.db
      .prepare(
        `UPDATE agent_memories
         SET category=?, title=?, content=?, tags_json=?, pinned=?, updated_at=?
         WHERE id=? AND owner_id=?`,
      )
      .run(category, title, content, JSON.stringify(tags), pinned ? 1 : 0, now, memoryId, ownerId);
    return { ...existing, category, title, content, tags, pinned, updatedAt: now };
  }

  delete(ownerId: string, memoryId: string): boolean {
    const info = this.db
      .prepare("DELETE FROM agent_memories WHERE id=? AND owner_id=?")
      .run(memoryId, ownerId);
    return Number(info.changes) > 0;
  }

  /** Select concise relevant constraints/decisions for planning & execution prompts. */
  selectRelevantContext(ownerId: string, projectId: string, goal: string, limit = 8): MemoryRecord[] {
    const all = this.list(ownerId, { projectId, includeGlobal: true });
    const tokens = goal
      .toLowerCase()
      .split(/[\s,.;:!?，。；：、/|]+/)
      .filter((w) => w.length >= 2);
    const scored = all.map((m) => {
      let score = m.pinned ? 100 : 0;
      if (m.projectId === projectId && projectId !== "") score += 30;
      if (m.category === "constraint") score += 20;
      const hay = `${m.title} ${m.content} ${m.tags.join(" ")}`.toLowerCase();
      for (const tok of tokens) {
        if (hay.includes(tok)) score += 10;
      }
      return { m, score };
    });
    scored.sort((a, b) => b.score - a.score || b.m.updatedAt - a.m.updatedAt);
    return scored.slice(0, limit).map((s) => s.m);
  }

  close(): void {
    if (this.ownsDb) this.db.close();
  }
}
