import { readFileSync, statSync, existsSync, appendFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, extname, isAbsolute, sep } from 'node:path';
import { parse as parseCsv } from 'csv-parse/sync';
import { createHash } from 'node:crypto';

export type ConnectorType = 'csv' | 'json' | 'sqlite' | 'http-json';
export type FieldType = 'string' | 'number' | 'boolean';
export type FieldMapping = { source: string; target: string; type: FieldType };
export type ConnectorConfig = {
  id: string;
  type: ConnectorType;
  path?: string;
  table?: string;
  url?: string;
  itemsPath?: string;
  cursorField?: string;
  fields?: FieldMapping[];
  limit?: number;
};
export type ConnectorState = { cursor: string; updatedAt: string; rowsSeen: number };
export type PullResult = { rows: Record<string, unknown>[]; origin: string; nextCursor: string; bytesRead: number; truncated: boolean };
export type MappedRow = Record<string, unknown> & { __source: { connector: string; type: ConnectorType; origin: string; rowIndex: number; cursor: string }; __fetchedAt: string };

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_ROWS = 50000;
const MAX_HTTP_BYTES = 10 * 1024 * 1024;
const HTTP_ATTEMPTS = 3;
const HTTP_TIMEOUT_MS = 15000;

const connectorTypes: ConnectorType[] = ['csv', 'json', 'sqlite', 'http-json'];
const fieldTypes: FieldType[] = ['string', 'number', 'boolean'];

/** Local file access is restricted to explicit roots; the default root is the repository's data directory. */
export function connectorRoots(): string[] {
  const configured = (process.env.SKILL_CONNECTOR_ROOTS || '').split(',').map(value => value.trim()).filter(Boolean);
  if (configured.length) return configured.map(value => resolve(value));
  return [resolve('data')];
}

export function assertInsideRoots(target: string): string {
  if (!target || target.length > 512) throw Error('数据源路径为空或过长。');
  const roots = connectorRoots();
  // Relative paths are resolved against the first allowed root, never the process working directory.
  const absolute = isAbsolute(target) ? resolve(target) : resolve(roots[0], target);
  const inside = roots.some(root => absolute === root || absolute.startsWith(root + sep));
  if (!inside) throw Error(`数据源路径不在允许目录内：${absolute}。允许目录：${roots.join('、')}（可用 SKILL_CONNECTOR_ROOTS 配置）。`);
  return absolute;
}

export function validateConnectorConfig(input: unknown): ConnectorConfig {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('连接器配置必须是对象。');
  const raw = input as Record<string, unknown>;
  const allowed = new Set(['id', 'type', 'path', 'table', 'url', 'itemsPath', 'cursorField', 'fields', 'limit']);
  if (Object.keys(raw).some(key => !allowed.has(key))) throw Error('连接器配置包含未知字段。');
  const id = raw.id;
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(id)) throw Error('连接器 id 只能包含字母、数字、下划线和连字符（1至64位）。');
  const type = raw.type;
  if (typeof type !== 'string' || !connectorTypes.includes(type as ConnectorType)) throw Error(`连接器类型只支持：${connectorTypes.join('、')}。`);
  const config: ConnectorConfig = { id, type: type as ConnectorType };
  if (raw.itemsPath !== undefined) {
    if (typeof raw.itemsPath !== 'string' || !/^[A-Za-z0-9_.\[\]-]{1,120}$/.test(raw.itemsPath)) throw Error('itemsPath 只能包含字母、数字、点、下划线或短横线。');
    config.itemsPath = raw.itemsPath;
  }
  if (config.type === 'http-json') {
    if (typeof raw.url !== 'string' || !/^https?:\/\//i.test(raw.url)) throw Error('http-json 连接器必须提供 http(s) 链接。');
    if (raw.url.length > 2000) throw Error('链接长度超过2000字符。');
    config.url = raw.url;
  } else {
    if (typeof raw.path !== 'string' || !raw.path) throw Error(`${config.type} 连接器必须提供 path。`);
    config.path = raw.path;
    if (config.type === 'sqlite') {
      if (typeof raw.table !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(raw.table)) throw Error('sqlite 连接器必须提供合法的表名（字母、数字、下划线）。');
      config.table = raw.table;
    } else if (raw.table !== undefined) throw Error(`${config.type} 连接器不接受 table。`);
    // The allow-list check runs before anything else so a path outside the permitted roots never reaches the disk.
    assertInsideRoots(config.path);
    const extension = extname(config.path).toLowerCase();
    const expected: string[] = config.type === 'csv' ? ['.csv'] : config.type === 'json' ? ['.json'] : ['.sqlite', '.sqlite3', '.db'];
    if (!expected.includes(extension)) throw Error(`${config.type} 连接器的文件扩展名必须是 ${expected.join(' 或 ')}。`);
  }
  if (raw.cursorField !== undefined) {
    if (typeof raw.cursorField !== 'string' || !/^[A-Za-z0-9_]{1,64}$/.test(raw.cursorField)) throw Error('cursorField 只能包含字母、数字和下划线。');
    config.cursorField = raw.cursorField;
  }
  if (raw.fields !== undefined) {
    if (!Array.isArray(raw.fields) || !raw.fields.length || raw.fields.length > 100) throw Error('fields 必须是1至100条字段映射。');
    config.fields = raw.fields.map(entry => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw Error('字段映射必须是对象。');
      const item = entry as Record<string, unknown>;
      if (Object.keys(item).some(key => !['source', 'target', 'type'].includes(key))) throw Error('字段映射只支持 source、target、type。');
      if (typeof item.source !== 'string' || !item.source.length || item.source.length > 100) throw Error('字段映射缺少 source。');
      if (typeof item.target !== 'string' || !item.target.length || item.target.length > 100) throw Error('字段映射缺少 target。');
      if (typeof item.type !== 'string' || !fieldTypes.includes(item.type as FieldType)) throw Error(`字段类型只支持：${fieldTypes.join('、')}。`);
      return { source: item.source, target: item.target, type: item.type as FieldType };
    });
    const targets = config.fields.map(field => field.target);
    if (new Set(targets).size !== targets.length) throw Error('字段映射的 target 不能重复。');
  }
  if (raw.limit !== undefined) {
    if (typeof raw.limit !== 'number' || !Number.isInteger(raw.limit) || raw.limit < 1 || raw.limit > MAX_ROWS) throw Error(`limit 必须是1至${MAX_ROWS}的整数。`);
    config.limit = raw.limit;
  }
  return config;
}

