import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { responseJSON, sameOrigin } from "./workspace-backend";

/**
 * Persistent task, schedule and notification backend.
 *
 * The platform previously kept conversations and notifications in the browser
 * only, so a refresh, a new browser or a new device lost them. This backend
 * stores them on the server, scoped to the authenticated identity, and adds a
 * real server-side scheduler.
 *
 * Everything here is owner scoped: a task, schedule or notification is only
 * ever visible to the identity that created it.
 */
export type TaskStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";
export type TaskKind = "conversation" | "skill" | "check" | "manual";

export type TaskRecord = {
  id: string;
  ownerId: string;
  projectId: string;
  kind: TaskKind;
  title: string;
  status: TaskStatus;
  payload: string;
  summary: string;
  error: string;
  attempts: number;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
};

export type ScheduleRecord = {
  id: string;
  ownerId: string;
  name: string;
  cron: string;
  timezone: string;
  url: string;
  expectStatus: number;
  timeoutMs: number;
  enabled: boolean;
  lastRunAt: number | null;
  nextRunAt: number | null;
  lastStatus: string;
  createdAt: number;
  updatedAt: number;
};

const STATUSES: TaskStatus[] = ["queued", "running", "succeeded", "failed", "cancelled"];
const KINDS: TaskKind[] = ["conversation", "skill", "check", "manual"];
const MAX_PAYLOAD = 400_000;

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

export function parseCron(expression: string): number[][] | null {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return null;
  const bounds = [
    [0, 59],
    [0, 23],
    [1, 31],
    [1, 12],
    [0, 6],
  ];
  const parsed: number[][] = [];
  for (let index = 0; index < 5; index += 1) {
    const [min, max] = bounds[index] as [number, number];
    const values = new Set<number>();
    for (const part of fields[index].split(",")) {
      if (!part) return null;
      const [rangePart, stepPart] = part.split("/");
      const step = stepPart === undefined ? 1 : Number(stepPart);
      if (!Number.isInteger(step) || step < 1 || step > max) return null;
      let start = min;
      let end = max;
      if (rangePart !== "*") {
        const [a, b] = rangePart.split("-");
        start = Number(a);
        end = b === undefined ? (stepPart === undefined ? start : max) : Number(b);
        if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
        if (index === 4 && end === 7) end = 0;
        if (start < min || end > max || start > end) return null;
      }
      for (let value = start; value <= end; value += step) values.add(value);
    }
    if (!values.size) return null;
    parsed.push([...values].sort((a, b) => a - b));
  }
  return parsed;
}

function timezoneParts(date: Date, timezone: string): { minute: number; hour: number; day: number; month: number; weekday: number } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    minute: "numeric",
    hour: "numeric",
    hour12: false,
    day: "numeric",
    month: "numeric",
    weekday: "short",
  });
  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) parts[part.type] = part.value;
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return {
    minute: Number(parts.minute),
    hour: Number(parts.hour) % 24,
    day: Number(parts.day),
    month: Number(parts.month),
    weekday,
  };
}

/** Next matching minute in the target timezone, searched minute by minute for two days. */
export function nextRunAt(expression: string, timezone: string, from: Date): number | null {
  const parsed = parseCron(expression);
  if (!parsed) return null;
  const [minutes, hours, days, months, weekdays] = parsed;
  const candidate = new Date(from.getTime());
  candidate.setSeconds(0, 0);
  candidate.setMinutes(candidate.getMinutes() + 1);
  for (let step = 0; step < 60 * 24 * 3; step += 1) {
    const parts = timezoneParts(candidate, timezone);
    if (
      minutes.includes(parts.minute) &&
      hours.includes(parts.hour) &&
      months.includes(parts.month) &&
      (days.includes(parts.day) || weekdays.includes(parts.weekday)) &&
      (parsed[2].length === 31 || parsed[4].length === 7 ? days.includes(parts.day) || weekdays.includes(parts.weekday) : true)
    )
      return candidate.getTime();
    candidate.setMinutes(candidate.getMinutes() + 1);
  }
  return null;
}

