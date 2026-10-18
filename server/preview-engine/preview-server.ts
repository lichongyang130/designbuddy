import { randomUUID } from "node:crypto";
import { ErrorReporter } from "./error-reporter";
import { HotReloadHub } from "./hot-reload";
import { RuntimeMonitor } from "./runtime-monitor";
import { PreviewSessionError, PreviewSessionStore } from "./preview-session";
import type {
  PreviewActor,
  PreviewAdapter,
  PreviewErrorInput,
  PreviewEvent,
  PreviewFile,
  PreviewFramework,
  PreviewHealth,
  PreviewSession,
  PreviewStartInput
} from "./preview-types";

export interface PreviewServerOptions {
  /** Exact origins trusted for externally hosted previews. */
  allowedPreviewOrigins?: string[];
  maxFiles?: number;
  maxTotalBytes?: number;
  idFactory?: () => string;
}

export interface StartPreviewRequest {
  projectId: string;
  framework: PreviewFramework;
  files: PreviewFile[];
}

export interface UpdatePreviewRequest {
  files: PreviewFile[];
  changedPaths: string[];
}

export class PreviewServerError extends Error {
  constructor(
    message: string,
    public readonly code: "INVALID_INPUT" | "UNSAFE_PREVIEW_URL" | "ADAPTER_ERROR"
  ) {
    super(message);
    this.name = "PreviewServerError";
  }
}

function safeProjectId(value: string): string {
  if (typeof value !== "string") {
    throw new PreviewServerError("projectId is invalid.", "INVALID_INPUT");
  }
  const result = value.trim();
  if (!result || result.length > 160 || /[\u0000-\u001f]/.test(result)) {
    throw new PreviewServerError("projectId is invalid.", "INVALID_INPUT");
  }
  return result;
}

function validateFiles(files: PreviewFile[], maxFiles: number, maxTotalBytes: number): PreviewFile[] {
  if (!Array.isArray(files) || files.length === 0 || files.length > maxFiles) {
    throw new PreviewServerError("files must be a non-empty array within the configured limit.", "INVALID_INPUT");
  }

  const seen = new Set<string>();
  let totalBytes = 0;
  const safe: PreviewFile[] = [];

  for (const file of files) {
    if (!file || typeof file.path !== "string" || typeof file.content !== "string") {
      throw new PreviewServerError("Each preview file must contain string path and content values.", "INVALID_INPUT");
    }

    const path = file.path.trim();
    const segments = path.split("/");
    if (
      !path ||
      path.startsWith("/") ||
      path.includes("\\") ||
      path.includes("\u0000") ||
      segments.some((segment) => segment === ".." || segment === "." || segment === "") ||
      /^([A-Za-z]:)/.test(path) ||
      /(^|\/)\.env(?:\.|$)/i.test(path) ||
      /(^|\/)(?:id_rsa|id_ed25519|\.npmrc|\.gitconfig)$/i.test(path)
    ) {
      throw new PreviewServerError("Unsafe or unsupported preview path: " + path, "INVALID_INPUT");
    }
    if (seen.has(path)) {
      throw new PreviewServerError("Duplicate preview file path: " + path, "INVALID_INPUT");
    }
    seen.add(path);

    const bytes = new TextEncoder().encode(file.content).length;
    totalBytes += bytes;
    if (totalBytes > maxTotalBytes) {
      throw new PreviewServerError("Preview source exceeds the configured size limit.", "INVALID_INPUT");
    }
    safe.push({ path, content: file.content });
  }

  return safe;
}

function makeDefaultId(): string {
  // Preview URLs are public capability links, so session IDs must be unpredictable.
  return "preview_" + randomUUID();
}

export class PreviewServer {
  readonly sessions: PreviewSessionStore;
  readonly hotReload: HotReloadHub;
  readonly monitor: RuntimeMonitor;
  readonly errors: ErrorReporter;

  private readonly allowedPreviewOrigins: Set<string>;
  private readonly allowedPreviewHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  private readonly maxFiles: number;
  private readonly maxTotalBytes: number;
  private readonly idFactory: () => string;

