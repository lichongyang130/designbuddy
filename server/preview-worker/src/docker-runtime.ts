import { execFile } from "node:child_process";
import { get as httpGet } from "node:http";
import { promisify } from "node:util";
import { mkdir, writeFile, rm, chmod } from "node:fs/promises";
import { resolve, relative, dirname } from "node:path";
import type { WorkerConfig, WorkerFramework, WorkerFile } from "./types";

const execFileAsync = promisify(execFile);

export interface DockerContainerHandle {
  sessionId: string;
  containerName: string;
  workspace: string;
  port: number;
  framework: WorkerFramework;
}

export class DockerRuntimeError extends Error {
  constructor(message: string, public readonly code: string = "DOCKER_RUNTIME_ERROR") {
    super(message);
    this.name = "DockerRuntimeError";
  }
}

export class DockerRuntime {
  constructor(private readonly config: WorkerConfig) {}

  async writeWorkspace(sessionId: string, framework: WorkerFramework, files: WorkerFile[]): Promise<string> {
    const workspace = this.workspacePath(sessionId);
    await rm(workspace, { recursive: true, force: true });
    await mkdir(workspace, { recursive: true, mode: 0o777 });
    await chmod(workspace, 0o777);

    let packageJson: unknown;
    const packageFile = files.find((file) => file.path === "package.json");
    if (!packageFile) throw new DockerRuntimeError("Preview source must include package.json.", "INVALID_PROJECT");
    try {
      packageJson = JSON.parse(packageFile.content);
    } catch {
      throw new DockerRuntimeError("Preview package.json is not valid JSON.", "INVALID_PROJECT");
    }
    if (!packageJson || typeof packageJson !== "object" || Array.isArray(packageJson)) {
      throw new DockerRuntimeError("Preview package.json must be an object.", "INVALID_PROJECT");
    }
    const scripts = (packageJson as { scripts?: unknown }).scripts;
    if (!scripts || typeof scripts !== "object" || Array.isArray(scripts)) {
      throw new DockerRuntimeError("Preview package.json must define build and start scripts.", "INVALID_PROJECT");
    }
    const scriptMap = scripts as Record<string, unknown>;
    if (typeof scriptMap.build !== "string" || typeof scriptMap.start !== "string") {
      throw new DockerRuntimeError("Preview package.json must define build and start scripts.", "INVALID_PROJECT");
    }

    for (const file of files) {
      const target = resolve(workspace, file.path);
      const rel = relative(workspace, target);
      if (!rel || rel.startsWith("..") || rel.includes("\\") || target === workspace) {
        throw new DockerRuntimeError("Rejected unsafe source path.", "INVALID_PROJECT");
      }
      await mkdir(dirname(target), { recursive: true, mode: 0o777 });
      await chmod(dirname(target), 0o777).catch(() => undefined);
      await writeFile(target, file.content, { encoding: "utf8", mode: 0o666, flag: "w" });
    }

    // Vite must use the per-session URL prefix for asset paths. Next's basePath
    // is generated only when no user config is present, to avoid silently
    // replacing an app-specific configuration.
    if (framework === "nextjs") {
      const hasNextConfig = files.some((file) => /^next\.config\.(?:js|mjs|cjs|ts)$/.test(file.path));
      if (hasNextConfig) {
        throw new DockerRuntimeError(
          "Preview worker currently reserves next.config for its session basePath; remove the custom Next config or adapt it to include the session basePath.",
          "UNSUPPORTED_FRAMEWORK_CONFIG"
        );
      }
      await writeFile(
        resolve(workspace, "next.config.mjs"),
        "const config = { basePath: " + JSON.stringify("/p/" + sessionId) + " };\nexport default config;\n",
        "utf8"
      );
    }
    return workspace;
  }

