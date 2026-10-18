import type { PreviewErrorInput, PreviewRuntimeError, PreviewSession } from "./preview-types";

export interface ErrorReporterOptions {
  maxReports?: number;
  maxMessageLength?: number;
  maxStackLength?: number;
}

function redact(value: string): string {
  return value
    .replace(/\u001b\[[0-9;]*m/g, "")
    .replace(/\b(sk-[A-Za-z0-9_-]{8,})\b/g, "[REDACTED_API_KEY]")
    .replace(/(authorization\s*:\s*bearer\s+)[^\s]+/gi, "$1[REDACTED]")
    .replace(/((?:api[_-]?key|password|token|secret)\s*[=:]\s*)[^\s,;]+/gi, "$1[REDACTED]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[REDACTED_TOKEN]");
}

function normalize(value: string, maxLength: number): string {
  return redact(value).replace(/[\r\n\t]+/g, " ").trim().slice(0, maxLength);
}

function fingerprintOf(name: string, message: string, source: string): string {
  const input = name + "|" + message + "|" + source;
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Stores sanitized, deduplicated error reports for a preview session. */
export class ErrorReporter {
  private readonly reports: PreviewRuntimeError[] = [];
  private readonly byFingerprint = new Map<string, PreviewRuntimeError>();
  private readonly maxReports: number;
  private readonly maxMessageLength: number;
  private readonly maxStackLength: number;
  private counter = 0;

  constructor(options: ErrorReporterOptions = {}) {
    this.maxReports = Math.max(1, options.maxReports ?? 500);
    this.maxMessageLength = Math.max(100, options.maxMessageLength ?? 2000);
    this.maxStackLength = Math.max(500, options.maxStackLength ?? 8000);
  }

  report(session: PreviewSession, input: PreviewErrorInput): PreviewRuntimeError {
    const name = normalize(input.name ?? "RuntimeError", 120) || "RuntimeError";
    const message = normalize(input.message || "Unknown preview runtime error", this.maxMessageLength);
    const source = normalize(input.source ?? "", 500);
    const fingerprint = fingerprintOf(name, message, source);
    const existing = this.byFingerprint.get(session.id + ":" + fingerprint);

    if (existing) {
      existing.count += 1;
      existing.timestamp = input.timestamp ?? Date.now();
      return { ...existing };
    }

    const report: PreviewRuntimeError = {
      id: "preview-error-" + Date.now().toString(36) + "-" + (++this.counter).toString(36),
      sessionId: session.id,
      projectId: session.projectId,
      ownerId: session.ownerId,
      name,
      message,
      ...(input.stack ? { stack: normalize(input.stack, this.maxStackLength) } : {}),
      ...(source ? { source } : {}),
      timestamp: input.timestamp ?? Date.now(),
      fingerprint,
      count: 1
    };

    while (this.reports.length >= this.maxReports) {
      const removed = this.reports.shift();
      if (removed) this.byFingerprint.delete(removed.sessionId + ":" + removed.fingerprint);
    }
    this.reports.push(report);
    this.byFingerprint.set(session.id + ":" + fingerprint, report);
    return { ...report };
  }

  listForSession(sessionId: string): PreviewRuntimeError[] {
    return this.reports
      .filter((report) => report.sessionId === sessionId)
      .map((report) => ({ ...report }));
  }

  clearSession(sessionId: string): void {
    const remaining = this.reports.filter((report) => report.sessionId !== sessionId);
    for (const report of this.reports) {
      if (report.sessionId === sessionId) {
        this.byFingerprint.delete(report.sessionId + ":" + report.fingerprint);
      }
    }
    this.reports.splice(0, this.reports.length, ...remaining);
  }
}
