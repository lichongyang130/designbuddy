import { resolve } from "node:path";
import type { WorkerConfig } from "./types";

function integerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(name + " must be a positive integer.");
  }
  return parsed;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error("Missing required environment variable: " + name);
  return value;
}

export function loadWorkerConfig(): WorkerConfig {
  const token = required("PREVIEW_RUNTIME_TOKEN");
  if (token.length < 32) {
    throw new Error("PREVIEW_RUNTIME_TOKEN must contain at least 32 characters.");
  }

  const originRaw = required("PUBLIC_PREVIEW_ORIGIN");
  const origin = new URL(originRaw);
  if (
    !["http:", "https:"].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  ) {
    throw new Error("PUBLIC_PREVIEW_ORIGIN must be an origin URL without path, query, or credentials.");
  }
  if (origin.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(origin.hostname)) {
    throw new Error("PUBLIC_PREVIEW_ORIGIN must use HTTPS outside localhost.");
  }

  const hostPortStart = integerEnv("PREVIEW_HOST_PORT_START", 41000);
  const hostPortEnd = integerEnv("PREVIEW_HOST_PORT_END", 41999);
  if (hostPortEnd < hostPortStart || hostPortEnd - hostPortStart < 9 || hostPortEnd > 65535) {
    throw new Error("PREVIEW_HOST_PORT_START/END must define a range of at least 10 ports within 65535.");
  }

  const memoryLimit = process.env.PREVIEW_MEMORY_LIMIT?.trim() || "512m";
  if (!/^\d+(?:m|g)$/i.test(memoryLimit)) {
    throw new Error("PREVIEW_MEMORY_LIMIT must look like 512m or 1g.");
  }

  const cpuLimit = process.env.PREVIEW_CPU_LIMIT?.trim() || "1";
  if (!/^\d+(?:\.\d+)?$/.test(cpuLimit) || Number(cpuLimit) <= 0 || Number(cpuLimit) > 8) {
    throw new Error("PREVIEW_CPU_LIMIT must be a positive CPU count no greater than 8.");
  }

  const workerId = process.env.PREVIEW_WORKER_ID?.trim() || "designbuddy-preview-worker";
  if (!/^[A-Za-z0-9_.-]{1,64}$/.test(workerId)) {
    throw new Error("PREVIEW_WORKER_ID must use letters, digits, dot, underscore or hyphen.");
  }

  const previewBindHost = process.env.PREVIEW_BIND_HOST?.trim() || "127.0.0.1";
  const previewUpstreamHost = process.env.PREVIEW_UPSTREAM_HOST?.trim() || "127.0.0.1";
  const hostPattern = /^[A-Za-z0-9.:[\]-]+$/;
  if (!hostPattern.test(previewBindHost) || !hostPattern.test(previewUpstreamHost)) {
    throw new Error("Preview bind/upstream host contains invalid characters.");
  }

  return {
    token,
    workerId,
    publicPreviewOrigin: origin.origin,
    workspaceRoot: resolve(process.env.PREVIEW_WORKSPACE_ROOT || "/var/lib/designbuddy-preview"),
    hostPortStart,
    hostPortEnd,
    previewBindHost,
    previewUpstreamHost,
    memoryLimit,
    cpuLimit,
    pidsLimit: integerEnv("PREVIEW_PIDS_LIMIT", 128),
    maxSessions: integerEnv("PREVIEW_MAX_SESSIONS", 8),
    maxFiles: integerEnv("PREVIEW_MAX_FILES", 500),
    maxTotalBytes: integerEnv("PREVIEW_MAX_TOTAL_BYTES", 5 * 1024 * 1024),
    startupTimeoutMs: integerEnv("PREVIEW_STARTUP_TIMEOUT_MS", 180000),
    sessionTtlMs: integerEnv("PREVIEW_SESSION_TTL_MS", 7200000),
    port: integerEnv("PORT", 8080),
    host: process.env.HOST?.trim() || "0.0.0.0"
  };
}