  async start(sessionId: string, framework: WorkerFramework, workspace: string, port: number): Promise<string> {
    const containerName = this.containerName(sessionId);
    const containerPort = framework === "nextjs" ? 3000 : 4173;
    const basePath = "/p/" + sessionId;
    const command = framework === "nextjs"
      ? "npm install --no-audit --no-fund --package-lock=false && npm run build && npm run start -- --hostname 0.0.0.0 --port " + containerPort
      : "npm install --no-audit --no-fund --package-lock=false && npm run build -- --base " + basePath + "/ && npm run start -- --host 0.0.0.0 --port " + containerPort + " --base " + basePath + "/";

    const args = [
      "run", "--detach", "--init",
      "--name", containerName,
      "--label", "designbuddy.preview.managed=true",
      "--label", "designbuddy.preview.worker=" + this.config.workerId,
      "--label", "designbuddy.preview.session=" + sessionId,
      "--network", this.networkName(sessionId),
      "--memory", this.config.memoryLimit,
      "--memory-swap", this.config.memoryLimit,
      "--cpus", this.config.cpuLimit,
      "--pids-limit", String(this.config.pidsLimit),
      "--cap-drop", "ALL",
      "--security-opt", "no-new-privileges:true",
      "--read-only",
      "--user", "10001:10001",
      "--tmpfs", "/tmp:rw,nosuid,nodev,noexec,size=96m,uid=10001,gid=10001",
      "--ulimit", "nofile=1024:1024",
      "--ulimit", "fsize=104857600:104857600",
      "--log-driver", "json-file",
      "--log-opt", "max-size=2m",
      "--log-opt", "max-file=2",
      "--publish", this.config.previewBindHost + ":" + port + ":" + containerPort,
      "--mount", "type=bind,src=" + workspace + ",dst=/workspace,rw",
      "--workdir", "/workspace",
      "--env", "HOME=/tmp",
      "--env", "npm_config_cache=/tmp/.npm",
      "--env", "NEXT_TELEMETRY_DISABLED=1",
      "--restart", "no",
      "node:22-alpine",
      "sh", "-lc", command
    ];

    try {
      await this.createSessionNetwork(sessionId);
      await this.execDocker(args, 240000);
      return containerName;
    } catch (error) {
      await this.stop(containerName).catch(() => undefined);
      const message = error instanceof Error ? error.message : "Unable to start preview container.";
      throw new DockerRuntimeError(message.slice(0, 800), "CONTAINER_START_FAILED");
    }
  }