function readLocalFile(path: string): string {
  const absolute = assertInsideRoots(path);
  if (!existsSync(absolute)) throw Error(`数据源文件不存在：${absolute}`);
  const stats = statSync(absolute);
  if (!stats.isFile()) throw Error(`数据源不是普通文件：${absolute}`);
  if (stats.size > MAX_FILE_BYTES) throw Error(`数据源文件超过${MAX_FILE_BYTES}字节上限。`);
  return readFileSync(absolute, 'utf8');
}

function rowsFromCsv(content: string): Record<string, unknown>[] {
  const rows = parseCsv(content, { bom: true, skip_empty_lines: true, max_record_size: 100000, to: MAX_ROWS + 2 });
  if (rows.length < 2) throw Error('CSV 没有表头或没有数据行。');
  const headers = rows[0].map(value => String(value).trim());
  if (headers.some(header => !header) || new Set(headers).size !== headers.length) throw Error('CSV 表头必须非空且唯一。');
  return rows.slice(1).map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] === undefined ? '' : row[index]])));
}

function rowsFromJson(content: string, itemsPath?: string): Record<string, unknown>[] {
  let parsed: unknown;
  try { parsed = JSON.parse(content); } catch { throw Error('JSON 数据源无法解析。'); }
  if (itemsPath) {
    let current: unknown = parsed;
    for (const segment of itemsPath.split('.')) {
      if (!current || typeof current !== 'object') throw Error(`itemsPath 路径不存在：${itemsPath}。`);
      current = (current as Record<string, unknown>)[segment];
    }
    parsed = current;
  } else if (!Array.isArray(parsed) && parsed && typeof parsed === 'object') {
    const arrays = Object.entries(parsed as Record<string, unknown>).filter(([, value]) => Array.isArray(value));
    if (arrays.length !== 1) throw Error('JSON 数据源必须是对象数组，或包含且仅包含一个数组字段；请用 itemsPath 指定。');
    parsed = arrays[0][1];
  }
  if (!Array.isArray(parsed)) throw Error('JSON 数据源不是数组。');
  if (parsed.length > MAX_ROWS) throw Error(`数据源超过${MAX_ROWS}行上限。`);
  return parsed.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw Error(`第${index + 1}行不是对象。`);
    return row as Record<string, unknown>;
  });
}