  constructor(
    private readonly adapter: PreviewAdapter,
    options: PreviewServerOptions = {},
    dependencies: {
      sessions?: PreviewSessionStore;
      hotReload?: HotReloadHub;
      monitor?: RuntimeMonitor;
      errors?: ErrorReporter;
    } = {}
  ) {
    this.sessions = dependencies.sessions ?? new PreviewSessionStore();
    this.hotReload = dependencies.hotReload ?? new HotReloadHub();
    this.monitor = dependencies.monitor ?? new RuntimeMonitor();
    this.errors = dependencies.errors ?? new ErrorReporter();
    this.allowedPreviewOrigins = new Set(
      (options.allowedPreviewOrigins ?? []).map((origin) => new URL(origin).origin)
    );
    this.maxFiles = Math.max(1, options.maxFiles ?? 500);
    this.maxTotalBytes = Math.max(1024, options.maxTotalBytes ?? 5 * 1024 * 1024);
    this.idFactory = options.idFactory ?? makeDefaultId;
  }

  async start(actor: PreviewActor, request: StartPreviewRequest): Promise<PreviewSession> {
    if (!actor || typeof actor.userId !== "string" || !actor.userId.trim()) {
      throw new PreviewServerError("An authenticated actor is required.", "INVALID_INPUT");
    }
    const projectId = safeProjectId(request.projectId);
    if (request.framework !== "react-vite" && request.framework !== "nextjs") {
      throw new PreviewServerError("Unsupported preview framework.", "INVALID_INPUT");
    }
    const files = validateFiles(request.files, this.maxFiles, this.maxTotalBytes);
    const now = Date.now();
    const sessionId = this.idFactory();

    this.sessions.create({
      id: sessionId,
      projectId,
      ownerId: actor.userId,
      framework: request.framework,
      status: "starting",
      version: 1,
      createdAt: now,
      updatedAt: now
    });

    const input: PreviewStartInput = {
      sessionId,
      projectId,
      framework: request.framework,
      version: 1,
      files
    };

    let adapterStarted = false;
    try {
      const result = await this.adapter.start(input);
      adapterStarted = true;
      const previewUrl = this.validatePreviewUrl(result.url);
      const ready = this.sessions.update(sessionId, {
        status: "ready",
        previewUrl,
        updatedAt: Date.now(),
        lastHeartbeatAt: Date.now()
      });
      this.hotReload.publish({
        sessionId,
        type: "session-ready",
        version: ready.version,
        timestamp: Date.now(),
        payload: { previewUrl }
      });
      return ready;
    } catch (error) {
      if (adapterStarted) {
        try {
          await this.adapter.stop(sessionId);
        } catch {
          // Preserve the original startup failure. Adapter cleanup is best-effort.
        }
      }
      this.sessions.setStatus(sessionId, "failed");
      if (error instanceof PreviewServerError) throw error;
      throw new PreviewServerError(
        error instanceof Error ? error.message : "Preview adapter failed to start.",
        "ADAPTER_ERROR"
      );
    }
  }

  async update(actor: PreviewActor, sessionId: string, request: UpdatePreviewRequest): Promise<PreviewSession> {
    const session = this.sessions.getOwned(sessionId, actor);
    if (session.status === "stopped" || session.status === "failed" || session.status === "starting") {
      throw new PreviewSessionError("This preview session cannot be updated in its current state.", "CONFLICT");
    }

    const files = validateFiles(request.files, this.maxFiles, this.maxTotalBytes);
    const filePaths = new Set(files.map((file) => file.path));
    if (!Array.isArray(request.changedPaths)) {
      throw new PreviewServerError("changedPaths must be an array.", "INVALID_INPUT");
    }
    const changedPaths = [...new Set(request.changedPaths)];
    if (
      changedPaths.length === 0 ||
      changedPaths.some((path) => typeof path !== "string" || !filePaths.has(path) || path.startsWith("/") || path.split("/").includes(".."))
    ) {
      throw new PreviewServerError("changedPaths must reference files in the submitted file set.", "INVALID_INPUT");
    }

    const nextVersion = session.version + 1;
    try {
      await this.adapter.update({
        sessionId,
        projectId: session.projectId,
        framework: session.framework,
        version: nextVersion,
        files,
        changedPaths
      });
    } catch (error) {
      this.sessions.update(sessionId, { status: "degraded", updatedAt: Date.now() });
      throw new PreviewServerError(
        error instanceof Error ? error.message : "Preview update failed.",
        "ADAPTER_ERROR"
      );
    }

    const updated = this.sessions.update(sessionId, {
      status: "ready",
      version: nextVersion,
      updatedAt: Date.now()
    });
    this.hotReload.publishFilesUpdated({
      sessionId,
      version: updated.version,
      changedPaths
    });
    return updated;
  }

