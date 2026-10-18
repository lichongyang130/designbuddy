import { PreviewApiController } from "./controller";

export interface PreviewRequestLike {
  params: Record<string, string | undefined>;
  body?: unknown;
  user?: { id: string; roles?: string[] };
}

export interface PreviewResponseLike {
  status(code: number): PreviewResponseLike;
  json(body: unknown): unknown;
  setHeader(name: string, value: string): unknown;
  write(chunk: string): unknown;
  end(): unknown;
  flushHeaders?(): unknown;
  on?(event: "close", listener: () => void): unknown;
  writableEnded?: boolean;
  headersSent?: boolean;
}

export type PreviewNext = (error?: unknown) => void;
export type PreviewHandler = (
  request: PreviewRequestLike,
  response: PreviewResponseLike,
  next: PreviewNext
) => unknown;

/**
 * Structural router contract to avoid hard-coupling this package to Express.
 * Express Router instances can be passed directly; provide a real auth
 * middleware that sets req.user before any handler is called.
 */
export interface PreviewRouterLike {
  get(path: string, ...handlers: any[]): unknown;
  post(path: string, ...handlers: any[]): unknown;
  put(path: string, ...handlers: any[]): unknown;
  delete(path: string, ...handlers: any[]): unknown;
}

function sendResult(
  response: PreviewResponseLike,
  result: { status: number; body: unknown }
): void {
  response.status(result.status).json(result.body);
}

function handler(
  task: (request: PreviewRequestLike, response: PreviewResponseLike) => Promise<void> | void
): PreviewHandler {
  return (request, response, next) => {
    Promise.resolve(task(request, response)).catch(next);
  };
}

function sessionId(request: PreviewRequestLike): string {
  return request.params.sessionId ?? "";
}

function sendSse(response: PreviewResponseLike, event: {
  sessionId: string;
  type: string;
  version: number;
  timestamp: number;
  payload?: Record<string, unknown>;
}): void {
  if (response.writableEnded) return;
  response.write("event: " + event.type + "\n");
  response.write("id: " + event.sessionId + ":" + event.version + ":" + event.timestamp + "\n");
  response.write("data: " + JSON.stringify(event) + "\n\n");
}

/**
 * Mount at /api/preview to match the web application's default apiBase.
 *
 * Required paths:
 * GET    /sessions
 * POST   /sessions
 * GET    /sessions/:sessionId
 * PUT    /sessions/:sessionId/files
 * DELETE /sessions/:sessionId
 * GET    /sessions/:sessionId/health
 * GET    /sessions/:sessionId/errors
 * POST   /sessions/:sessionId/errors
 * GET    /sessions/:sessionId/events   (SSE)
 */
export function registerPreviewRoutes(
  router: PreviewRouterLike,
  controller: PreviewApiController,
  requireAuth: PreviewHandler
): void {
  router.get("/sessions", requireAuth, handler(async (request, response) => {
    sendResult(response, await controller.list(request.user));
  }));

  router.post("/sessions", requireAuth, handler(async (request, response) => {
    sendResult(response, await controller.create(request.user, request.body));
  }));

  router.get("/sessions/:sessionId", requireAuth, handler(async (request, response) => {
    sendResult(response, await controller.get(request.user, sessionId(request)));
  }));

  router.put("/sessions/:sessionId/files", requireAuth, handler(async (request, response) => {
    sendResult(response, await controller.update(request.user, sessionId(request), request.body));
  }));

  router.delete("/sessions/:sessionId", requireAuth, handler(async (request, response) => {
    sendResult(response, await controller.stop(request.user, sessionId(request)));
  }));

  router.get("/sessions/:sessionId/health", requireAuth, handler(async (request, response) => {
    sendResult(response, await controller.health(request.user, sessionId(request)));
  }));

  router.get("/sessions/:sessionId/errors", requireAuth, handler(async (request, response) => {
    sendResult(response, await controller.listErrors(request.user, sessionId(request)));
  }));

  router.post("/sessions/:sessionId/errors", requireAuth, handler(async (request, response) => {
    sendResult(response, await controller.reportError(request.user, sessionId(request), request.body));
  }));

  router.get("/sessions/:sessionId/events", requireAuth, handler((request, response) => {
    try {
      // Ownership is checked by controller.subscribe before SSE headers are sent.
      const unsubscribe = controller.subscribe(request.user, sessionId(request), (event) => {
        sendSse(response, event);
      });

      response.status(200);
      response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      response.setHeader("Cache-Control", "no-cache, no-transform");
      response.setHeader("Connection", "keep-alive");
      response.setHeader("X-Accel-Buffering", "no");
      response.flushHeaders?.();
      response.write("retry: 3000\n\n");

      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
      };
      response.on?.("close", close);
    } catch (error) {
      const result = controller.toHttpError(error);
      if (!response.headersSent) {
        sendResult(response, result);
      } else {
        response.end();
      }
    }
  }));
}
