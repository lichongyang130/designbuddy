import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { createPreviewWorkerServer } from "./server";
import type { WorkerConfig } from "./types";

test("worker exposes liveness health and protects management endpoints", async (t) => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "designbuddy-worker-http-"));
  const config: WorkerConfig = {
    token: "t".repeat(48),
    workerId: "worker-http-test",
    publicPreviewOrigin: "http://127.0.0.1",
    workspaceRoot,
    hostPortStart: 49200,
    hostPortEnd: 49219,
    previewBindHost: "127.0.0.1",
    previewUpstreamHost: "127.0.0.1",
    memoryLimit: "512m",
    cpuLimit: "1",
    pidsLimit: 128,
    maxSessions: 2,
    maxFiles: 10,
    maxTotalBytes: 1024 * 1024,
    startupTimeoutMs: 1000,
    sessionTtlMs: 60000,
    port: 0,
    host: "127.0.0.1"
  };
  const worker = createPreviewWorkerServer(config);

  t.after(async () => {
    await worker.close().catch(() => undefined);
    await worker.manager.stopAll().catch(() => undefined);
    await rm(workspaceRoot, { recursive: true, force: true }).catch(() => undefined);
  });

  await worker.listen();
  const address = worker.server.address() as AddressInfo | null;
  assert.ok(address && typeof address.port === "number");
  const origin = "http://127.0.0.1:" + address.port;

  const health = await fetch(origin + "/healthz");
  assert.equal(health.status, 200);
  const healthBody = await health.json() as { status?: string; activeSessions?: number };
  assert.equal(healthBody.status, "ok");
  assert.equal(healthBody.activeSessions, 0);

  const denied = await fetch(origin + "/sessions", {
    headers: { Authorization: "Bearer invalid" }
  });
  assert.equal(denied.status, 401);
  const deniedBody = await denied.json() as { error?: string };
  assert.equal(deniedBody.error, "UNAUTHORIZED");

  const missingToken = await fetch(origin + "/sessions");
  assert.equal(missingToken.status, 401);
});