  async stop(actor: PreviewActor, sessionId: string): Promise<PreviewSession> {
    const session = this.sessions.getOwned(sessionId, actor);
    if (session.status !== "stopped") {
      try {
        await this.adapter.stop(sessionId);
      } catch (error) {
        throw new PreviewServerError(
          error instanceof Error ? error.message : "Preview adapter failed to stop.",
          "ADAPTER_ERROR"
        );
      }
    }

    const stopped = this.sessions.setStatus(sessionId, "stopped");
    this.hotReload.publish({
      sessionId,
      type: "session-stopped",
      version: stopped.version,
      timestamp: Date.now()
    });
    this.hotReload.removeSession(sessionId);
    this.monitor.forget(sessionId);
    this.errors.clearSession(sessionId);
    return stopped;
  }

  getSession(actor: PreviewActor, sessionId: string): PreviewSession {
    return this.sessions.getOwned(sessionId, actor);
  }

  listSessions(actor: PreviewActor): PreviewSession[] {
    return this.sessions.listOwned(actor);
  }

  subscribe(actor: PreviewActor, sessionId: string, listener: (event: PreviewEvent) => void): () => void {
    this.sessions.getOwned(sessionId, actor);
    return this.hotReload.subscribe(sessionId, listener);
  }

  async checkHealth(actor: PreviewActor, sessionId: string): Promise<PreviewHealth> {
    const session = this.sessions.getOwned(sessionId, actor);
    if (session.status === "stopped" || session.status === "failed") {
      throw new PreviewSessionError("A stopped or failed preview has no live health state.", "CONFLICT");
    }

    let health: PreviewHealth;
    try {
      health = await this.adapter.health(sessionId);
    } catch (error) {
      health = {
        healthy: false,
        checkedAt: Date.now(),
        message: error instanceof Error ? error.message : "Health probe failed."
      };
    }

    const snapshot = this.monitor.record(sessionId, health);
    this.sessions.update(sessionId, {
      status: snapshot.degraded ? "degraded" : "ready",
      updatedAt: Date.now(),
      lastHeartbeatAt: health.checkedAt
    });
    this.hotReload.publish({
      sessionId,
      type: "runtime-health",
      version: session.version,
      timestamp: health.checkedAt,
      payload: {
        healthy: health.healthy,
        degraded: snapshot.degraded,
        consecutiveFailures: snapshot.consecutiveFailures,
        message: health.message
      }
    });
    return { ...health };
  }

  reportError(actor: PreviewActor, sessionId: string, input: PreviewErrorInput) {
    const session = this.sessions.getOwned(sessionId, actor);
    const report = this.errors.report(session, input);
    this.hotReload.publish({
      sessionId,
      type: "runtime-error",
      version: session.version,
      timestamp: report.timestamp,
      payload: {
        id: report.id,
        name: report.name,
        message: report.message,
        source: report.source,
        fingerprint: report.fingerprint,
        count: report.count
      }
    });
    return report;
  }

  listErrors(actor: PreviewActor, sessionId: string) {
    this.sessions.getOwned(sessionId, actor);
    return this.errors.listForSession(sessionId);
  }

  private validatePreviewUrl(rawUrl: string): string {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new PreviewServerError("Preview adapter returned an invalid URL.", "UNSAFE_PREVIEW_URL");
    }

    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.username.length > 0 ||
      parsed.password.length > 0
    ) {
      throw new PreviewServerError("Preview URL must use HTTP(S) and must not include credentials.", "UNSAFE_PREVIEW_URL");
    }

    const originAllowed = this.allowedPreviewOrigins.has(parsed.origin);
    const localHostAllowed = this.allowedPreviewOrigins.size === 0 && this.allowedPreviewHosts.has(parsed.hostname);
    if (!originAllowed && !localHostAllowed) {
      throw new PreviewServerError(
        "Preview URL origin is not allowlisted. Configure allowedPreviewOrigins for hosted previews.",
        "UNSAFE_PREVIEW_URL"
      );
    }

    return parsed.toString();
  }
}
