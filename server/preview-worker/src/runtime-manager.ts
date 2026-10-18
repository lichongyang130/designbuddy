import { createServer } from "node:net";
import { request as httpRequest, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdir, rm } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { DockerRuntime, DockerRuntimeError } from "./docker-runtime";
import type {
  StartWorkerSession,
  UpdateWorkerSession,
  WorkerConfig,
  WorkerFramework,
  WorkerHealth,
  WorkerSession
} from "./types";
import { WorkerError } from "./types";

export class RuntimeManager {
  private readonly sessions = new Map<string, WorkerSession>();
  private readonly allocatedPorts = new Set<number>();
  private readonly runtime: DockerRuntime;

  constructor(private readonly config: WorkerConfig, runtime?: DockerRuntime) {
    this.runtime = runtime ?? new DockerRuntime(config);
  }

  async cleanupOrphans(): Promise<number> {
    return this.runtime.cleanupOrphans();
  }

  async start(input: StartWorkerSession): Promise<{ url: string }> {
    this.validateSessionId(input.sessionId);
    if (this.sessions.has(input.sessionId)) {
      throw new WorkerError("Preview session already exists.", 409, "SESSION_EXISTS");
    }
    if (this.sessions.size >= this.config.maxSessions) {
      throw new WorkerError("Preview worker has reached its active session limit.", 429, "WORKER_CAPACITY_EXCEEDED");
    }
    this.validateFramework(input.framework);
    const files = this.validateFiles(input.files);
    const port = await this.allocatePort();
    const workspace = this.runtime.workspacePath(input.sessionId);
    const containerName = this.runtime.containerName(input.sessionId);

    try {
      await mkdir(this.config.workspaceRoot, { recursive: true });
      await this.runtime.writeWorkspace(input.sessionId, input.framework, files);
      await this.runtime.start(input.sessionId, input.framework, workspace, port);

      const deadline = Date.now() + this.config.startupTimeoutMs;
      while (Date.now() < deadline) {
        if (!(await this.runtime.isRunning(containerName))) {
          const logs = await this.runtime.logs(containerName);
          throw new WorkerError(
            logs ? "Preview process exited during startup: " + logs.slice(-1000) : "Preview process exited during startup.",
            502,
            "PREVIEW_STARTUP_FAILED"
          );
        }

        if (await this.runtime.portIsHealthy(port, input.framework, input.sessionId)) {
          const now = Date.now();
          this.sessions.set(input.sessionId, {
            sessionId: input.sessionId,
            projectId: input.projectId,
            framework: input.framework,
            version: input.version,
            port,
            containerName,
            workspace,
            startedAt: now,
            lastHeartbeatAt: now
          });
          return { url: this.previewUrl(input.sessionId) };
        }
        await delay(1000);
      }

      throw new WorkerError("Preview startup timed out.", 504, "PREVIEW_STARTUP_TIMEOUT");
    } catch (error) {
      // Always attempt cleanup: docker run can create a container before a CLI
      // timeout or transport failure is reported to this process.
      await this.runtime.stop(containerName).catch(() => undefined);
      await rm(workspace, { recursive: true, force: true }).catch(() => undefined);
      this.allocatedPorts.delete(port);
      if (error instanceof WorkerError) throw error;
      if (error instanceof DockerRuntimeError) {
        throw new WorkerError(error.message, 502, error.code);
      }
      throw new WorkerError(
        error instanceof Error ? error.message.slice(0, 1000) : "Unable to start preview session.",
        502,
        "PREVIEW_STARTUP_FAILED"
      );
    }
  }

