import { DatabaseSync } from "node:sqlite";
import { mkdirSync, rmSync, writeFileSync, existsSync, statSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomBytes, createHash } from "node:crypto";

/**
 * Server side asset library.
 *
 * Files that a person attaches to a conversation are stored on the server
 * instead of being pasted into the message. The server keeps the bytes, a
 * SHA-256 fingerprint, the size and - for text like files - the extracted
 * text, so a later request can ask the server for the content instead of
 * relying on the browser.
 *
 * Every asset belongs to exactly one account. Its visibility decides who may
 * see it: `private` (only the owner), `workspace` (members of a workspace the
 * owner belongs to) or `public` (every signed in account).
 */
export type AssetVisibility = "private" | "workspace" | "public";
export type AssetEventAction = "asset.upload" | "asset.visibility" | "asset.delete";

export type Asset = {
  id: string;
  ownerId: string;
  name: string;
  mime: string;
  size: number;
  sha256: string;
  createdAt: number;
  visibility: AssetVisibility;
  /** The extracted text for text like files, empty for binary files. */
  excerpt: string;
  /** True when the server really parsed the content into text. */
  extracted: boolean;
};

export type AssetEvent = {
  id: number;
  assetId: string;
  ownerId: string;
  action: AssetEventAction;
  createdAt: number;
};

export class AssetInputError extends Error {}
export class AssetLimitError extends Error {}

function numberFromEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

export const ASSET_MAX_FILE_BYTES = numberFromEnv("DESIGNBUDDY_ASSET_MAX_FILE_BYTES", 5_000_000);
export const ASSET_MAX_FILES = numberFromEnv("DESIGNBUDDY_ASSET_MAX_FILES", 50);
export const ASSET_MAX_TOTAL_BYTES = numberFromEnv("DESIGNBUDDY_ASSET_MAX_TOTAL_BYTES", 100_000_000);
export const ASSET_MAX_EXCERPT_BYTES = numberFromEnv("DESIGNBUDDY_ASSET_MAX_EXCERPT_BYTES", 200_000);

/** Mime types the server can turn into text without a third party service. */
const TEXT_MIME = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/tab-separated-values",
  "text/html",
  "text/css",
  "text/javascript",
  "application/json",
  "application/xml",
  "text/xml",
  "application/x-yaml",
  "text/yaml",
]);

function looksLikeText(mime: string, name: string): boolean {
  if (TEXT_MIME.has(mime)) return true;
  if (mime.startsWith("text/")) return true;
  return /\.(txt|md|markdown|csv|tsv|json|ya?ml|html?|css|js|mjs|ts|tsx|jsx|xml|log|ini|conf)$/i.test(name);
}

/**
 * Extract text from a file. Binary content is not decoded: the server reports
 * `extracted: false` instead of inventing a reading of the file.
 */
export function extractText(mime: string, name: string, bytes: Uint8Array): { text: string; extracted: boolean } {
  if (!looksLikeText(mime, name)) return { text: "", extracted: false };
  if (bytes.byteLength > ASSET_MAX_EXCERPT_BYTES * 4) return { text: "", extracted: false };
  for (const byte of bytes) {
    // A NUL byte means this is not plain text; do not pretend it is.
    if (byte === 0) return { text: "", extracted: false };
  }
  const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const text = decoded.slice(0, ASSET_MAX_EXCERPT_BYTES);
  return { text, extracted: true };
}

export class AssetStore {
  private db: DatabaseSync;
  private root: string;

