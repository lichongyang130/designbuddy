import type {
  PreviewAdapter,
  PreviewHealth,
  PreviewStartInput,
  PreviewUpdateInput
} from "./preview-types";

export interface HttpPreviewAdapterOptions {
  baseUrl: string;
  token: string;
  requestTimeoutMs?: number;
  operationTimeoutMs?: number;
  fetchImpl?: typeof fetch;
}

interface RuntimeApiError {
  message?: string;
  error?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class PreviewRuntimeAdapterError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "PreviewRuntimeAdapterError";
  }
}

/**
 * HTTP adapter for a separate, isolated preview worker.
 *
 * The worker must implement POST /sessions, PUT /sessions/:id/files,
 * DELETE /sessions/:id, and GET /sessions/:id/health. Keep this worker
 * separate from the trusted API process because it executes generated code.
 */
export class HttpPreviewAdapter implements PreviewAdapter {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly timeoutMs: number;
  private readonly operationTimeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HttpPreviewAdapterOptions) {
    let url: URL;
    try {
      url = new URL(options.baseUrl);
    } catch {
      throw new Error("Preview runtime baseUrl must be an absolute URL.");
    }

    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (!["http:", "https:"].includes(url.protocol) || (!local && url.protocol !== "https:")) {
      throw new Error("Preview runtime must use HTTPS unless it is running on loopback.");
    }
    if (url.username || url.password || url.search || url.hash) {
      throw new Error("Preview runtime baseUrl must not include credentials, query, or fragment.");
    }
    if (!options.token || !options.token.trim()) {
      throw new Error("A private preview runtime token is required.");
    }

    this.baseUrl = url.toString().replace(/\/+$/, "");
    this.token = options.token;
    this.timeoutMs = Math.max(1000, options.requestTimeoutMs ?? 15000);
    // npm install and a production build can take several minutes on a cold worker.
    this.operationTimeoutMs = Math.max(this.timeoutMs, options.operationTimeoutMs ?? 480000);
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async start(input: PreviewStartInput): Promise<{ url: string }> {
    const body = await this.request("POST", "/sessions", input, this.operationTimeoutMs);
    const nested = isRecord(body) && isRecord(body.session) ? body.session : body;
    if (!isRecord(nested) || typeof nested.url !== "string" || !nested.url.trim()) {
      throw new PreviewRuntimeAdapterError("Preview worker response did not contain a preview URL.");
    }
    return { url: nested.url };
  }

  async update(input: PreviewUpdateInput): Promise<void> {
    await this.request(
      "PUT",
      "/sessions/" + encodeURIComponent(input.sessionId) + "/files",
      {
        projectId: input.projectId,
        framework: input.framework,
        version: input.version,
        files: input.files,
        changedPaths: input.changedPaths
      },
      this.operationTimeoutMs
    );
  }

  async stop(sessionId: string): Promise<void> {
    await this.request("DELETE", "/sessions/" + encodeURIComponent(sessionId));
  }

  async health(sessionId: string): Promise<PreviewHealth> {
    const body = await this.request("GET", "/sessions/" + encodeURIComponent(sessionId) + "/health");
    const nested = isRecord(body) && isRecord(body.health) ? body.health : body;
    if (!isRecord(nested) || typeof nested.healthy !== "boolean") {
      throw new PreviewRuntimeAdapterError("Preview worker returned an invalid health response.");
    }

    return {
      healthy: nested.healthy,
      checkedAt: typeof nested.checkedAt === "number" ? nested.checkedAt : Date.now(),
      ...(typeof nested.message === "string" ? { message: nested.message.slice(0, 500) } : {}),
      ...(typeof nested.cpuPercent === "number" ? { cpuPercent: nested.cpuPercent } : {}),
      ...(typeof nested.memoryBytes === "number" ? { memoryBytes: nested.memoryBytes } : {})
    };
  }

  private async request(method: string, path: string, body?: unknown, timeoutMs = this.timeoutMs): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await this.fetchImpl(this.baseUrl + path, {
        method,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          Authorization: "Bearer " + this.token,
          ...(body === undefined ? {} : { "Content-Type": "application/json" })
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      });

      const text = await response.text();
      let parsed: unknown = {};
      if (text) {
        try {
          parsed = JSON.parse(text) as unknown;
        } catch {
          throw new PreviewRuntimeAdapterError("Preview worker returned invalid JSON.", response.status);
        }
      }

      if (!response.ok) {
        const info = isRecord(parsed) ? parsed as RuntimeApiError : {};
        const message = typeof info.message === "string"
          ? info.message
          : typeof info.error === "string" ? info.error : "Preview worker request failed.";
        throw new PreviewRuntimeAdapterError(message.slice(0, 500), response.status);
      }
      return parsed;
    } catch (error) {
      if (error instanceof PreviewRuntimeAdapterError) throw error;
      if (controller.signal.aborted) {
        throw new PreviewRuntimeAdapterError("Preview worker request timed out.");
      }
      throw new PreviewRuntimeAdapterError(
        error instanceof Error ? error.message.slice(0, 500) : "Unable to reach preview worker."
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