  async update(input: UpdateWorkerSession): Promise<void> {
    const current = this.requireSession(input.sessionId);
    if (input.projectId !== current.projectId) {
      throw new WorkerError("Project ID does not match this session.", 409, "PROJECT_MISMATCH");
    }
    this.validateFramework(input.framework);
    if (input.framework !== current.framework) {
      throw new WorkerError("Framework cannot be changed for an existing preview session.", 409, "FRAMEWORK_MISMATCH");
    }
    if (input.version <= current.version) {
      throw new WorkerError("Update version must be greater than the current version.", 409, "STALE_VERSION");
    }
    const files = this.validateFiles(input.files);
    if (!Array.isArray(input.changedPaths) || input.changedPaths.length === 0) {
      throw new WorkerError("changedPaths must be a non-empty array.", 400, "INVALID_CHANGED_PATHS");
    }
    const paths = new Set(files.map((file) => file.path));
    if (input.changedPaths.some((path) => typeof path !== "string" || !paths.has(path))) {
      throw new WorkerError("changedPaths must reference files in the submitted file set.", 400, "INVALID_CHANGED_PATHS");
    }

    await this.runtime.stop(current.containerName);
    try {
      await this.runtime.writeWorkspace(current.sessionId, current.framework, files);
      await this.runtime.start(current.sessionId, current.framework, current.workspace, current.port);
      const deadline = Date.now() + this.config.startupTimeoutMs;
      while (Date.now() < deadline) {
        if (!(await this.runtime.isRunning(current.containerName))) {
          const logs = await this.runtime.logs(current.containerName);
          throw new WorkerError(
            logs ? "Updated preview process exited: " + logs.slice(-1000) : "Updated preview process exited.",
            502,
            "PREVIEW_UPDATE_FAILED"
          );
        }
        if (await this.runtime.portIsHealthy(current.port, current.framework, current.sessionId)) {
          current.version = input.version;
          current.lastHeartbeatAt = Date.now();
          return;
        }
        await delay(1000);
      }
      throw new WorkerError("Updated preview startup timed out.", 504, "PREVIEW_STARTUP_TIMEOUT");
    } catch (error) {
      await this.runtime.stop(current.containerName).catch(() => undefined);
      if (error instanceof WorkerError) throw error;
      throw new WorkerError(
        error instanceof Error ? error.message.slice(0, 1000) : "Unable to update preview session.",
        502,
        "PREVIEW_UPDATE_FAILED"
      );
    }
  }

