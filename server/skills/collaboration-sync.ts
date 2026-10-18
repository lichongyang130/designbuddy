import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { strToU8 } from "fflate";

/**
 * External calendar and email adapter for `collaboration.sync`.
 *
 * Product decision implemented here (C1–C4 confirmation granularity):
 * - Every outbound send or write needs a per-run confirmation
 *   (`confirmation=yes`) and an explicit third-party consent
 *   (`externalConsent=yes`). There is no bulk or remembered approval.
 * - Every request carries an idempotency key. The key is persisted before the
 *   call and honoured afterwards, so a retry cannot create a second event or
 *   send a second mail.
 * - Credentials only come from the server environment. The adapter never
 *   accepts a key inside the uploaded file and never writes one to artifacts.
 *
 * Without configured credentials the skill stays unavailable in the
 * catalogue: generating an ICS file is not the same as creating a real event,
 * and this adapter does not pretend otherwise.
 */
export type CollaborationInput = {
  filename: string;
  bytes: Uint8Array;
  parameters?: Record<string, string>;
};

export type CollaborationResult = {
  summary: string;
  outputs: { name: string; mime: string; bytes: Uint8Array }[];
};

export type CollaborationChannels = {
  calendar: { baseUrl: string; token: string; calendarId: string } | null;
  email: { baseUrl: string; key: string; from: string } | null;
};

export function collaborationChannels(): CollaborationChannels {
  const calendarBase = process.env.COLLABORATION_CALENDAR_BASE_URL?.replace(/\/+$/, "");
  const calendarToken = process.env.COLLABORATION_CALENDAR_TOKEN;
  const calendarId = process.env.COLLABORATION_CALENDAR_ID;
  const emailBase = process.env.COLLABORATION_EMAIL_BASE_URL?.replace(/\/+$/, "");
  const emailKey = process.env.COLLABORATION_EMAIL_API_KEY;
  const from = process.env.COLLABORATION_EMAIL_FROM;
  return {
    calendar:
      calendarBase && calendarToken && calendarId
        ? { baseUrl: calendarBase, token: calendarToken, calendarId }
        : null,
    email: emailBase && emailKey && from ? { baseUrl: emailBase, key: emailKey, from } : null,
  };
}

function auditDir(): string {
  const directory = join(process.cwd(), "data", "collaboration-audit");
  if (!existsSync(directory)) mkdirSync(directory, { recursive: true });
  return directory;
}

function idempotencyPath(key: string): string {
  return join(auditDir(), `${key}.json`);
}

function readRequest(input: CollaborationInput): Record<string, unknown> {
  if (!/\.json$/i.test(input.filename)) throw new Error("请上传 JSON 请求文件（描述要同步的动作）。");
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(input.bytes));
  } catch {
    throw new Error("请求文件不是有效 JSON。");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("请求文件必须是 JSON 对象。");
  return parsed as Record<string, unknown>;
}

function requiredText(value: unknown, label: string, max = 500): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`请求缺少 ${label}。`);
  if (value.length > max) throw new Error(`${label} 超过 ${max} 字限制。`);
  return value.trim();
}

