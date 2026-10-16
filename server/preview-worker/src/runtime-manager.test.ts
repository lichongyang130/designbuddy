import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DockerRuntime } from "./docker-runtime";
import { RuntimeManager } from "./runtime-manager";
import type {
  WorkerConfig,
  WorkerFile,
  WorkerFramework
} from "./types";

class FakeDockerRuntime extends DockerRuntime {
  constructor(config: WorkerConfig, private readonly testWorkspaceRoot: string) {
    super(config);
  }

  override workspacePath(sessionId: string): string {
    return join(this.testWorkspaceRoot, "worker-test", sessionId);
  }

  override containerName(sessionId: string): string {
    return "fake-preview-" + sessionId;
  }

  override async writeWorkspace(sessionId: string, _framework: WorkerFramework, _files: WorkerFile[]): Promise<string> {
    return this.workspacePath(sessionId);
  }

  override async start(sessionId: string, _framework: WorkerFramework, _workspace: string, _port: number): Promise<string> {
    return this.containerName(sessionId);
  }

  override async stop(_containerName: string): Promise<void> {}

  override async isRunning(_containerName: string): Promise<boolean> {
    return true;
  }

  override async portIsHealthy(_port: number, _framework: WorkerFramework, _sessionId: string): Promise<boolean> {
    return true;
  }

  override async logs(_containerName: string): Promise<string> {
    return "";
  }

  override async stats(_containerName: string): Promise<{ cpuPercent?: number; memoryBytes?: number }> {
    return { cpuPercent: 1, memoryBytes: 1024 };
  }

  override async cleanupOrphans(): Promise<number> {
    return 0;
  }
}

async function createHarness(maxSessions = 2) {
  const root = await mkdtemp(join(tmpdir(), "designbuddy-preview-worker-"));
  const config: WorkerConfig = {
    token: "t".repeat(48),
    workerId: "worker-test",
    publicPreviewOrigin: "http://localhost:8080",
    workspaceRoot: root,
    hostPortStart: 49100,
    hostPortEnd: 49130,
    previewBindHost: "127.0.0.1",
    previewUpstreamHost: "127.0.0.1",
    memoryLimit: "512m",
    cpuLimit: "1",
    pidsLimit: 128,
    maxSessions,
    maxFiles: 10,
    maxTotalBytes: 1024 * 1024,
    startupTimeoutMs: 1000,
    sessionTtlMs: 7200000,
    port: 8080,
    host: "127.0.0.1"
  };
  const runtime = new FakeDockerRuntime(config, root);
  const manager = new RuntimeManager(config, runtime);
  return {
    root,
    manager,
    cleanup: () => rm(root, { recursive: true, force: true })
  };
}

function sampleFiles(): WorkerFile[] {
  return [
    { path: "package.json", content: JSON.stringify({ name: "preview-test" }) },
    { path: "index.html", content: "<!doctype html><title>preview</title>" }
  ];
}

test("creates, reports and stops a preview session", async (t) => {
  const harness = await createHarness();
  t.after(harness.cleanup);

  const result = await harness.manager.start({
    sessionId: "session_1",
    projectId: "project_1",
    framework: "react-vite",
    version: 1,
    files: sampleFiles()
  });

  assert.equal(result.url, "http://localhost:8080/p/session_1/");
  assert.equal(harness.manager.get("session_1")?.version, 1);

  const health = await harness.manager.health("session_1");
  assert.equal(health.healthy, true);
  assert.equal(health.cpuPercent, 1);

  await harness.manager.stop("session_1");
  assert.equal(harness.manager.get("session_1"), undefined);
});

test("rejects unsafe source paths before allocating a preview", async (t) => {
  const harness = await createHarness();
  t.after(harness.cleanup);

  await assert.rejects(
    harness.manager.start({
      sessionId: "session_unsafe",
      projectId: "project_1",
      framework: "react-vite",
      version: 1,
      files: [
        ...sampleFiles(),
        { path: "../secrets.txt", content: "not allowed" }
      ]
    }),
    (error: unknown) => {
      assert.equal((error as { code?: string }).code, "UNSAFE_FILE_PATH");
      return true;
    }
  );
});

test("enforces the active preview session limit", async (t) => {
  const harness = await createHarness(1);
  t.after(harness.cleanup);

  await harness.manager.start({
    sessionId: "session_first",
    projectId: "project_1",
    framework: "react-vite",
    version: 1,
    files: sampleFiles()
  });

  await assert.rejects(
    harness.manager.start({
      sessionId: "session_second",
      projectId: "project_1",
      framework: "react-vite",
      version: 1,
      files: sampleFiles()
    }),
    (error: unknown) => {
      assert.equal((error as { code?: string }).code, "WORKER_CAPACITY_EXCEEDED");
      return true;
    }
  );

  await harness.manager.stop("session_first");
});