/** Allowed remote sources are explicit origins ("scheme://host[:port]"); plaintext http has to be listed on purpose. */
function allowedHttpOrigins(): string[] {
  return (process.env.SKILL_CONNECTOR_ALLOWED_HOSTS || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
}

function httpToken(origin: string): string {
  const raw = process.env.SKILL_CONNECTOR_TOKENS || '';
  if (!raw) return '';
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw Error('SKILL_CONNECTOR_TOKENS 必须是 JSON 对象（来源 → 令牌）。'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error('SKILL_CONNECTOR_TOKENS 必须是 JSON 对象（来源 → 令牌）。');
  const token = (parsed as Record<string, unknown>)[origin];
  return typeof token === 'string' ? token : '';
}

async function pullHttp(config: ConnectorConfig): Promise<PullResult> {
  const url = new URL(config.url!);
  const origin = url.origin.toLowerCase();
  const allowed = allowedHttpOrigins();
  if (!allowed.includes(origin)) throw Error(`来源 ${origin} 不在服务端允许列表内（SKILL_CONNECTOR_ALLOWED_HOSTS）。请由管理员配置后重试。`);
  const headers: Record<string, string> = { accept: 'application/json' };
  const token = httpToken(origin);
  if (token) headers.authorization = `Bearer ${token}`;
  let lastError = '';
  for (let attempt = 1; attempt <= HTTP_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
    try {
      const response = await fetch(url, { headers, signal: controller.signal, redirect: 'error' });
      if (!response.ok) throw Error(`HTTP ${response.status}`);
      const contentLength = Number(response.headers.get('content-length') || '0');
      if (contentLength && contentLength > MAX_HTTP_BYTES) throw Error('响应体超过大小上限。');
      const body = await response.text();
      if (body.length > MAX_HTTP_BYTES) throw Error('响应体超过大小上限。');
      const rows = rowsFromJson(body, config.itemsPath);
      return { rows, origin: `${url.origin}${url.pathname}`, nextCursor: '', bytesRead: body.length, truncated: false };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt < HTTP_ATTEMPTS) await new Promise(done => setTimeout(done, attempt * 300));
    } finally { clearTimeout(timer); }
  }
  throw Error(`远程数据源请求失败（重试${HTTP_ATTEMPTS}次）：${lastError}`);
}

function pullSqlite(config: ConnectorConfig): PullResult {
  const absolute = assertInsideRoots(config.path!);
  if (!existsSync(absolute)) throw Error(`数据源文件不存在：${absolute}`);
  const stats = statSync(absolute);
  if (!stats.isFile() || stats.size > MAX_FILE_BYTES) throw Error('数据库文件不可读或超过大小上限。');
  // Loaded through node:sqlite in read-only mode: no user SQL, no writes, no schema changes.
  const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');
  const database = new DatabaseSync(absolute, { readOnly: true });
  try {
    const limit = Math.min(config.limit ?? MAX_ROWS, MAX_ROWS);
    const statement = database.prepare(`SELECT * FROM "${config.table}" LIMIT ?`);
    const rows = statement.all(limit + 1) as Record<string, unknown>[];
    const truncated = rows.length > limit;
    const kept = truncated ? rows.slice(0, limit) : rows;
    return { rows: kept, origin: `${absolute}#${config.table}`, nextCursor: '', bytesRead: stats.size, truncated };
  } finally { database.close(); }
}

export async function pullConnector(config: ConnectorConfig): Promise<PullResult> {
  if (config.type === 'http-json') return pullHttp(config);
  if (config.type === 'sqlite') return pullSqlite(config);
  const content = readLocalFile(config.path!);
  const rows = config.type === 'csv' ? rowsFromCsv(content) : rowsFromJson(content, config.itemsPath);
  const limit = Math.min(config.limit ?? MAX_ROWS, MAX_ROWS);
  const truncated = rows.length > limit;
  return { rows: truncated ? rows.slice(0, limit) : rows, origin: assertInsideRoots(config.path!), nextCursor: '', bytesRead: Buffer.byteLength(content), truncated };
}

export function coerceValue(value: unknown, type: FieldType, label: string): unknown {
  if (value === null || value === undefined) throw Error(`${label} 缺少值，无法按 ${type} 转换。`);
  if (type === 'string') {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    throw Error(`${label} 不是可转换为文本的值。`);
  }
  if (type === 'number') {
    if (typeof value === 'number') { if (!Number.isFinite(value)) throw Error(`${label} 不是有限数值。`); return value; }
    if (typeof value === 'string' && /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim())) { const parsed = Number(value.trim()); if (!Number.isFinite(parsed)) throw Error(`${label} 不是有限数值。`); return parsed; }
    throw Error(`${label} 无法转换为数值。`);
  }
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') { if (value === 1) return true; if (value === 0) return false; throw Error(`${label} 无法转换为布尔值。`); }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', '是'].includes(normalized)) return true;
    if (['false', '0', 'no', '否'].includes(normalized)) return false;
  }
  throw Error(`${label} 无法转换为布尔值。`);
}

