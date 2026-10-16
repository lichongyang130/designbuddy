# DesignBuddy Preview Runtime Worker

This is a standalone trusted control-plane process that launches untrusted
generated apps in one short-lived Docker container and Docker bridge network
per preview session.

## What it provides

- Authenticated worker endpoints consumed by `HttpPreviewAdapter`.
- Per-session Docker container and dedicated bridge network.
- CPU, memory, swap, PID, open-file and log-size limits.
- Dropped Linux capabilities, no-new-privileges, read-only container root
  filesystem, non-root application UID, a session-scoped writable workspace, and an individual file-size limit.
- Per-session port allocation, an HTTP reverse proxy, health checks, runtime
  statistics, scheduled session expiration, and cleanup of stale containers,
  networks and workspaces owned by this worker ID.
- Vite base-path support and Next.js basePath generation when no custom
  Next.js config is supplied.

## Linux deployment

1. Install Docker Engine and Docker Compose on a dedicated Linux host.
2. Copy `.env.example` to `.env`. Generate a long random
   `PREVIEW_RUNTIME_TOKEN` and configure the real preview HTTPS origin.
3. Ensure `PREVIEW_WORKSPACE_ROOT` is an absolute host path. The same exact
   path is mounted inside the worker so the Docker daemon can bind-mount the
   generated project files.
4. Start the worker from this directory:

   ```sh
   docker compose --env-file .env up --build -d
   ```

5. Put a TLS reverse proxy in front of `127.0.0.1:8080` for the public preview
   host. Route `/p/*` to the worker and preserve the URL path. Keep worker
   management endpoints private, even though they additionally require the
   bearer token.
6. Configure the API service with `PREVIEW_RUNTIME_URL=http://127.0.0.1:8080`,
   `PREVIEW_RUNTIME_TOKEN` set to the same secret, and
   `PREVIEW_ALLOWED_ORIGINS` including the public preview origin.

The supplied Compose file uses host networking and mounts the Docker daemon
socket. It targets Linux, and the worker is a highly trusted service: access
to the Docker socket is effectively host-administrator access. Run it on a
dedicated host, restrict inbound traffic, and never mount the Docker socket
into generated preview containers.

## Runtime endpoints

- `GET /healthz`: local process health, no bearer token.
- `POST /sessions`: create and build a preview.
- `PUT /sessions/:sessionId/files`: replace project files and restart.
- `DELETE /sessions/:sessionId`: stop and remove a preview.
- `GET /sessions/:sessionId/health`: report HTTP health and Docker statistics.
- `GET /p/:sessionId/*`: public reverse proxy for a registered preview.

Management endpoints require `Authorization: Bearer <PREVIEW_RUNTIME_TOKEN>`.
The token is never sent to preview containers or browsers. Preview URLs are
public bearer-less links; treat the session ID as a shareable capability and
add product-level access controls if previews must be private.

## Security boundary and limitations

Dependency installation lifecycle scripts, the application build and the
start command execute generated project code inside the constrained container.
They never run inside the trusted API or worker Node.js process. Per-session networks isolate preview containers
from one another, but Docker bridge networks normally allow outbound traffic.
For production, use host firewall/egress policy or a dedicated restricted
network to deny access to cloud metadata, private subnets and other sensitive
services.

Do not expose this worker directly to the public internet. The Docker CLI and
workspace mount require the worker and Docker daemon to share the same
absolute filesystem path. Use a unique stable `PREVIEW_WORKER_ID` for each
worker that shares a Docker daemon. On startup the worker removes leftover
containers and networks carrying that worker ID's management labels.

Current session metadata is held in memory. Sessions expire after
`PREVIEW_SESSION_TTL_MS` of inactivity (default two hours). A worker restart
removes that worker's preview containers, networks and workspace files, so
clients should recreate sessions. This is a
single-worker implementation, not a distributed queue. Scale out only after
adding persistent session ownership and coordinated port/network allocation.

Custom `next.config.js/mjs/cjs/ts` is currently rejected because this worker
must configure a session-specific basePath. The API limits the number and total
size of submitted files, but the reverse proxy and host still need rate limits,
TLS, log monitoring and operational alerting.

## Development

```sh
npm install
npm test
PREVIEW_E2E=1 npm run test:e2e # requires Docker and installed Chromium
npm start
```

A Docker daemon, configured environment variables, and an available port range
are required to create a real preview. The presence of this source does not
mean a worker has been deployed or that previews have been end-to-end tested.
