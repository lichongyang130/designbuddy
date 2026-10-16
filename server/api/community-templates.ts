import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomBytes } from "node:crypto";

/**
 * Community templates.
 *
 * A person edits a template in the browser and can publish the current state
 * to the server. The published entry has an owner, a visibility and a change
 * trail, so "publish" and "unpublish" are real server side state changes and
 * not a flag in the browser.
 *
 * Visibility decides who may see the published template:
 * `private` (only the owner), `workspace` (members of a workspace the owner
 * belongs to) or `public` (every signed in account).
 */
export type CommunityVisibility = "private" | "workspace" | "public";
export type CommunityEventAction = "community.publish" | "community.visibility" | "community.unpublish";

export type CommunityTemplate = {
  id: string;
  ownerId: string;
  /** The template family, for example "travel" or "luma". */
  sample: string;
  title: string;
  description: string;
  visibility: CommunityVisibility;
  /** The version of the published state; it grows with every publish. */
  revision: number;
  createdAt: number;
  updatedAt: number;
  publishedAt: number;
  unpublishedAt: number | null;
};

export type CommunityEvent = {
  id: number;
  templateId: string;
  ownerId: string;
  action: CommunityEventAction;
  createdAt: number;
};

export class CommunityInputError extends Error {}
export class CommunityLimitError extends Error {}

export const COMMUNITY_MAX_STATE_BYTES = 200_000;
export const COMMUNITY_MAX_TITLE = 80;

const SAMPLE_PATTERN = /^[a-z0-9-]{1,40}$/;

export class CommunityTemplateStore {
  private db: DatabaseSync;

