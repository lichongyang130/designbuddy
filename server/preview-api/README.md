# Preview API Integration

This module connects the browser preview UI to the trusted preview API service.
It does not execute generated project source inside the API server.

## Mounting

Mount `registerPreviewRoutes` at `/api/preview` to match the default
`apiBase` in `apps/web/src/features/preview/usePreviewSession.ts`.

Example (Express-style integration; adapt `req.user` to the application's
existing authentication system):

```ts
import express from "express";
import { createPreviewService } from "./create-preview-service";

const app = express();
const router = express.Router();

app.use(express.json({ limit: "6mb" }));

const auth = (req, res, next) => {
  if (!req.user?.id) {
    return res.status(401).json({
      error: "UNAUTHENTICATED",
      message: "Authentication is required."
    });
  }
  next();
};

const previewService = createPreviewService({
  runtimeBaseUrl: process.env.PREVIEW_RUNTIME_URL!,
  runtimeToken: process.env.PREVIEW_RUNTIME_TOKEN!,
  allowedPreviewOrigins: (process.env.PREVIEW_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
});

previewService.mount(router, auth);
app.use("/api/preview", router);
```

Configure the route's authentication middleware to set a trusted `req.user.id`
and optional `req.user.roles`. Do not derive the actor identity from a request
body or query parameter. Configure CSRF protection as appropriate when browser
authentication uses cookies.

## API routes

- `GET /sessions`
- `POST /sessions`
- `GET /sessions/:sessionId`
- `PUT /sessions/:sessionId/files`
- `DELETE /sessions/:sessionId`
- `GET /sessions/:sessionId/health`
- `GET /sessions/:sessionId/errors`
- `POST /sessions/:sessionId/errors`
- `GET /sessions/:sessionId/events` (Server-Sent Events)

All routes require authentication and enforce session ownership in the
controller/service layer. The events endpoint emits named SSE events matching
the event types consumed by the web client.

## Preview runtime worker contract

Deploy the preview worker as a separate service/container with its own
filesystem, process, network, resource and lifetime restrictions. The worker
must verify the private bearer token and implement:

- `POST /sessions`: accepts sessionId, projectId, framework, version and files; responds with `{ "url": "https://preview.example/..." }`.
- `PUT /sessions/:sessionId/files`: accepts the new source files, version and changedPaths; rebuild/reload the preview.
- `DELETE /sessions/:sessionId`: stop and remove the isolated session.
- `GET /sessions/:sessionId/health`: responds with healthy, checkedAt and optional CPU/memory details.

The API service validates the returned preview origin against
`PREVIEW_ALLOWED_ORIGINS` (local loopback origins are permitted only when no
hosted origins are configured). Use HTTPS for remote workers and preview URLs.
Keep `PREVIEW_RUNTIME_TOKEN` server-side; it must never be sent to the browser.
The adapter uses a long operation timeout (eight minutes by default) for
create/update because package installation and builds are not instantaneous.
Ensure any API gateway and reverse proxy in front of the API allows the same
request duration, or change `operationTimeoutMs` when creating the preview service.

## Notes

- The current session store and hot-reload hub are process-local. For multiple
  API replicas or durable sessions, replace them with shared storage and a
  cross-process event transport such as Redis Pub/Sub.
- Configure rate limits and request-size limits at the API gateway.
- The isolated worker source and Linux deployment example live in
  `server/preview-worker`. Deploy and configure that service before preview
  starts can succeed; committing the source does not deploy a runtime.
