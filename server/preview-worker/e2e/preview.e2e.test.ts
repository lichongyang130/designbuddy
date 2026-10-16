import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import express from "express";
import { chromium, type Browser } from "playwright";
import { createPreviewService } from "../../preview-api/create-preview-service";
import { createPreviewWorkerServer } from "../src/server";
import type { WorkerConfig } from "../src/types";

const enabled = process.env.PREVIEW_E2E === "1";

function previewProjectFiles() {
  return [
    {
      path: "package.json",
      content: JSON.stringify({
        name: "designbuddy-preview-e2e",
        version: "1.0.0",
        private: true,
        type: "module",
        scripts: {
          build: "vite build",
          start: "vite preview"
        },
        devDependencies: {
          vite: "^6.0.0"
        }
      })
    },
    {
      path: "index.html",
      content: [
        "<!doctype html>",
        '<html lang="en">',
        "<head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"><title>Preview E2E</title></head>",
        '<body><main id="app">Loading preview...</main><script type="module" src="/main.js"></script></body>',
        "</html>"
      ].join("")
    },
    {
      path: "main.js",
      content: 'document.querySelector("#app").textContent = "Preview Worker E2E OK";'
    }
  ];
}

test("API creates a Docker preview that executes in Chromium", {
  skip: enabled ? false : "Set PREVIEW_E2E=1 to run the Docker + Chromium end-to-end test.",
  timeout: 600000
}, async (t) => {
  const token = "designbuddy-preview-e2e-token-" + "x".repeat(32);
  const workerId = ("preview-e2e-" + process.pid + "-" + Date.now().toString(36)).slice(0, 64);
  const workspaceRoot = await mkdtemp(join(tmpdir(), "designbuddy-preview-e2e-"));
  const config: WorkerConfig = {
    token,
    workerId,
    publicPreviewOrigin: "http://127.0.0.1",
    workspaceRoot,
    hostPortStart: 42000,
    hostPortEnd: 42049,
    previewBindHost: "127.0.0.1",
    previewUpstreamHost: "127.0.0.1",
    memoryLimit: "512m",
    cpuLimit: "1",
    pidsLimit: 128,
    maxSessions: 2,
    maxFiles: 30,
    maxTotalBytes: 2 * 1024 * 1024,
    startupTimeoutMs: 300000,
    sessionTtlMs: 600000,
    port: 0,
    host: "127.0.0.1"
  };

  const worker = createPreviewWorkerServer(config);
  let apiService: ReturnType<typeof createPreviewService> | undefined;
  const apiApp = express();
  const apiRouter = express.Router();
  const auth = (request: any, response: any, next: any) => {
    const userId = request.header("x-preview-e2e-user");
    if (!userId) {
      response.status(401).json({ error: "UNAUTHENTICATED", message: "Authentication required." });
      return;
    }
    request.user = { id: userId };
    next();
  };
  apiApp.use(express.json({ limit: "6mb" }));
  let apiListener: ReturnType<typeof apiApp.listen> | undefined;
  let sessionId: string | undefined;
  let browser: Browser | undefined;
  let apiOrigin = "";

  t.after(async () => {
    await browser?.close().catch(() => undefined);
    if (sessionId && apiOrigin && apiListener) {
      await fetch(apiOrigin + "/api/preview/sessions/" + encodeURIComponent(sessionId), {
        method: "DELETE",
        headers: { "x-preview-e2e-user": "preview-e2e-user" }
      }).catch(() => undefined);
    }
    if (apiListener) {
      await new Promise<void>((resolvePromise) => apiListener!.close(() => resolvePromise()));
    }
    await worker.close().catch(() => undefined);
    await worker.manager.stopAll().catch(() => undefined);
    await worker.manager.cleanupOrphans().catch(() => undefined);
    await rm(workspaceRoot, { recursive: true, force: true }).catch(() => undefined);
  });

  await worker.listen();
  const workerAddress = worker.server.address() as AddressInfo | null;
  assert.ok(workerAddress && typeof workerAddress.port === "number");
  const workerOrigin = "http://127.0.0.1:" + workerAddress.port;
  config.publicPreviewOrigin = workerOrigin;
  apiService = createPreviewService({
    runtimeBaseUrl: workerOrigin,
    runtimeToken: token,
    allowedPreviewOrigins: [workerOrigin],
    requestTimeoutMs: 15000,
    operationTimeoutMs: 480000
  });
  apiService.mount(apiRouter as any, auth);
  apiApp.use("/api/preview", apiRouter);
  apiListener = apiApp.listen(0, "127.0.0.1");
  await once(apiListener, "listening");
  const apiAddress = apiListener.address() as AddressInfo | null;
  assert.ok(apiAddress && typeof apiAddress.port === "number");
  apiOrigin = "http://127.0.0.1:" + apiAddress.port;

  const denied = await fetch(apiOrigin + "/api/preview/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId: "e2e-project",
      framework: "react-vite",
      files: previewProjectFiles()
    })
  });
  assert.equal(denied.status, 401, "API must reject unauthenticated session creation");

  await worker.manager.cleanupOrphans();
  const created = await fetch(apiOrigin + "/api/preview/sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-preview-e2e-user": "preview-e2e-user"
    },
    body: JSON.stringify({
      projectId: "e2e-project",
      framework: "react-vite",
      files: previewProjectFiles()
    })
  });
  const createdBody = await created.json() as {
    session?: { id?: string; status?: string; previewUrl?: string };
    error?: string;
    message?: string;
  };
  assert.equal(created.status, 201, "API should create a preview session: " + JSON.stringify(createdBody));
  assert.equal(typeof createdBody.session?.id, "string");
  sessionId = createdBody.session?.id;
  assert.equal(createdBody.session?.status, "ready");

  const previewUrl = createdBody.session?.previewUrl;
  assert.equal(typeof previewUrl, "string");
  assert.ok(previewUrl?.startsWith(workerOrigin + "/p/"), "Worker should allocate a public preview path");

  // This is a real Chromium navigation: scripts and assets must load and execute.
  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  });
  const page = await browser.newPage();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const response = await page.goto(previewUrl!, { waitUntil: "networkidle", timeout: 45000 });
  assert.equal(response?.status(), 200, "Preview URL should respond successfully");
  await page.waitForFunction(
    () => document.querySelector("#app")?.textContent === "Preview Worker E2E OK",
    undefined,
    { timeout: 15000 }
  );
  assert.deepEqual(pageErrors, [], "Generated app should execute without uncaught browser errors");

  const health = await fetch(apiOrigin + "/api/preview/sessions/" + encodeURIComponent(sessionId!) + "/health", {
    headers: { "x-preview-e2e-user": "preview-e2e-user" }
  });
  assert.equal(health.status, 200, "API health route should reach the worker");
  const healthBody = await health.json() as { health?: { healthy?: boolean } };
  assert.equal(healthBody.health?.healthy, true);

  await browser.close();
  browser = undefined;
  const stopped = await fetch(apiOrigin + "/api/preview/sessions/" + encodeURIComponent(sessionId!), {
    method: "DELETE",
    headers: { "x-preview-e2e-user": "preview-e2e-user" }
  });
  assert.equal(stopped.status, 200, "API stop route should stop and clean up the preview");
  sessionId = undefined;
  const afterStop = await fetch(previewUrl!);
  assert.equal(afterStop.status, 404, "Stopped preview URL should no longer resolve to a live session");
});