  constructor(file = process.env.DESIGNBUDDY_COMMUNITY_SQLITE_PATH || "./data/community.sqlite") {
    const path = resolve(file);
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS community_templates(
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        sample TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        visibility TEXT NOT NULL DEFAULT 'private',
        revision INTEGER NOT NULL DEFAULT 1,
        state_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        published_at INTEGER NOT NULL,
        unpublished_at INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS community_templates_owner ON community_templates(owner_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS community_templates_sample ON community_templates(sample, published_at DESC);
      CREATE TABLE IF NOT EXISTS community_template_events(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_id TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        action TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS community_template_events_template ON community_template_events(template_id, created_at);`);
  }

  close() {
    this.db.close();
  }

  private row(value: Record<string, unknown>): CommunityTemplate {
    return {
      id: String(value.id),
      ownerId: String(value.owner_id),
      sample: String(value.sample),
      title: String(value.title),
      description: String(value.description ?? ""),
      visibility: (String(value.visibility) || "private") as CommunityVisibility,
      revision: Number(value.revision) || 1,
      createdAt: Number(value.created_at),
      updatedAt: Number(value.updated_at),
      publishedAt: Number(value.published_at),
      unpublishedAt: Number(value.unpublished_at) || null,
    };
  }

  private record(templateId: string, ownerId: string, action: CommunityEventAction) {
    this.db
      .prepare("INSERT INTO community_template_events(template_id,owner_id,action,created_at) VALUES(?,?,?,?)")
      .run(templateId, ownerId, action, Date.now());
  }

  /**
   * Publish the current state of a template. Publishing the same template
   * family again updates the existing entry and grows its revision, so the
   * community always sees the newest published state.
   */
  publish(
    ownerId: string,
    input: { sample: string; title: string; description?: string; visibility?: CommunityVisibility; state: unknown },
  ): CommunityTemplate {
    const sample = input.sample.trim();
    if (!SAMPLE_PATTERN.test(sample)) throw new CommunityInputError("模板标识不合法。");
    const title = input.title.trim().slice(0, COMMUNITY_MAX_TITLE);
    if (!title) throw new CommunityInputError("请给发布的模板写一个标题。");
    const description = (input.description ?? "").trim().slice(0, 400);
    const visibility = input.visibility ?? "private";
    const stateJson = JSON.stringify(input.state ?? null);
    if (stateJson.length > COMMUNITY_MAX_STATE_BYTES) {
      throw new CommunityLimitError(`模板内容超过 ${Math.floor(COMMUNITY_MAX_STATE_BYTES / 1000)} KB，请先精简再发布。`);
    }
    const now = Date.now();
    const existing = this.db
      .prepare("SELECT * FROM community_templates WHERE owner_id=? AND sample=?")
      .get(ownerId, sample) as Record<string, unknown> | undefined;
    if (existing) {
      const revision = (Number(existing.revision) || 1) + 1;
      this.db
        .prepare("UPDATE community_templates SET title=?,description=?,visibility=?,revision=?,state_json=?,updated_at=?,published_at=?,unpublished_at=0 WHERE id=?")
        .run(title, description, visibility, revision, stateJson, now, now, String(existing.id));
      this.record(String(existing.id), ownerId, "community.publish");
      return this.get(String(existing.id))!;
    }
    const id = randomBytes(10).toString("hex");
    this.db
      .prepare("INSERT INTO community_templates(id,owner_id,sample,title,description,visibility,revision,state_json,created_at,updated_at,published_at,unpublished_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,0)")
      .run(id, ownerId, sample, title, description, visibility, 1, stateJson, now, now, now);
    this.record(id, ownerId, "community.publish");
    return this.get(id)!;
  }

  get(id: string): CommunityTemplate | null {
    const row = this.db.prepare("SELECT * FROM community_templates WHERE id=?").get(id) as Record<string, unknown> | undefined;
    return row ? this.row(row) : null;
  }

  /** The published state of a template. */
  state(id: string): string | null {
    const row = this.db.prepare("SELECT state_json FROM community_templates WHERE id=?").get(id) as { state_json?: string } | undefined;
    return row?.state_json ?? null;
  }

  /**
   * The templates a person may see: their own, the ones shared inside a
   * workspace they belong to and the published ones.
   */
  list(viewerId: string, workspaceOwnerIds: string[] = []): CommunityTemplate[] {
    const peers = new Set(workspaceOwnerIds);
    const rows = this.db.prepare("SELECT * FROM community_templates ORDER BY published_at DESC").all() as Record<string, unknown>[];
    return rows
      .map((row) => this.row(row))
      .filter((template) => {
        if (template.ownerId === viewerId) return true;
        if (template.visibility === "public") return true;
        if (template.visibility === "workspace") return peers.has(template.ownerId);
        return false;
      });
  }

  /** Change who may see a published template. Only the owner may do this. */
  setVisibility(id: string, ownerId: string, visibility: CommunityVisibility): CommunityTemplate | null {
    const template = this.get(id);
    if (!template || template.ownerId !== ownerId) return null;
    this.db.prepare("UPDATE community_templates SET visibility=?, updated_at=? WHERE id=?").run(visibility, Date.now(), id);
    this.record(id, ownerId, "community.visibility");
    return this.get(id);
  }

  /** Take a published template off the community list. Only the owner may do this. */
  unpublish(id: string, ownerId: string): boolean {
    const template = this.get(id);
    if (!template || template.ownerId !== ownerId) return false;
    this.db.prepare("UPDATE community_templates SET visibility='private', unpublished_at=?, updated_at=? WHERE id=?").run(Date.now(), Date.now(), id);
    this.record(id, ownerId, "community.unpublish");
    return true;
  }

  /** The change history of one published template. */
  events(id: string, ownerId: string): CommunityEvent[] {
    const rows = this.db
      .prepare("SELECT * FROM community_template_events WHERE template_id=? AND owner_id=? ORDER BY created_at ASC")
      .all(id, ownerId) as Record<string, unknown>[];
    return rows.map((row) => ({
      id: Number(row.id),
      templateId: String(row.template_id),
      ownerId: String(row.owner_id),
      action: String(row.action) as CommunityEventAction,
      createdAt: Number(row.created_at),
    }));
  }
}