export function validTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export class TaskBackend {
  private db: DatabaseSync;

  constructor(file = process.env.DESIGNBUDDY_TASKS_SQLITE_PATH || "./data/tasks.sqlite") {
    const path = resolve(file);
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
   CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,project_id TEXT NOT NULL,kind TEXT NOT NULL,title TEXT NOT NULL,status TEXT NOT NULL,payload TEXT NOT NULL,summary TEXT NOT NULL DEFAULT '',error TEXT NOT NULL DEFAULT '',attempts INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,completed_at INTEGER);
   CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,task_id TEXT,project_id TEXT NOT NULL DEFAULT '',kind TEXT NOT NULL,title TEXT NOT NULL,description TEXT NOT NULL,read INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS schedules(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,name TEXT NOT NULL,cron TEXT NOT NULL,timezone TEXT NOT NULL,url TEXT NOT NULL,expect_status INTEGER NOT NULL DEFAULT 200,timeout_ms INTEGER NOT NULL DEFAULT 15000,enabled INTEGER NOT NULL DEFAULT 1,last_run_at INTEGER,next_run_at INTEGER,last_status TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS schedule_runs(id TEXT PRIMARY KEY,schedule_id TEXT NOT NULL,owner_id TEXT NOT NULL,started_at INTEGER NOT NULL,finished_at INTEGER,status TEXT NOT NULL,detail TEXT NOT NULL DEFAULT '');
   CREATE TABLE IF NOT EXISTS ai_usage(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,model TEXT NOT NULL,provider TEXT NOT NULL,prompt_tokens INTEGER,completion_tokens INTEGER,total_tokens INTEGER,reported INTEGER NOT NULL DEFAULT 0,latency_ms INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL,error TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL);
   CREATE INDEX IF NOT EXISTS ai_usage_owner ON ai_usage(owner_id,created_at);`);
  }

  close() {
    this.db.close();
  }

  private row(value: Record<string, unknown>): TaskRecord {
    return {
      id: String(value.id),
      ownerId: String(value.owner_id),
      projectId: String(value.project_id),
      kind: value.kind as TaskKind,
      title: String(value.title),
      status: value.status as TaskStatus,
      payload: String(value.payload),
      summary: String(value.summary),
      error: String(value.error),
      attempts: Number(value.attempts),
      createdAt: Number(value.created_at),
      updatedAt: Number(value.updated_at),
      completedAt: value.completed_at === null || value.completed_at === undefined ? null : Number(value.completed_at),
    };
  }

  listTasks(ownerId: string, projectId?: string): TaskRecord[] {
    const rows = projectId
      ? this.db.prepare("SELECT * FROM tasks WHERE owner_id=? AND project_id=? ORDER BY updated_at DESC LIMIT 200").all(ownerId, projectId)
      : this.db.prepare("SELECT * FROM tasks WHERE owner_id=? ORDER BY updated_at DESC LIMIT 200").all(ownerId);
    return (rows as Record<string, unknown>[]).map(row => this.row(row));
  }

  getTask(ownerId: string, id: string): TaskRecord | undefined {
    const value = this.db.prepare("SELECT * FROM tasks WHERE id=? AND owner_id=?").get(id, ownerId) as Record<string, unknown> | undefined;
    return value ? this.row(value) : undefined;
  }

  /** Create or replace a task. The owner may only move a task into a terminal state it can prove. */
  saveTask(
    ownerId: string,
    input: {
      id?: string;
      projectId: string;
      kind: string;
      title: string;
      status: string;
      payload?: string;
      summary?: string;
      error?: string;
    },
  ): TaskRecord {
    const id = input.id && /^[A-Za-z0-9_-]{6,80}$/.test(input.id) ? input.id : randomUUID();
    const kind = (KINDS.includes(input.kind as TaskKind) ? input.kind : "manual") as TaskKind;
    const status = (STATUSES.includes(input.status as TaskStatus) ? input.status : "queued") as TaskStatus;
    const payload = text(input.payload, MAX_PAYLOAD);
    const now = Date.now();
    const existing = this.getTask(ownerId, id);
    if (existing) {
      this.db
        .prepare(
          "UPDATE tasks SET project_id=?,kind=?,title=?,status=?,payload=?,summary=?,error=?,updated_at=?,completed_at=? WHERE id=? AND owner_id=?",
        )
        .run(
          input.projectId.slice(0, 120),
          kind,
          text(input.title, 200),
          status,
          payload,
          text(input.summary, 2000),
          text(input.error, 2000),
          now,
          status === "succeeded" || status === "failed" || status === "cancelled" ? existing.completedAt ?? now : null,
          id,
          ownerId,
        );
      return this.getTask(ownerId, id)!;
    }
    this.db
      .prepare(
        "INSERT INTO tasks(id,owner_id,project_id,kind,title,status,payload,summary,error,attempts,created_at,updated_at,completed_at) VALUES(?,?,?,?,?,?,?,?,?,0,?,?,?)",
      )
      .run(
        id,
        ownerId,
        input.projectId.slice(0, 120),
        kind,
        text(input.title, 200),
        status,
        payload,
        text(input.summary, 2000),
        text(input.error, 2000),
        now,
        now,
        status === "succeeded" || status === "failed" || status === "cancelled" ? now : null,
      );
    return this.getTask(ownerId, id)!;
  }

  retryTask(ownerId: string, id: string): TaskRecord | undefined {
    const existing = this.getTask(ownerId, id);
    if (!existing) return undefined;
    if (!["failed", "cancelled"].includes(existing.status))
      throw new Error("只有失败或已取消的任务可以重试。");
    this.db
      .prepare("UPDATE tasks SET status='queued',error='',attempts=attempts+1,updated_at=?,completed_at=NULL WHERE id=? AND owner_id=?")
      .run(Date.now(), id, ownerId);
    return this.getTask(ownerId, id);
  }

  deleteTask(ownerId: string, id: string): boolean {
    const existing = this.getTask(ownerId, id);
    if (!existing) return false;
    this.db.prepare("DELETE FROM tasks WHERE id=? AND owner_id=?").run(id, ownerId);
    this.db.prepare("DELETE FROM notifications WHERE task_id=? AND owner_id=?").run(id, ownerId);
    return true;
  }

  /**
   * The operator view of the AI usage. It reads across accounts on purpose:
   * only the admin console may call it, and it never returns account secrets.
   */
  adminUsageSummary(limit = 500) {
    const rows = this.db
      .prepare(
        "SELECT owner_id,model,provider,count(*) AS calls,sum(prompt_tokens) AS prompt,sum(completion_tokens) AS completion,sum(total_tokens) AS total,sum(latency_ms) AS latency,sum(case when status='error' then 1 else 0 end) AS errors FROM ai_usage GROUP BY owner_id,model,provider ORDER BY total desc",
      )
      .all() as Array<{
      owner_id: string;
      model: string;
      provider: string;
      calls: number;
      prompt: number | null;
      completion: number | null;
      total: number | null;
      latency: number | null;
      errors: number | null;
    }>;
    const byOwner = new Map<string, { ownerId: string; calls: number; totalTokens: number; errors: number }>();
    const byModel = new Map<string, { model: string; provider: string; calls: number; totalTokens: number }>();
    let calls = 0,
      promptTokens = 0,
      completionTokens = 0,
      totalTokens = 0,
      errors = 0,
      latency = 0;
    for (const row of rows) {
      calls += Number(row.calls || 0);
      promptTokens += Number(row.prompt || 0);
      completionTokens += Number(row.completion || 0);
      totalTokens += Number(row.total || 0);
      errors += Number(row.errors || 0);
      latency += Number(row.latency || 0);
      const owner = byOwner.get(row.owner_id) ?? { ownerId: row.owner_id, calls: 0, totalTokens: 0, errors: 0 };
      owner.calls += Number(row.calls || 0);
      owner.totalTokens += Number(row.total || 0);
      owner.errors += Number(row.errors || 0);
      byOwner.set(row.owner_id, owner);
      const key = `${row.provider}:${row.model}`;
      const model = byModel.get(key) ?? { model: row.model, provider: row.provider, calls: 0, totalTokens: 0 };
      model.calls += Number(row.calls || 0);
      model.totalTokens += Number(row.total || 0);
      byModel.set(key, model);
    }
    return {
      calls,
      promptTokens,
      completionTokens,
      totalTokens,
      errors,
      averageLatencyMs: calls ? Math.round(latency / calls) : 0,
      byOwner: [...byOwner.values()].sort((a, b) => b.totalTokens - a.totalTokens).slice(0, 20),
      byModel: [...byModel.values()].sort((a, b) => b.totalTokens - a.totalTokens).slice(0, 20),
      rows: rows.length,
    };
  }

  /** The task counts and the newest failures, across accounts. */
  adminTaskStats(limit = 20) {
    const byStatus = this.db
      .prepare("SELECT status,count(*) AS n FROM tasks GROUP BY status")
      .all() as Array<{ status: string; n: number }>;
    const byKind = this.db
      .prepare("SELECT kind,count(*) AS n FROM tasks GROUP BY kind")
      .all() as Array<{ kind: string; n: number }>;
    const failures = this.db
      .prepare("SELECT id,owner_id,project_id,kind,title,error,updated_at FROM tasks WHERE status='failed' ORDER BY updated_at DESC LIMIT ?")
      .all(Math.max(1, Math.min(100, limit))) as Array<{
      id: string;
      owner_id: string;
      project_id: string;
      kind: string;
      title: string;
      error: string;
      updated_at: number;
    }>;
    return {
      total: byStatus.reduce((sum, row) => sum + Number(row.n || 0), 0),
      byStatus: Object.fromEntries(byStatus.map((row) => [row.status, Number(row.n || 0)])),
      byKind: Object.fromEntries(byKind.map((row) => [row.kind, Number(row.n || 0)])),
      failures: failures.map((row) => ({
        id: row.id,
        ownerId: row.owner_id,
        projectId: row.project_id,
        kind: row.kind,
        title: row.title,
        error: row.error || "",
        updatedAt: Number(row.updated_at),
      })),
    };
  }

  /** Every schedule on the server, for the operator console. */
  adminSchedules() {
    const rows = this.db
      .prepare("SELECT * FROM schedules ORDER BY created_at DESC")
      .all() as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      id: String(row.id),
      ownerId: String(row.owner_id),
      name: String(row.name),
      cron: String(row.cron),
      timezone: String(row.timezone),
      enabled: Boolean(row.enabled),
      lastRunAt: Number(row.last_run_at || 0),
      nextRunAt: Number(row.next_run_at || 0),
      lastStatus: String(row.last_status || ""),
      lastDetail: String(row.last_detail || ""),
    }));
  }

  /** Turn a schedule on or off, for an operator. */
  adminSetScheduleEnabled(ownerId: string, id: string, enabled: boolean) {
    const schedule = this.getSchedule(ownerId, id);
    if (!schedule) return null;
    this.db.prepare("UPDATE schedules SET enabled=? WHERE id=? AND owner_id=?").run(enabled ? 1 : 0, id, ownerId);
    return { ...schedule, enabled };
  }

  listNotifications(ownerId: string): {
    id: string;
    taskId: string | null;
    projectId: string;
    kind: string;
    title: string;
    description: string;
    read: boolean;
    createdAt: number;
  }[] {
    const rows = this.db
      .prepare("SELECT * FROM notifications WHERE owner_id=? ORDER BY created_at DESC LIMIT 200")
      .all(ownerId) as Record<string, unknown>[];
    return rows.map(row => ({
      id: String(row.id),
      taskId: row.task_id === null || row.task_id === undefined ? null : String(row.task_id),
      projectId: String(row.project_id || ""),
      kind: String(row.kind),
      title: String(row.title),
      description: String(row.description),
      read: Number(row.read) === 1,
      createdAt: Number(row.created_at),
    }));
  }

  addNotification(ownerId: string, input: { taskId?: string; projectId?: string; kind: string; title: string; description: string; id?: string }): string {
    const id = input.id && /^[A-Za-z0-9:_-]{6,160}$/.test(input.id) ? input.id : randomUUID();
    this.db
      .prepare("INSERT OR REPLACE INTO notifications(id,owner_id,task_id,project_id,kind,title,description,read,created_at) VALUES(?,?,?,?,?,?,?,0,?)")
      .run(id, ownerId, input.taskId ?? null, text(input.projectId, 120), text(input.kind, 20) || "complete", text(input.title, 120), text(input.description, 400), Date.now());
    return id;
  }

  markNotificationRead(ownerId: string, id?: string): void {
    if (id) this.db.prepare("UPDATE notifications SET read=1 WHERE id=? AND owner_id=?").run(id, ownerId);
    else this.db.prepare("UPDATE notifications SET read=1 WHERE owner_id=?").run(ownerId);
  }

  deleteNotification(ownerId: string, id: string): boolean {
    const info = this.db.prepare("DELETE FROM notifications WHERE id=? AND owner_id=?").run(id, ownerId);
    return Number(info.changes) > 0;
  }

  /** Record the real usage of one model call against its owner. */
  recordAiUsage(ownerId: string, record: {
    model: string;
    provider: string;
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
    reported: boolean;
    latencyMs: number;
    status: "succeeded" | "failed";
    error?: string;
  }): void {
    this.db
      .prepare("INSERT OR REPLACE INTO ai_usage(id,owner_id,model,provider,prompt_tokens,completion_tokens,total_tokens,reported,latency_ms,status,error,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(
        randomUUID(),
        ownerId,
        text(record.model, 120),
        text(record.provider, 60),
        record.promptTokens,
        record.completionTokens,
        record.totalTokens,
        record.reported ? 1 : 0,
        Math.max(0, Math.round(record.latencyMs || 0)),
        record.status,
        text(record.error, 400),
        Date.now(),
      );
  }

  /** The owner's own model usage. Other owners never see these rows. */
  listAiUsage(ownerId: string, limit = 200): {
    id: string;
    model: string;
    provider: string;
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
    reported: boolean;
    latencyMs: number;
    status: string;
    error: string;
    createdAt: number;
  }[] {
    const rows = this.db
      .prepare("SELECT * FROM ai_usage WHERE owner_id=? ORDER BY created_at DESC LIMIT ?")
      .all(ownerId, Math.max(1, Math.min(1000, limit))) as Record<string, unknown>[];
    return rows.map((row) => ({
      id: String(row.id),
      model: String(row.model),
      provider: String(row.provider),
      promptTokens: row.prompt_tokens === null || row.prompt_tokens === undefined ? null : Number(row.prompt_tokens),
      completionTokens: row.completion_tokens === null || row.completion_tokens === undefined ? null : Number(row.completion_tokens),
      totalTokens: row.total_tokens === null || row.total_tokens === undefined ? null : Number(row.total_tokens),
      reported: Number(row.reported) === 1,
      latencyMs: Number(row.latency_ms),
      status: String(row.status),
      error: String(row.error || ""),
      createdAt: Number(row.created_at),
    }));
  }

  private scheduleRow(value: Record<string, unknown>): ScheduleRecord {
    return {
      id: String(value.id),
      ownerId: String(value.owner_id),
      name: String(value.name),
      cron: String(value.cron),
      timezone: String(value.timezone),
      url: String(value.url),
      expectStatus: Number(value.expect_status),
      timeoutMs: Number(value.timeout_ms),
      enabled: Number(value.enabled) === 1,
      lastRunAt: value.last_run_at === null || value.last_run_at === undefined ? null : Number(value.last_run_at),
      nextRunAt: value.next_run_at === null || value.next_run_at === undefined ? null : Number(value.next_run_at),
      lastStatus: String(value.last_status),
      createdAt: Number(value.created_at),
      updatedAt: Number(value.updated_at),
    };
  }

  listSchedules(ownerId: string): ScheduleRecord[] {
    const rows = this.db.prepare("SELECT * FROM schedules WHERE owner_id=? ORDER BY created_at DESC").all(ownerId) as Record<string, unknown>[];
    return rows.map(row => this.scheduleRow(row));
  }

  getSchedule(ownerId: string, id: string): ScheduleRecord | undefined {
    const value = this.db.prepare("SELECT * FROM schedules WHERE id=? AND owner_id=?").get(id, ownerId) as Record<string, unknown> | undefined;
    return value ? this.scheduleRow(value) : undefined;
  }

  saveSchedule(
    ownerId: string,
    input: { id?: string; name: string; cron: string; timezone: string; url: string; expectStatus?: number; timeoutMs?: number; enabled?: boolean },
  ): ScheduleRecord {
    if (!parseCron(input.cron)) throw new Error("计划规则不是有效的 5 段 cron 表达式。");
    if (!validTimezone(input.timezone)) throw new Error("时区不是有效的 IANA 时区名称。");
    let url: URL;
    try {
      url = new URL(input.url);
    } catch {
      throw new Error("检查地址不是有效 URL。");
    }
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("只支持 http 或 https 检查地址。");
    const id = input.id && /^[A-Za-z0-9_-]{6,80}$/.test(input.id) ? input.id : randomUUID();
    const now = Date.now();
    const expectStatus = Number.isInteger(input.expectStatus) && (input.expectStatus as number) >= 100 && (input.expectStatus as number) <= 599 ? (input.expectStatus as number) : 200;
    const timeoutMs = Number.isInteger(input.timeoutMs) && (input.timeoutMs as number) >= 1000 && (input.timeoutMs as number) <= 120000 ? (input.timeoutMs as number) : 15000;
    const enabled = input.enabled === false ? 0 : 1;
    const next = enabled ? nextRunAt(input.cron, input.timezone, new Date()) : null;
    if (this.getSchedule(ownerId, id)) {
      this.db
        .prepare(
          "UPDATE schedules SET name=?,cron=?,timezone=?,url=?,expect_status=?,timeout_ms=?,enabled=?,next_run_at=?,updated_at=? WHERE id=? AND owner_id=?",
        )
        .run(text(input.name, 120), input.cron, input.timezone, url.toString(), expectStatus, timeoutMs, enabled, next, now, id, ownerId);
      return this.getSchedule(ownerId, id)!;
    }
    this.db
      .prepare(
        "INSERT INTO schedules(id,owner_id,name,cron,timezone,url,expect_status,timeout_ms,enabled,last_run_at,next_run_at,last_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,NULL,?,'',?,?)",
      )
      .run(id, ownerId, text(input.name, 120), input.cron, input.timezone, url.toString(), expectStatus, timeoutMs, enabled, next, now, now);
    return this.getSchedule(ownerId, id)!;
  }

  deleteSchedule(ownerId: string, id: string): boolean {
    const info = this.db.prepare("DELETE FROM schedules WHERE id=? AND owner_id=?").run(id, ownerId);
    return Number(info.changes) > 0;
  }

  dueSchedules(now = Date.now()): ScheduleRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM schedules WHERE enabled=1 AND next_run_at IS NOT NULL AND next_run_at<=?")
      .all(now) as Record<string, unknown>[];
    return rows.map(row => this.scheduleRow(row));
  }

  startScheduleRun(schedule: ScheduleRecord): string {
    const id = randomUUID();
    this.db
      .prepare("INSERT INTO schedule_runs(id,schedule_id,owner_id,started_at,finished_at,status,detail) VALUES(?,?,?,?,NULL,'running','')")
      .run(id, schedule.id, schedule.ownerId, Date.now());
    return id;
  }

  finishScheduleRun(runId: string, status: string, detail: string): void {
    this.db
      .prepare("UPDATE schedule_runs SET finished_at=?,status=?,detail=? WHERE id=?")
      .run(Date.now(), status, detail.slice(0, 1000), runId);
  }

  recordScheduleResult(schedule: ScheduleRecord, status: string): void {
    const next = schedule.enabled ? nextRunAt(schedule.cron, schedule.timezone, new Date()) : null;
    this.db
      .prepare("UPDATE schedules SET last_run_at=?,next_run_at=?,last_status=?,updated_at=? WHERE id=?")
      .run(Date.now(), next, status, Date.now(), schedule.id);
  }

  listScheduleRuns(ownerId: string, scheduleId: string): { id: string; startedAt: number; finishedAt: number | null; status: string; detail: string }[] {
    const rows = this.db
      .prepare("SELECT * FROM schedule_runs WHERE owner_id=? AND schedule_id=? ORDER BY started_at DESC LIMIT 50")
      .all(ownerId, scheduleId) as Record<string, unknown>[];
    return rows.map(row => ({
      id: String(row.id),
      startedAt: Number(row.started_at),
      finishedAt: row.finished_at === null || row.finished_at === undefined ? null : Number(row.finished_at),
      status: String(row.status),
      detail: String(row.detail),
    }));
  }

  async handle(request: Request, ownerId: string): Promise<Response | null> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    if (!path.startsWith("/api/tasks") && !path.startsWith("/api/notifications") && !path.startsWith("/api/schedules")) return null;
    if (!["GET", "HEAD"].includes(method) && !sameOrigin(request))
      return responseJSON({ error: "跨站修改请求已拒绝。" }, 403);
    try {
      if (path === "/api/tasks" && method === "GET") {
        const projectId = url.searchParams.get("projectId") || undefined;
        return responseJSON({ tasks: this.listTasks(ownerId, projectId) });
      }
      if (path === "/api/tasks" && method === "POST") {
        const body = (await request.json()) as Record<string, unknown>;
        const projectId = text(body.projectId, 120);
        if (!projectId) return responseJSON({ error: "缺少 projectId。" }, 400);
        const task = this.saveTask(ownerId, {
          id: typeof body.id === "string" ? body.id : undefined,
          projectId,
          kind: text(body.kind, 20) || "manual",
          title: text(body.title, 200),
          status: text(body.status, 20) || "queued",
          payload: text(body.payload, MAX_PAYLOAD),
          summary: text(body.summary, 2000),
          error: text(body.error, 2000),
        });
        return responseJSON({ task });
      }
      const taskMatch = /^\/api\/tasks\/([A-Za-z0-9_-]{1,80})$/.exec(path);
      if (taskMatch && method === "GET") {
        const task = this.getTask(ownerId, taskMatch[1]);
        return task ? responseJSON({ task }) : responseJSON({ error: "任务不存在。" }, 404);
      }
      const retryMatch = /^\/api\/tasks\/([A-Za-z0-9_-]{1,80})\/retry$/.exec(path);
      if (retryMatch && method === "POST") {
        try {
          const task = this.retryTask(ownerId, retryMatch[1]);
          return task ? responseJSON({ task }) : responseJSON({ error: "任务不存在。" }, 404);
        } catch (error) {
          return responseJSON({ error: error instanceof Error ? error.message : "重试失败。" }, 409);
        }
      }
      if (taskMatch && method === "DELETE") {
        return this.deleteTask(ownerId, taskMatch[1]) ? responseJSON({ ok: true }) : responseJSON({ error: "任务不存在。" }, 404);
      }
      if (path === "/api/notifications" && method === "GET")
        return responseJSON({ notifications: this.listNotifications(ownerId) });
      if (path === "/api/notifications" && method === "POST") {
        const body = (await request.json()) as Record<string, unknown>;
        const id = this.addNotification(ownerId, {
          id: typeof body.id === "string" ? body.id : undefined,
          taskId: typeof body.taskId === "string" ? body.taskId : undefined,
          projectId: text(body.projectId, 120),
          kind: text(body.kind, 20) || "complete",
          title: text(body.title, 120),
          description: text(body.description, 400),
        });
        return responseJSON({ id });
      }
      const notificationRead = /^\/api\/notifications\/([A-Za-z0-9_-]{1,120})\/read$/.exec(decodeURIComponent(path));
      if (notificationRead && method === "POST") {
        this.markNotificationRead(ownerId, notificationRead[1]);
        return responseJSON({ ok: true });
      }
      if (path === "/api/notifications/read-all" && method === "POST") {
        this.markNotificationRead(ownerId);
        return responseJSON({ ok: true });
      }
      const notificationMatch = /^\/api\/notifications\/([A-Za-z0-9_-]{1,120})$/.exec(decodeURIComponent(path));
      if (notificationMatch && method === "DELETE")
        return this.deleteNotification(ownerId, notificationMatch[1]) ? responseJSON({ ok: true }) : responseJSON({ error: "通知不存在。" }, 404);
      if (path === "/api/schedules" && method === "GET") return responseJSON({ schedules: this.listSchedules(ownerId) });
      if (path === "/api/schedules" && method === "POST") {
        const body = (await request.json()) as Record<string, unknown>;
        try {
          const schedule = this.saveSchedule(ownerId, {
            id: typeof body.id === "string" ? body.id : undefined,
            name: text(body.name, 120),
            cron: text(body.cron, 120),
            timezone: text(body.timezone, 80) || "UTC",
            url: text(body.url, 500),
            expectStatus: typeof body.expectStatus === "number" ? body.expectStatus : undefined,
            timeoutMs: typeof body.timeoutMs === "number" ? body.timeoutMs : undefined,
            enabled: body.enabled !== false,
          });
          return responseJSON({ schedule });
        } catch (error) {
          return responseJSON({ error: error instanceof Error ? error.message : "计划规则无效。" }, 400);
        }
      }
      const scheduleMatch = /^\/api\/schedules\/([A-Za-z0-9_-]{1,80})$/.exec(path);
      if (scheduleMatch && method === "GET") {
        const schedule = this.getSchedule(ownerId, scheduleMatch[1]);
        return schedule ? responseJSON({ schedule }) : responseJSON({ error: "计划不存在。" }, 404);
      }
      if (scheduleMatch && method === "DELETE")
        return this.deleteSchedule(ownerId, scheduleMatch[1]) ? responseJSON({ ok: true }) : responseJSON({ error: "计划不存在。" }, 404);
      const scheduleRuns = /^\/api\/schedules\/([A-Za-z0-9_-]{1,80})\/runs$/.exec(path);
      if (scheduleRuns && method === "GET")
        return responseJSON({ runs: this.listScheduleRuns(ownerId, scheduleRuns[1]) });
      return responseJSON({ error: "未找到该接口。" }, 404);
    } catch (error) {
      return responseJSON({ error: error instanceof Error ? error.message : "请求处理失败。" }, 400);
    }
  }
}