export async function runCollaborationSync(input: CollaborationInput, event: (message: string) => void): Promise<CollaborationResult> {
  const channels = collaborationChannels();
  const request = readRequest(input);
  const action = requiredText(request.action, "action（calendar.create 或 email.send）", 40);
  if (!["calendar.create", "email.send"].includes(action))
    throw new Error("只支持 calendar.create 与 email.send 两个动作；不猜测其它外部操作。");
  const idempotencyKey = (input.parameters?.idempotencyKey || "").trim();
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(idempotencyKey)) throw new Error("请提供 8–80 位的幂等键（仅字母、数字、下划线、连字符），用于防止重复外发。");
  if (input.parameters?.confirmation !== "yes") throw new Error("每次外发或写入都需要逐次确认：确认后才能执行。");
  if (input.parameters?.externalConsent !== "yes")
    throw new Error("该操作会把内容发送到第三方服务，请单次明确授权后再执行。");

  const existing = idempotencyPath(idempotencyKey);
  if (existsSync(existing)) {
    const previous = JSON.parse(readFileSync(existing, "utf8")) as { summary: string; status: string };
    throw new Error(`幂等键 ${idempotencyKey} 已执行过（${previous.status}），不会重复外发。`);
  }

  let externalId = "";
  let target = "";
  let result: Record<string, unknown>;

  if (action === "calendar.create") {
    if (!channels.calendar) throw new Error("服务端未配置日历通道（COLLABORATION_CALENDAR_BASE_URL / TOKEN / ID）。不会用 ICS 文件冒充真实日历事件。");
    const summary = requiredText(request.summary, "summary（事件标题）", 200);
    const start = requiredText(request.start, "start（ISO 8601 开始时间）", 40);
    const end = requiredText(request.end, "end（ISO 8601 结束时间）", 40);
    const timeZone = typeof request.timeZone === "string" && request.timeZone.trim() ? request.timeZone.trim().slice(0, 64) : "UTC";
    const description = typeof request.description === "string" ? request.description.slice(0, 2000) : "";
    const attendees = Array.isArray(request.attendees)
      ? request.attendees.filter((item): item is string => typeof item === "string" && item.length <= 200).slice(0, 50)
      : [];
    target = channels.calendar.calendarId;
    event(`正在向日历服务创建事件「${summary}」（幂等键 ${idempotencyKey}）。`);
    const response = await fetch(
      `${channels.calendar.baseUrl}/calendars/${encodeURIComponent(channels.calendar.calendarId)}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${channels.calendar.token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ summary, start: { dateTime: start, timeZone }, end: { dateTime: end, timeZone }, description, attendees }),
        signal: AbortSignal.timeout(30000),
      },
    ).catch(error => {
      throw new Error(`日历服务请求失败：${error instanceof Error ? error.message : String(error)}`);
    });
    const raw = await response.text();
    if (!response.ok) throw new Error(`日历服务返回 HTTP ${response.status}：${raw.slice(0, 300)}`);
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      parsed = {};
    }
    externalId = typeof parsed.id === "string" ? parsed.id : "";
    result = { action, externalId, calendarId: channels.calendar.calendarId, summary, start, end, timeZone, attendeeCount: attendees.length };
  } else {
    if (!channels.email) throw new Error("服务端未配置邮件通道（COLLABORATION_EMAIL_BASE_URL / API_KEY / FROM）。不会假装邮件已发送。");
    const recipients = Array.isArray(request.to)
      ? request.to.filter((item): item is string => typeof item === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(item)).slice(0, 50)
      : [];
    if (!recipients.length) throw new Error("请提供至少一个有效收件人（to 数组）。");
    const subject = requiredText(request.subject, "subject（邮件主题）", 200);
    const body = requiredText(request.body, "body（邮件正文）", 8000);
    target = recipients.join(", ");
    event(`正在通过邮件服务向 ${recipients.length} 个收件人发送「${subject}」（幂等键 ${idempotencyKey}）。`);
    const response = await fetch(`${channels.email.baseUrl}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${channels.email.key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({ from: channels.email.from, to: recipients, subject, text: body }),
      signal: AbortSignal.timeout(30000),
    }).catch(error => {
      throw new Error(`邮件服务请求失败：${error instanceof Error ? error.message : String(error)}`);
    });
    const raw = await response.text();
    if (!response.ok) throw new Error(`邮件服务返回 HTTP ${response.status}：${raw.slice(0, 300)}`);
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      parsed = {};
    }
    externalId = typeof parsed.id === "string" ? parsed.id : "";
    result = { action, externalId, from: channels.email.from, recipients, subject, bodyCharacters: body.length };
  }

  const record = {
    tool: "collaboration.sync",
    action,
    target,
    externalId,
    idempotencyKey,
    executedAt: new Date().toISOString(),
    status: "succeeded",
    ...result,
  };
  writeFileSync(existing, JSON.stringify(record, null, 2));
  appendFileSync(join(auditDir(), "audit.jsonl"), `${JSON.stringify({ at: record.executedAt, action, target, externalId, idempotencyKey })}\n`);
  return {
    summary: `${action === "calendar.create" ? "已在真实日历服务创建事件" : "已通过邮件服务发送邮件"}（幂等键 ${idempotencyKey}）。外部返回标识：${externalId || "服务未返回 id"}。回执只证明服务接受了请求，收件人是否阅读无法由本工具判断。`,
    outputs: [
      { name: "collaboration-result.json", mime: "application/json", bytes: strToU8(JSON.stringify(record, null, 2)) },
      { name: "collaboration-audit.jsonl", mime: "application/x-ndjson", bytes: strToU8(`${JSON.stringify(record)}\n`) },
    ],
  };
}
