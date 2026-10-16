import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { hasValidBearerToken, isSafeSessionId } from "./security";
import { RuntimeManager } from "./runtime-manager";
import type { StartWorkerSession, UpdateWorkerSession, WorkerConfig } from "./types";
import { WorkerError } from "./types";

const JSON_LIMIT = 6 * 1024 * 1024;

function json(response: ServerResponse, status: number, body: unknown): void {
  const content = JSON.stringify(body);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(content),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer"
  });
  response.end(content);
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const declared = Number(request.headers["content-length"] ?? 0);
  if (Number.isFinite(declared) && declared > JSON_LIMIT) {
    throw new WorkerError("Request body is too large.", 413, "BODY_TOO_LARGE");
  }

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const part of request) {
    const chunk = Buffer.isBuffer(part) ? part : Buffer.from(part);
    size += chunk.length;
    if (size > JSON_LIMIT) {
      throw new WorkerError("Request body is too large.", 413, "BODY_TOO_LARGE");
    }
    chunks.push(chunk);
  }

  if (size === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new WorkerError("Request body must be valid JSON.", 400, "INVALID_JSON");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getSessionId(pathname: string): string | undefined {
  const match = pathname.match(/^\/sessions\/([A-Za-z0-9_-]{1,128})(?:\/|$)/);
  return match?.[1];
}

function getPreviewRoute(pathname: string): { sessionId: string } | undefined {
  const match = pathname.match(/^\/p\/([A-Za-z0-9_-]{1,128})(?:\/|$)/);
  return match ? { sessionId: match[1] } : undefined;
}

function isReservedApiPath(pathname: string): boolean {
  return pathname === "/sessions" || pathname.startsWith("/sessions/") || pathname === "/healthz";
}

function safeError(error: unknown): { status: number; body: Record<string, string> } {
  if (error instanceof WorkerError) {
    const expose = error.statusCode < 500;
    return {
      status: error.statusCode,
      body: {
        error: error.code,
        message: expose ? error.message : "Preview runtime operation failed."
      }
    };
  }
  return {
    status: 500,
    body: { error: "INTERNAL_ERROR", message: "An unexpected preview worker error occurred." }
  };
}

function sendUpstreamError(response: ServerResponse): void {
  if (!response.headersSent) {
    json(response, 502, { error: "PREVIEW_UNAVAILABLE", message: "Preview runtime is unavailable." });
  } else {
    response.end();
  }
}

export function createPreviewWorkerServer(config: WorkerConfig, manager = new RuntimeManager(config)) {
  const server = createServer(async (request, response) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");

    const method = request.method ?? "GET";
    const requestUrl = new URL(request.url ?? "/", "http://preview-worker.local");
    const pathname = requestUrl.pathname;

    if (method === "GET" && pathname === "/healthz") {
      json(response, 200, { status: "ok", activeSessions: manager.list().length, checkedAt: Date.now() });
      return;
    }

    // Public preview traffic is forwarded only to a registered session. No
    // arbitrary host or port can be selected by the requester.
    const previewRoute = getPreviewRoute(pathname);
    if (previewRoute && (method === "GET" || method === "HEAD" || method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE" || method === "OPTIONS")) {
      manager.proxyRequest(previewRoute.sessionId, request.url ?? "/", request, response);
      return;
    }

    // Static files with root-absolute URLs can use the document's preview
    // referer. Restrict this fallback to asset-like paths and never proxy worker
    // management endpoints based on a caller-controlled referer.
    if (!isReservedApiPath(pathname) && (/^\/(?:_next|assets|static|images|fonts)(?:\/|$)/.test(pathname) || /^\/(?:favicon\.ico|robots\.txt|[^/]+\.(?:svg|png|jpe?g|gif|webp|ico|woff2?|ttf|css|js|map))$/i.test(pathname))) {
      const resolved = manager.resolveByReferer(request.headers.referer);
      if (resolved) {
        const originalUrl = request.url ?? "/";
        const prefixedUrl = "/p/" + resolved.sessionId + (originalUrl.startsWith("/") ? originalUrl : "/" + originalUrl);
        manager.proxyRequest(resolved.sessionId, prefixedUrl, request, response);
        return;
      }
    }

    if (!hasValidBearerToken(request.headers.authorization, config.token)) {
      json(response, 401, { error: "UNAUTHORIZED", message: "A valid worker bearer token is required." });
      return;
    }

    try {
      if (method === "POST" && pathname === "/sessions") {
        const body = await readJson(request);
        if (!isRecord(body)) throw new WorkerError("Request body must be an object.", 400, "INVALID_INPUT");
        const input = {
          sessionId: body.sessionId,
          projectId: body.projectId,
          framework: body.framework,
          version: body.version,
          files: body.files
        };
        if (
          typeof input.sessionId !== "string" ||
          typeof input.projectId !== "string" ||
          (input.framework !== "react-vite" && input.framework !== "nextjs") ||
          typeof input.version !== "number" ||
          !Number.isSafeInteger(input.version) ||
          input.version < 1 ||
          !Array.isArray(input.files)
        ) {
          throw new WorkerError("Invalid preview session payload.", 400, "INVALID_INPUT");
        }

        const result = await manager.start(input as StartWorkerSession);
        json(response, 201, { url: result.url });
        return;
      }

      const sessionId = getSessionId(pathname);
      if (!sessionId || !isSafeSessionId(sessionId)) {
        json(response, 404, { error: "NOT_FOUND", message: "Worker endpoint was not found." });
        return;
      }

      if (method === "PUT" && pathname === "/sessions/" + sessionId + "/files") {
        const body = await readJson(request);
        if (!isRecord(body)) throw new WorkerError("Request body must be an object.", 400, "INVALID_INPUT");
        if (
          typeof body.projectId !== "string" ||
          (body.framework !== "react-vite" && body.framework !== "nextjs") ||
          typeof body.version !== "number" ||
          !Number.isSafeInteger(body.version) ||
          body.version < 1 ||
          !Array.isArray(body.files) ||
          !Array.isArray(body.changedPaths)
        ) {
          throw new WorkerError("Invalid preview update payload.", 400, "INVALID_INPUT");
        }
        await manager.update({
          sessionId,
          projectId: body.projectId,
          framework: body.framework,
          version: body.version,
          files: body.files,
          changedPaths: body.changedPaths
        } as UpdateWorkerSession);
        json(response, 200, { ok: true, sessionId, version: body.version });
        return;
      }

      if (method === "GET" && pathname === "/sessions/" + sessionId + "/health") {
        json(response, 200, { health: await manager.health(sessionId) });
        return;
      }

      if (method === "DELETE" && pathname === "/sessions/" + sessionId) {
        await manager.stop(sessionId);
        json(response, 200, { ok: true, sessionId });
        return;
      }

      json(response, 404, { error: "NOT_FOUND", message: "Worker endpoint was not found." });
    } catch (error) {
      const normalized = safeError(error);
      json(response, normalized.status, normalized.body);
    }
  });

  const cleanupTimer = setInterval(() => {
    void manager.cleanupExpired().catch(() => undefined);
  }, 60000);
  cleanupTimer.unref();

  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  server.keepAliveTimeout = 5000;

  return {
    server,
    manager,
    listen(): Promise<void> {
      return new Promise((resolvePromise, reject) => {
        server.once("error", reject);
        server.listen(config.port, config.host, () => {
          server.off("error", reject);
          resolvePromise();
        });
      });
    },
    close(): Promise<void> {
      clearInterval(cleanupTimer);
      return new Promise((resolvePromise, reject) => {
        server.close((error) => error ? reject(error) : resolvePromise());
      });
    }
  };
}

export function shouldReportUpstreamError(response: ServerResponse): boolean {
  return !response.writableEnded;
}