  async stop(containerName: string): Promise<void> {
    const networkName = containerName.replace(/^db-preview-/, "db-preview-net-");
    try {
      await this.execDocker(["rm", "--force", containerName], 30000);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("No such container") && !message.includes("is not running") && !message.includes("Error: No such object")) {
        throw new DockerRuntimeError("Unable to stop preview container.", "CONTAINER_STOP_FAILED");
      }
    }
    await this.execDocker(["network", "rm", networkName], 15000).catch(() => undefined);
  }

  async isRunning(containerName: string): Promise<boolean> {
    try {
      const result = await this.execDocker(["inspect", "--format", "{{.State.Running}}", containerName], 10000);
      return result.stdout.trim() === "true";
    } catch {
      return false;
    }
  }

  async logs(containerName: string): Promise<string> {
    try {
      const result = await this.execDocker(["logs", "--tail", "50", containerName], 10000);
      return (result.stdout + "\n" + result.stderr).slice(-6000);
    } catch {
      return "";
    }
  }

  async stats(containerName: string): Promise<{ cpuPercent?: number; memoryBytes?: number }> {
    try {
      const result = await this.execDocker([
        "stats", "--no-stream", "--format", "{{.CPUPerc}}|{{.MemUsage}}", containerName
      ], 10000);
      const parts = result.stdout.trim().split("|");
      const cpu = Number.parseFloat((parts[0] ?? "").replace("%", ""));
      const memory = (parts[1] ?? "").split("/")[0]?.trim() ?? "";
      const bytes = this.parseBytes(memory);
      return {
        ...(Number.isFinite(cpu) ? { cpuPercent: cpu } : {}),
        ...(bytes !== undefined ? { memoryBytes: bytes } : {})
      };
    } catch {
      return {};
    }
  }

  async portIsHealthy(port: number, framework: WorkerFramework, sessionId: string): Promise<boolean> {
    const path = "/p/" + sessionId + "/";
    const rawHost = this.config.previewUpstreamHost;
    const host = rawHost.includes(":") && !rawHost.startsWith("[") ? "[" + rawHost + "]" : rawHost;
    const url = new URL(path, "http://" + host + ":" + port);
    return new Promise((resolvePromise) => {
      let settled = false;
      const finish = (result: boolean) => {
        if (settled) return;
        settled = true;
        resolvePromise(result);
      };
      const req = httpGet(url, { timeout: 1500 }, (response) => {
        response.resume();
        finish(response.statusCode !== undefined && response.statusCode >= 200 && response.statusCode < 400);
      });
      req.on("timeout", () => { req.destroy(); finish(false); });
      req.on("error", () => finish(false));
    });
  }

  async cleanupOrphans(): Promise<number> {
    const result = await this.execDocker([
      "ps", "-aq", "--filter", "label=designbuddy.preview.worker=" + this.config.workerId
    ], 15000);
    const ids = result.stdout.split(/\s+/).map((value) => value.trim()).filter(Boolean);
    if (ids.length > 0) {
      await this.execDocker(["rm", "--force", ...ids], 60000);
    }

    const networks = await this.execDocker([
      "network", "ls", "-q", "--filter", "label=designbuddy.preview.worker=" + this.config.workerId
    ], 15000);
    const networkIds = networks.stdout.split(/\s+/).map((value) => value.trim()).filter(Boolean);
    if (networkIds.length > 0) {
      await this.execDocker(["network", "rm", ...networkIds], 60000).catch(() => undefined);
    }
    await rm(resolve(this.config.workspaceRoot, this.config.workerId), { recursive: true, force: true }).catch(() => undefined);
    return ids.length;
  }

  workspacePath(sessionId: string): string {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(sessionId)) {
      throw new DockerRuntimeError("Invalid preview session ID.", "INVALID_SESSION_ID");
    }
    return resolve(this.config.workspaceRoot, this.config.workerId, sessionId);
  }

  containerName(sessionId: string): string {
    const safe = sessionId.toLowerCase().replace(/[^a-z0-9_.-]/g, "-").slice(0, 44);
    let hash = 2166136261;
    for (const character of sessionId) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return "db-preview-" + safe + "-" + (hash >>> 0).toString(16);
  }

  private networkName(sessionId: string): string {
    return this.containerName(sessionId).replace(/^db-preview-/, "db-preview-net-");
  }

  private async createSessionNetwork(sessionId: string): Promise<void> {
    await this.execDocker([
      "network", "create", "--driver", "bridge",
      "--label", "designbuddy.preview.managed=true",
      "--label", "designbuddy.preview.worker=" + this.config.workerId,
      "--label", "designbuddy.preview.session=" + sessionId,
      this.networkName(sessionId)
    ], 30000);
  }

  private async execDocker(args: string[], timeout: number) {
    try {
      return await execFileAsync("docker", args, {
        timeout,
        maxBuffer: 1024 * 1024,
        windowsHide: true
      });
    } catch (error) {
      const info = error as { message?: string; stderr?: string };
      const detail = (info.stderr || info.message || "Docker command failed.").toString();
      throw new DockerRuntimeError(detail.slice(0, 800), "DOCKER_COMMAND_FAILED");
    }
  }

  private parseBytes(value: string): number | undefined {
    const match = value.match(/^([0-9.]+)\s*(B|KiB|MiB|GiB|KB|MB|GB)$/i);
    if (!match) return undefined;
    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    const factor = unit === "b" ? 1 :
      unit === "kib" ? 1024 :
      unit === "mib" ? 1024 ** 2 :
      unit === "gib" ? 1024 ** 3 :
      unit === "kb" ? 1000 :
      unit === "mb" ? 1000 ** 2 : 1000 ** 3;
    return Number.isFinite(amount) ? Math.round(amount * factor) : undefined;
  }
}