  constructor(
    file = process.env.DESIGNBUDDY_ASSETS_SQLITE_PATH || "./data/assets.sqlite",
    root = process.env.DESIGNBUDDY_ASSET_ROOT || "./data/assets",
  ) {
    const path = resolve(file);
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS workspace_assets(
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        name TEXT NOT NULL,
        mime TEXT NOT NULL,
        size INTEGER NOT NULL,
        sha256 TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        visibility TEXT NOT NULL DEFAULT 'private',
        excerpt TEXT NOT NULL DEFAULT '',
        extracted INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS workspace_assets_owner ON workspace_assets(owner_id, created_at DESC);
      CREATE TABLE IF NOT EXISTS workspace_asset_events(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asset_id TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        action TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS workspace_asset_events_asset ON workspace_asset_events(asset_id, created_at);`);
    this.root = resolve(root);
    mkdirSync(this.root, { recursive: true });
  }

  close() {
    this.db.close();
  }

  private row(value: Record<string, unknown>): Asset {
    return {
      id: String(value.id),
      ownerId: String(value.owner_id),
      name: String(value.name),
      mime: String(value.mime),
      size: Number(value.size),
      sha256: String(value.sha256),
      createdAt: Number(value.created_at),
      visibility: (String(value.visibility) || "private") as AssetVisibility,
      excerpt: String(value.excerpt ?? ""),
      extracted: Number(value.extracted) === 1,
    };
  }

  private folder(ownerId: string): string {
    return resolve(this.root, createHash("sha256").update(ownerId).digest("hex").slice(0, 16));
  }

  private filePath(asset: Asset): string {
    return resolve(this.folder(asset.ownerId), `${asset.id}.bin`);
  }

  private record(assetId: string, ownerId: string, action: AssetEventAction) {
    this.db
      .prepare("INSERT INTO workspace_asset_events(asset_id,owner_id,action,created_at) VALUES(?,?,?,?)")
      .run(assetId, ownerId, action, Date.now());
  }

  /**
   * Store one file for one account. The bytes are written to disk, the
   * fingerprint and the size are recorded and text like files are parsed on
   * the server.
   */
  create(
    ownerId: string,
    input: { name: string; mime?: string; bytes: Uint8Array },
    visibility: AssetVisibility = "private",
  ): Asset {
    const name = input.name.trim().slice(0, 180);
    if (!name) throw new AssetInputError("素材名称不能为空。");
    if (input.bytes.byteLength === 0) throw new AssetInputError("不能上传空文件。");
    if (input.bytes.byteLength > ASSET_MAX_FILE_BYTES) {
      throw new AssetLimitError(`单个文件不能超过 ${Math.floor(ASSET_MAX_FILE_BYTES / 1_000_000)} MB。`);
    }
    const count = this.db.prepare("SELECT COUNT(*) AS total FROM workspace_assets WHERE owner_id=?").get(ownerId) as { total: number };
    if (Number(count.total) >= ASSET_MAX_FILES) {
      throw new AssetLimitError(`素材数量已达上限（${ASSET_MAX_FILES} 个），请先删除不再使用的素材。`);
    }
    const size = this.db.prepare("SELECT COALESCE(SUM(size),0) AS total FROM workspace_assets WHERE owner_id=?").get(ownerId) as { total: number };
    if (Number(size.total) + input.bytes.byteLength > ASSET_MAX_TOTAL_BYTES) {
      throw new AssetLimitError(`素材空间已达上限（${Math.floor(ASSET_MAX_TOTAL_BYTES / 1_000_000)} MB）。`);
    }
    const mime = (input.mime || "application/octet-stream").slice(0, 120);
    const id = randomBytes(12).toString("hex");
    const sha256 = createHash("sha256").update(input.bytes).digest("hex");
    const { text, extracted } = extractText(mime, name, input.bytes);
    const createdAt = Date.now();
    mkdirSync(this.folder(ownerId), { recursive: true });
    writeFileSync(this.filePath({ id, ownerId } as Asset), input.bytes);
    this.db
      .prepare("INSERT INTO workspace_assets(id,owner_id,name,mime,size,sha256,created_at,visibility,excerpt,extracted) VALUES(?,?,?,?,?,?,?,?,?,?)")
      .run(id, ownerId, name, mime, input.bytes.byteLength, sha256, createdAt, visibility, text, extracted ? 1 : 0);
    this.record(id, ownerId, "asset.upload");
    return this.get(id)!;
  }

  get(id: string): Asset | null {
    const row = this.db.prepare("SELECT * FROM workspace_assets WHERE id=?").get(id) as Record<string, unknown> | undefined;
    return row ? this.row(row) : null;
  }

  listByOwner(ownerId: string): Asset[] {
    const rows = this.db
      .prepare("SELECT * FROM workspace_assets WHERE owner_id=? ORDER BY created_at DESC")
      .all(ownerId) as Record<string, unknown>[];
    return rows.map((row) => this.row(row));
  }

  /**
   * The assets a person may see: their own, the ones shared inside a
   * workspace they belong to and the published ones.
   */
  listVisible(viewerId: string, workspaceOwnerIds: string[] = []): Asset[] {
    const shared = new Set(workspaceOwnerIds);
    const rows = this.db.prepare("SELECT * FROM workspace_assets ORDER BY created_at DESC").all() as Record<string, unknown>[];
    return rows
      .map((row) => this.row(row))
      .filter((asset) => {
        if (asset.ownerId === viewerId) return true;
        if (asset.visibility === "public") return true;
        if (asset.visibility === "workspace") return shared.has(asset.ownerId);
        return false;
      });
  }

  /** The raw bytes of an asset, used when a skill or the AI needs the file. */
  read(asset: Asset): Uint8Array | null {
    const path = this.filePath(asset);
    if (!existsSync(path)) return null;
    const size = statSync(path).size;
    const buffer = new Uint8Array(size);
    buffer.set(readFileSync(path), 0);
    return buffer;
  }

  /** Change who may see an asset. Only the owner may do this. */
  setVisibility(id: string, ownerId: string, visibility: AssetVisibility): Asset | null {
    const asset = this.get(id);
    if (!asset || asset.ownerId !== ownerId) return null;
    this.db.prepare("UPDATE workspace_assets SET visibility=? WHERE id=?").run(visibility, id);
    this.record(id, ownerId, "asset.visibility");
    return this.get(id);
  }

  /** Delete an asset and its bytes. Only the owner may do this. */
  remove(id: string, ownerId: string): boolean {
    const asset = this.get(id);
    if (!asset || asset.ownerId !== ownerId) return false;
    this.db.prepare("DELETE FROM workspace_assets WHERE id=?").run(id);
    rmSync(this.filePath(asset), { force: true });
    this.record(id, ownerId, "asset.delete");
    return true;
  }

  /**
   * The change history of one file. The trail survives the deletion of the
   * file itself and is only readable by the account that owns it.
   */
  events(id: string, ownerId: string): AssetEvent[] {
    const rows = this.db
      .prepare("SELECT * FROM workspace_asset_events WHERE asset_id=? AND owner_id=? ORDER BY created_at ASC")
      .all(id, ownerId) as Record<string, unknown>[];
    return rows.map((row) => ({
      id: Number(row.id),
      assetId: String(row.asset_id),
      ownerId: String(row.owner_id),
      action: String(row.action) as AssetEventAction,
      createdAt: Number(row.created_at),
    }));
  }
}
