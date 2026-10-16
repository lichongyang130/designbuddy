import { validateConnectorConfig, pullConnector, applyIncrementalFilter, mapRows, readState, writeState, appendAudit, assertInsideRoots, type ConnectorConfig, type ConnectorState, type MappedRow } from './data-connector';
import { out, json, text } from './io';
import { validateSkillOptions } from './contracts';
import type { SkillInput } from './executors';

type ConnectorPlan = { connectors: ConnectorConfig[]; statePath: string; auditPath: string; persistState: boolean };

function parsePlan(input: SkillInput): ConnectorPlan {
  let parsed: unknown;
  try { parsed = JSON.parse(text(input.bytes)); } catch { throw Error('连接器配置必须是有效JSON。'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error('连接器配置根节点必须是对象。');
  const raw = parsed as Record<string, unknown>;
  const allowed = new Set(['connectors', 'statePath', 'auditPath', 'persistState']);
  if (Object.keys(raw).some(key => !allowed.has(key))) throw Error('连接器配置包含未知字段。');
  if (!Array.isArray(raw.connectors) || !raw.connectors.length || raw.connectors.length > 10) throw Error('connectors 必须是1至10个连接器。');
  const connectors = raw.connectors.map(validateConnectorConfig);
  if (new Set(connectors.map(connector => connector.id)).size !== connectors.length) throw Error('连接器 id 不能重复。');
  const statePath = raw.statePath === undefined ? '' : raw.statePath;
  const auditPath = raw.auditPath === undefined ? '' : raw.auditPath;
  if (statePath && (typeof statePath !== 'string' || statePath.length > 300)) throw Error('statePath 不合法。');
  if (auditPath && (typeof auditPath !== 'string' || auditPath.length > 300)) throw Error('auditPath 不合法。');
  const persistState = raw.persistState === undefined ? true : raw.persistState;
  if (typeof persistState !== 'boolean') throw Error('persistState 必须是布尔值。');
  return { connectors, statePath: statePath as string, auditPath: auditPath as string, persistState };
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: MappedRow[]): string {
  const headers: string[] = [];
  for (const row of rows) for (const key of Object.keys(row)) if (!headers.includes(key)) headers.push(key);
  if (!headers.length) return '';
  const lines = [headers.map(csvCell).join(',')];
  for (const row of rows) lines.push(headers.map(header => csvCell(row[header])).join(','));
  return `${lines.join('\r\n')}\r\n`;
}

export async function connectData(input: SkillInput, event: (message: string) => void) {
  validateSkillOptions('data.connect', { deduplicate: input.deduplicate, ...(input.parameters ? { parameters: input.parameters } : {}) });
  const plan = parsePlan(input);
  const state = plan.statePath ? readState(plan.statePath) : {};
  const nextState: Record<string, ConnectorState> = { ...state };
  const rows: MappedRow[] = [];
  const report: unknown[] = [];
  const audit: Record<string, unknown>[] = [];
  for (const connector of plan.connectors) {
    const cursorBefore = state[connector.id]?.cursor || '';
    event(`连接器 ${connector.id}（${connector.type}）开始读取。`);
    let pulled;
    try { pulled = await pullConnector(connector); }
    catch (error) { throw Error(`连接器 ${connector.id} 读取失败：${error instanceof Error ? error.message : '未知错误'}`); }
    const filtered = applyIncrementalFilter(pulled.rows, connector.cursorField, cursorBefore);
    const mapped = mapRows(filtered.kept, connector, pulled.origin, filtered.nextCursor);
    rows.push(...mapped.mapped);
    nextState[connector.id] = { cursor: filtered.nextCursor, updatedAt: new Date().toISOString(), rowsSeen: (state[connector.id]?.rowsSeen || 0) + mapped.mapped.length };
    const entry = {
      connector: connector.id, type: connector.type, origin: pulled.origin,
      rowsRead: pulled.rows.length, rowsEmitted: mapped.mapped.length, rowsSkippedByCursor: filtered.filtered,
      cursorBefore, cursorAfter: filtered.nextCursor, incremental: Boolean(connector.cursorField),
      fields: mapped.fields, truncated: pulled.truncated, bytesRead: pulled.bytesRead,
      sha256: pulled.origin,
    };
    report.push(entry);
    const auditEntry = { timestamp: new Date().toISOString(), action: 'connector.pull', ...entry };
    audit.push(auditEntry);
    if (plan.auditPath) appendAudit(plan.auditPath, auditEntry);
    event(`连接器 ${connector.id} 读取${pulled.rows.length}行，映射输出${mapped.mapped.length}行${filtered.filtered ? `，按游标跳过${filtered.filtered}行` : ''}。`);
  }
  if (plan.persistState && plan.statePath) writeState(plan.statePath, nextState);
  const auditText = audit.map(entry => JSON.stringify(entry)).join('\n') + (audit.length ? '\n' : '');
  if (plan.auditPath) appendAudit(plan.auditPath, { timestamp: new Date().toISOString(), action: 'connector.batch', connectors: plan.connectors.map(connector => connector.id), rows: rows.length });
  const summary = `实际从${plan.connectors.length}个连接器读取并映射${rows.length}行；每行都带来源标记。${plan.connectors.some(connector => connector.cursorField) ? '已按游标做增量读取。' : '未配置游标字段，本次是全量读取。'}凭据只从服务端环境变量读取，不从上传文件读取。`;
  return {
    summary,
    outputs: [
      json('connected-rows.json', { generatedAt: new Date().toISOString(), rowCount: rows.length, rows }),
      out('connected-rows.csv', 'text/csv; charset=utf-8', new TextEncoder().encode(toCsv(rows))),
      json('connector-report.json', { connectors: report, policy: '只做读取、字段映射、类型转换、游标增量与来源标记；不写回数据源、不执行用户SQL、不推断业务口径。路径必须位于允许目录（SKILL_CONNECTOR_ROOTS，默认 data/）；远程主机必须在 SKILL_CONNECTOR_ALLOWED_HOSTS 内，令牌只从 SKILL_CONNECTOR_TOKENS 读取。类型转换失败即整次失败，不丢弃行。' }),
      out('connector-audit.jsonl', 'application/x-ndjson', new TextEncoder().encode(auditText)),
    ],
  };
}
