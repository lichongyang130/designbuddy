import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Account data that belongs to the person, not to the browser:
 * preferences that follow the account across devices, memories the person
 * explicitly allowed the assistant to keep, the devices that have used the
 * account, and the export / forget operations.
 *
 * Nothing here is written without the account's own request, and every write
 * is scoped to one owner id.
 */
export type ProfilePreference = { key: string; value: unknown; updatedAt: number };
export type ProfileMemory = {
  id: string;
  ownerId: string;
  kind: "note" | "preference" | "correction";
  content: string;
  source: string;
  consent: boolean;
  createdAt: number;
};
export type ProfileDevice = {
  id: string;
  ownerId: string;
  label: string;
  userAgent: string;
  firstSeen: number;
  lastSeen: number;
};

const MAX_PREFERENCE_BYTES = 64 * 1024;
const MAX_MEMORY_CHARS = 2000;
const MAX_MEMORIES = 500;

export class ProfileStore {
  private db: DatabaseSync;

  constructor(file = process.env.DESIGNBUDDY_PROFILE_SQLITE_PATH || "./data/profile.sqlite") {
    const path = resolve(file);
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS profile_preferences(owner_id TEXT NOT NULL,key TEXT NOT NULL,value TEXT NOT NULL,updated_at INTEGER NOT NULL,PRIMARY KEY(owner_id,key));
      CREATE TABLE IF NOT EXISTS profile_memories(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,kind TEXT NOT NULL,content TEXT NOT NULL,source TEXT NOT NULL DEFAULT '',consent INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS profile_memories_owner ON profile_memories(owner_id,created_at);
      CREATE TABLE IF NOT EXISTS profile_devices(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,label TEXT NOT NULL,user_agent TEXT NOT NULL DEFAULT '',first_seen INTEGER NOT NULL,last_seen INTEGER NOT NULL);`);
  }

  close() {
    this.db.close();
  }

  /** Every preference of one account, newest value wins. */
  listPreferences(ownerId: string): ProfilePreference[] {
    const rows = this.db
      .prepare("SELECT key,value,updated_at FROM profile_preferences WHERE owner_id=? ORDER BY updated_at DESC")
      .all(ownerId) as Record<string, unknown>[];
    const seen = new Set<string>();
    const result: ProfilePreference[] = [];
    for (const row of rows) {
      const key = String(row.key);
      if (seen.has(key)) continue;
      seen.add(key);
      let value: unknown = null;
      try {
        value = JSON.parse(String(row.value));
      } catch {
        value = String(row.value);
      }
      result.push({ key, value, updatedAt: Number(row.updated_at) });
    }
    return result;
  }

  savePreference(ownerId: string, key: string, value: unknown): ProfilePreference {
    const cleanKey = String(key || "").trim().slice(0, 80);
    if (!cleanKey) throw new Error("偏好键不能为空。");
    const serialized = JSON.stringify(value ?? null);
    if (Buffer.byteLength(serialized, "utf8") > MAX_PREFERENCE_BYTES) throw new Error("单条偏好过大。");
    const updatedAt = Date.now();
    this.db
      .prepare("INSERT OR REPLACE INTO profile_preferences(owner_id,key,value,updated_at) VALUES(?,?,?,?)")
      .run(ownerId, cleanKey, serialized, updatedAt);
    return { key: cleanKey, value: value ?? null, updatedAt };
  }

  listMemories(ownerId: string): ProfileMemory[] {
    const rows = this.db
      .prepare("SELECT * FROM profile_memories WHERE owner_id=? ORDER BY created_at DESC LIMIT ?")
      .all(ownerId, MAX_MEMORIES) as Record<string, unknown>[];
    return rows.map((row) => ({
      id: String(row.id),
      ownerId: String(row.owner_id),
      kind: String(row.kind) as ProfileMemory["kind"],
      content: String(row.content),
      source: String(row.source || ""),
      consent: Number(row.consent) === 1,
      createdAt: Number(row.created_at),
    }));
  }

  /** A memory is only stored when the account explicitly allowed it. */
  addMemory(ownerId: string, input: { kind?: string; content: string; source?: string; consent: boolean }): ProfileMemory {
    if (input.consent !== true) throw new Error("写入长期记忆需要本人明确同意。");
    const content = String(input.content || "").trim();
    if (!content) throw new Error("记忆内容不能为空。");
    if (content.length > MAX_MEMORY_CHARS) throw new Error(`记忆内容超过 ${MAX_MEMORY_CHARS} 字。`);
    const kind = (["note", "preference", "correction"] as const).includes(input.kind as never) ? String(input.kind) : "note";
    const count = Number((this.db.prepare("SELECT COUNT(*) AS total FROM profile_memories WHERE owner_id=?").get(ownerId) as { total: number }).total);
    if (count >= MAX_MEMORIES) throw new Error(`长期记忆最多 ${MAX_MEMORIES} 条，请先清理。`);
    const id = randomUUID();
    const createdAt = Date.now();
    this.db
      .prepare("INSERT INTO profile_memories(id,owner_id,kind,content,source,consent,created_at) VALUES(?,?,?,?,?,?,?)")
      .run(id, ownerId, kind, content, String(input.source || "").slice(0, 120), 1, createdAt);
    return { id, ownerId, kind: kind as ProfileMemory["kind"], content, source: String(input.source || "").slice(0, 120), consent: true, createdAt };
  }

  deleteMemory(ownerId: string, id: string): boolean {
    const info = this.db.prepare("DELETE FROM profile_memories WHERE id=? AND owner_id=?").run(id, ownerId);
    return Number(info.changes) > 0;
  }

  clearMemories(ownerId: string): number {
    const info = this.db.prepare("DELETE FROM profile_memories WHERE owner_id=?").run(ownerId);
    return Number(info.changes);
  }

  /** Record that a device used the account; the id is derived from the real request. */
  touchDevice(ownerId: string, userAgent: string): ProfileDevice {
    const agent = String(userAgent || "").slice(0, 300);
    const id = deviceId(agent);
    const now = Date.now();
    const existing = this.db.prepare("SELECT * FROM profile_devices WHERE id=?").get(id) as Record<string, unknown> | undefined;
    if (!existing) {
      this.db
        .prepare("INSERT OR IGNORE INTO profile_devices(id,owner_id,label,user_agent,first_seen,last_seen) VALUES(?,?,?,?,?,?)")
        .run(id, ownerId, describeDevice(agent), agent, now, now);
    } else {
      this.db.prepare("UPDATE profile_devices SET last_seen=?,owner_id=? WHERE id=?").run(now, ownerId, id);
    }
    const row = this.db.prepare("SELECT * FROM profile_devices WHERE id=?").get(id) as Record<string, unknown>;
    return {
      id: String(row.id),
      ownerId: String(row.owner_id),
      label: String(row.label),
      userAgent: String(row.user_agent),
      firstSeen: Number(row.first_seen),
      lastSeen: Number(row.last_seen),
    };
  }

  listDevices(ownerId: string): ProfileDevice[] {
    const rows = this.db
      .prepare("SELECT * FROM profile_devices WHERE owner_id=? ORDER BY last_seen DESC")
      .all(ownerId) as Record<string, unknown>[];
    return rows.map((row) => ({
      id: String(row.id),
      ownerId: String(row.owner_id),
      label: String(row.label),
      userAgent: String(row.user_agent),
      firstSeen: Number(row.first_seen),
      lastSeen: Number(row.last_seen),
    }));
  }

  /** Everything this store holds for one account, in one document. */
  exportOwner(ownerId: string): { exportedAt: number; ownerId: string; preferences: ProfilePreference[]; memories: ProfileMemory[]; devices: ProfileDevice[] } {
    return {
      exportedAt: Date.now(),
      ownerId,
      preferences: this.listPreferences(ownerId),
      memories: this.listMemories(ownerId),
      devices: this.listDevices(ownerId),
    };
  }

  /** Forget: drop the stored memories and the synced preferences of one account. */
  forgetOwner(ownerId: string): { memories: number; preferences: number } {
    const memories = this.clearMemories(ownerId);
    const preferences = Number(
      (this.db.prepare("DELETE FROM profile_preferences WHERE owner_id=?").run(ownerId)).changes,
    );
    return { memories, preferences };
  }
}

function deviceId(userAgent: string): string {
  let hash = 0;
  for (let index = 0; index < userAgent.length; index += 1) {
    hash = (hash * 31 + userAgent.charCodeAt(index)) >>> 0;
  }
  return `device-${hash.toString(16).padStart(8, "0")}`;
}

function describeDevice(userAgent: string): string {
  if (!userAgent) return "未知设备";
  const browser = /Firefox\/[\d.]+/.test(userAgent)
    ? "Firefox"
    : /Edg\/[\d.]+/.test(userAgent)
      ? "Edge"
      : /Chrome\/[\d.]+/.test(userAgent)
        ? "Chrome"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : "浏览器";
  const platform = /Windows/.test(userAgent)
    ? "Windows"
    : /Android/.test(userAgent)
      ? "Android"
      : /iPhone|iPad/.test(userAgent)
        ? "iOS"
        : /Mac OS X/.test(userAgent)
          ? "macOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "未知系统";
  return `${browser} · ${platform}`;
}