  async stop(sessionId: string): Promise<void> {
    const current = this.requireSession(sessionId);
    try {
      await this.runtime.stop(current.containerName);
    } finally {
      this.sessions.delete(sessionId);
      this.allocatedPorts.delete(current.port);
      await rm(current.workspace, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  async stopAll(): Promise<void> {
    await Promise.all([...this.sessions.keys()].map((sessionId) => this.stop(sessionId).catch(() => undefined)));
  }

  async cleanupExpired(): Promise<number> {
    const now = Date.now();
    const expired = [...this.sessions.values()]
      .filter((session) => now - session.lastHeartbeatAt >= this.config.sessionTtlMs)
      .map((session) => session.sessionId);
    await Promise.all(expired.map((sessionId) => this.stop(sessionId).catch(() => undefined)));
    return expired.length;
  }

  async health(sessionId: string): Promise<WorkerHealth> {
    const current = this.requireSession(sessionId);
    const checkedAt = Date.now();
    const running = await this.runtime.isRunning(current.containerName);
    if (!running) {
      return { healthy: false, checkedAt, message: "Preview container is not running." };
    }

    const healthy = await this.runtime.portIsHealthy(current.port, current.framework, sessionId);
    const stats = await this.runtime.stats(current.containerName);
    if (healthy) current.lastHeartbeatAt = checkedAt;
    return {
      healthy,
      checkedAt,
      ...(healthy ? {} : { message: "Preview HTTP health check failed." }),
      ...stats
    };
  }

  get(sessionId: string): WorkerSession | undefined {
    const session = this.sessions.get(sessionId);
    return session ? { ...session } : undefined;
  }

  list(): WorkerSession[] {
    return [...this.sessions.values()].map((session) => ({ ...session }));
  }

  proxyRequest(
    sessionId: string,
    incomingPath: string,
    request: IncomingMessage,
    response: ServerResponse
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Preview not found");
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(incomingPath, "http://preview.local");
    } catch {
      response.writeHead(400);
      response.end("Invalid preview path");
      return;
    }
    if (parsed.pathname.split("/").includes("..") || parsed.pathname.includes("\\")) {
      response.writeHead(400);
      response.end("Invalid preview path");
      return;
    }

    // Preserve /p/<sessionId>/ so the framework's configured basePath works.
    // For root-absolute resources, forward the original resource path selected
    // by the referer fallback in server.ts.
    session.lastHeartbeatAt = Date.now();
    const target = httpRequest({
      hostname: this.config.previewUpstreamHost,
      port: session.port,
      method: request.method,
      path: parsed.pathname + parsed.search,
      headers: {
        ...request.headers,
        host: this.config.previewUpstreamHost + ":" + session.port,
        "x-forwarded-host": request.headers.host ?? "",
        "x-forwarded-proto": this.config.publicPreviewOrigin.startsWith("https:") ? "https" : "http"
      },
      timeout: 15000
    }, (upstream) => {
      const headers = { ...upstream.headers };
      headers["referrer-policy"] = "strict-origin-when-cross-origin";
      delete headers["connection"];
      delete headers["transfer-encoding"];
      response.writeHead(upstream.statusCode ?? 502, headers);
      upstream.pipe(response);
    });

    target.on("timeout", () => target.destroy(new Error("Preview request timed out.")));
    target.on("error", () => {
      if (!response.headersSent) response.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Preview runtime is unavailable.");
    });
    request.pipe(target);
  }

  resolveByReferer(referer: string | undefined): { sessionId: string } | undefined {
    if (!referer) return undefined;
    try {
      const url = new URL(referer);
      if (url.origin !== this.config.publicPreviewOrigin) return undefined;
      const match = url.pathname.match(/^\/p\/([A-Za-z0-9_-]{1,128})(?:\/|$)/);
      if (!match || !this.sessions.has(match[1])) return undefined;
      return { sessionId: match[1] };
    } catch {
      return undefined;
    }
  }

  private previewUrl(sessionId: string): string {
    return this.config.publicPreviewOrigin + "/p/" + encodeURIComponent(sessionId) + "/";
  }

  private validateSessionId(sessionId: string): void {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(sessionId)) {
      throw new WorkerError("Invalid preview session ID.", 400, "INVALID_SESSION_ID");
    }
  }

  private requireSession(sessionId: string): WorkerSession {
    this.validateSessionId(sessionId);
    const session = this.sessions.get(sessionId);
    if (!session) throw new WorkerError("Preview session was not found.", 404, "SESSION_NOT_FOUND");
    return session;
  }

  private validateFramework(framework: WorkerFramework): void {
    if (framework !== "react-vite" && framework !== "nextjs") {
      throw new WorkerError("Unsupported preview framework.", 400, "UNSUPPORTED_FRAMEWORK");
    }
  }

  private validateFiles(files: unknown): UpdateWorkerSession["files"] {
    if (!Array.isArray(files) || files.length === 0 || files.length > this.config.maxFiles) {
      throw new WorkerError("files must be a non-empty array within the configured file count limit.", 400, "INVALID_FILES");
    }
    const seen = new Set<string>();
    let totalBytes = 0;
    return files.map((file: unknown) => {
      if (!file || typeof file !== "object" || !("path" in file) || !("content" in file)) {
        throw new WorkerError("Each file requires path and content strings.", 400, "INVALID_FILE");
      }
      const path = (file as { path: unknown }).path;
      const content = (file as { content: unknown }).content;
      if (typeof path !== "string" || typeof content !== "string") {
        throw new WorkerError("Each file requires path and content strings.", 400, "INVALID_FILE");
      }
      const normalized = path.trim();
      const segments = normalized.split("/");
      if (
        !normalized ||
        normalized.startsWith("/") ||
        normalized.includes("\\") ||
        normalized.includes("\u0000") ||
        segments.some((segment) => segment === "." || segment === ".." || segment === "") ||
        /^([A-Za-z]:)/.test(normalized) ||
        /(^|\/)\.env(?:\.|$)/i.test(normalized) ||
        /(^|\/)(?:id_rsa|id_ed25519|\.npmrc|\.gitconfig)$/i.test(normalized)
      ) {
        throw new WorkerError("Unsafe preview file path.", 400, "UNSAFE_FILE_PATH");
      }
      if (seen.has(normalized)) throw new WorkerError("Duplicate preview file path.", 400, "DUPLICATE_FILE_PATH");
      seen.add(normalized);
      totalBytes += Buffer.byteLength(content, "utf8");
      if (totalBytes > this.config.maxTotalBytes) {
        throw new WorkerError("Preview files exceed the configured size limit.", 413, "FILES_TOO_LARGE");
      }
      return { path: normalized, content };
    });
  }

  private async allocatePort(): Promise<number> {
    for (let port = this.config.hostPortStart; port <= this.config.hostPortEnd; port += 1) {
      if (this.allocatedPorts.has(port)) continue;
      const available = await new Promise<boolean>((resolvePromise) => {
        const server = createServer();
        server.once("error", () => resolvePromise(false));
        server.listen(port, this.config.previewBindHost, () => {
          server.close(() => resolvePromise(true));
        });
      });
      if (available) {
        this.allocatedPorts.add(port);
        return port;
      }
    }
    throw new WorkerError("No preview ports are available.", 429, "PORT_POOL_EXHAUSTED");
  }
}