/** Incremental comparison: numeric cursors compare numerically, everything else compares as text. */
export function compareCursor(left: unknown, right: string): number {
  if (left === null || left === undefined) throw Error('游标字段存在空值，无法确定增量位置。');
  if (typeof left === 'number') { const current = Number(right); if (!Number.isFinite(current)) return Number(left) > 0 ? 1 : 0; return left === current ? 0 : (left > current ? 1 : -1); }
  const text = String(left);
  return text === right ? 0 : (text > right ? 1 : -1);
}

export function applyIncrementalFilter(rows: Record<string, unknown>[], cursorField: string | undefined, cursor: string): { kept: Record<string, unknown>[]; nextCursor: string; filtered: number } {
  if (!cursorField) return { kept: rows, nextCursor: cursor, filtered: 0 };
  if (cursor) {
    const kept = rows.filter(row => {
      const value = row[cursorField];
      if (value === null || value === undefined) throw Error(`游标字段 ${cursorField} 存在空值，无法确定增量位置。`);
      return compareCursor(value, cursor) > 0;
    });
    let nextCursor = cursor;
    for (const row of kept) {
      const value = row[cursorField];
      if (value === null || value === undefined) throw Error(`游标字段 ${cursorField} 存在空值，无法确定增量位置。`);
      if (compareCursor(value, nextCursor) > 0) nextCursor = String(value);
    }
    return { kept, nextCursor, filtered: rows.length - kept.length };
  }
  let nextCursor = '';
  for (const row of rows) {
    const value = row[cursorField];
    if (value === null || value === undefined) throw Error(`游标字段 ${cursorField} 存在空值，无法确定增量位置。`);
    if (!nextCursor || compareCursor(value, nextCursor) > 0) nextCursor = String(value);
  }
  return { kept: rows, nextCursor, filtered: 0 };
}

export function mapRows(rows: Record<string, unknown>[], config: ConnectorConfig, origin: string, cursor: string): { mapped: MappedRow[]; fields: string[] } {
  const fetchedAt = new Date().toISOString();
  const mapped = rows.map((row, index) => {
    const output: Record<string, unknown> = {};
    if (config.fields) {
      for (const field of config.fields) {
        if (!(field.source in row)) throw Error(`第${index + 1}行缺少来源字段 ${field.source}。`);
        output[field.target] = coerceValue(row[field.source], field.type, `第${index + 1}行字段 ${field.source}`);
      }
    } else {
      for (const [key, value] of Object.entries(row)) output[key] = value;
    }
    output.__source = { connector: config.id, type: config.type, origin, rowIndex: index + 1, cursor };
    output.__fetchedAt = fetchedAt;
    return output as MappedRow;
  });
  return { mapped, fields: config.fields ? config.fields.map(field => field.target) : [] };
}

export function readState(path: string): Record<string, ConnectorState> {
  const absolute = assertInsideRoots(path);
  if (!existsSync(absolute)) return {};
  try {
    const parsed = JSON.parse(readFileSync(absolute, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const state: Record<string, ConnectorState> = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue;
      const item = value as Record<string, unknown>;
      state[id] = { cursor: typeof item.cursor === 'string' ? item.cursor : '', updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : '', rowsSeen: typeof item.rowsSeen === 'number' ? item.rowsSeen : 0 };
    }
    return state;
  } catch { return {}; }
}

export function writeState(path: string, state: Record<string, ConnectorState>): void {
  const absolute = assertInsideRoots(path);
  const directory = absolute.slice(0, absolute.lastIndexOf('/')) || '.';
  if (!existsSync(directory)) mkdirSync(directory, { recursive: true });
  writeFileSync(absolute, JSON.stringify(state, null, 2));
}

export function appendAudit(path: string, entry: Record<string, unknown>): void {
  const absolute = assertInsideRoots(path);
  const directory = absolute.slice(0, absolute.lastIndexOf('/')) || '.';
  if (!existsSync(directory)) mkdirSync(directory, { recursive: true });
  appendFileSync(absolute, `${JSON.stringify(entry)}\n`);
}

export function hashOf(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
