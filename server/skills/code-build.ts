import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { unzipSync, zipSync, strToU8 } from "fflate";

/**
 * Restricted build executor for `code.build`.
 *
 * What it really does: unpacks the uploaded project into a temporary
 * directory and runs the project's own build in a separate process with a
 * scrubbed environment, a wall-clock timeout and output caps, then packages
 * the produced artifacts.
 *
 * Honest boundaries:
 * - This is a *restricted local process*, not a container, VM or kernel
 *   namespace. It is not a safe place for untrusted third-party code. The
 *   skill's own limits and the product UI say so explicitly.
 * - The build command is taken from a strict allowlist; arbitrary shell
 *   strings, pipes and chains are rejected.
 * - No server credential is passed to the build, and common outbound HTTP(S)
 *   paths are broken by an invalid proxy (not kernel-level network isolation).
 * - A non-zero exit code fails the run; no partial "build succeeded" artifact
 *   is published.
 */
export type BuildInput = {
  filename: string;
  bytes: Uint8Array;
  parameters?: Record<string, string>;
};

export type BuildResult = {
  summary: string;
  outputs: { name: string; mime: string; bytes: Uint8Array }[];
};

const MAX_EXTRACTED_BYTES = 20_000_000;
const MAX_ARTIFACT_BYTES = 5_000_000;
const MAX_LOG_BYTES = 1_000_000;
const ALLOWED_COMMANDS = [
  /^npm run ([a-zA-Z0-9:_-]{1,40})$/,
  /^pnpm run ([a-zA-Z0-9:_-]{1,40})$/,
  /^pnpm ([a-zA-Z0-9:_-]{1,40})$/,
  /^yarn ([a-zA-Z0-9:_-]{1,40})$/,
  /^tsc -b$/,
  /^make( [a-zA-Z0-9:_-]{1,40})?$/,
  /^python3 -m pytest$/,
] as const;

const SECRET_ENV = /(KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL|COOKIE|SESSION|AUTH)/i;

function scrubEnv(home: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!value) continue;
    if (SECRET_ENV.test(key)) continue;
    if (key === "DESIGNBUDDY_LOCAL_TOKEN") continue;
    env[key] = value;
  }
  env.HOME = home;
  env.TMPDIR = home;
  env.LANG = "C.UTF-8";
  env.LC_ALL = "C.UTF-8";
  env.CI = "1";
  env.NODE_ENV = "production";
  // Break the most common outbound HTTP(S) paths for tools that honour proxy
  // variables. This is not kernel-level network isolation.
  env.HTTP_PROXY = "http://127.0.0.1:9";
  env.HTTPS_PROXY = "http://127.0.0.1:9";
  env.http_proxy = "http://127.0.0.1:9";
  env.https_proxy = "http://127.0.0.1:9";
  env.NO_PROXY = "127.0.0.1,localhost";
  return env;
}

function extractProject(bytes: Uint8Array, target: string): { files: number; bytes: number } {
  const archive = unzipSync(bytes);
  let total = 0;
  let count = 0;
  for (const [name, content] of Object.entries(archive)) {
    if (!name || name.endsWith("/")) continue;
    const path = resolve(target, name);
    if (!path.startsWith(resolve(target) + sep)) throw new Error(`压缩包路径越界：${name}`);
    if (content.length > MAX_EXTRACTED_BYTES) throw new Error("压缩包内容超过 20 MB 限制。");
    total += content.length;
    if (total > MAX_EXTRACTED_BYTES) throw new Error("压缩包展开后超过 20 MB 限制。");
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    count += 1;
  }
  if (!count) throw new Error("压缩包中没有可构建的文件。");
  return { files: count, bytes: total };
}

function detectCommand(root: string, requested: string): string {
  if (requested) {
    const normalized = requested.trim();
    if (!ALLOWED_COMMANDS.some(pattern => pattern.test(normalized)))
      throw new Error(
        "构建命令不在允许列表内。允许：npm run <脚本>、pnpm run <脚本>、yarn <脚本>、tsc -b、make [目标]、python3 -m pytest。",
      );
    return normalized;
  }
  const packageJson = join(root, "package.json");
  if (existsSync(packageJson)) {
    let scripts: Record<string, string> = {};
    try {
      scripts = (JSON.parse(readFileSync(packageJson, "utf8")) as { scripts?: Record<string, string> }).scripts || {};
    } catch {
      throw new Error("package.json 不是有效 JSON。");
    }
    if (!scripts.build) {
      if (existsSync(join(root, "tsconfig.json"))) return "tsc -b";
      throw new Error("package.json 没有 build 脚本，也没有 tsconfig.json；请通过 buildCommand 指定允许列表内的命令。");
    }
    if (existsSync(join(root, "pnpm-lock.yaml"))) return "pnpm run build";
    if (existsSync(join(root, "yarn.lock"))) return "yarn build";
    return "npm run build";
  }
  if (existsSync(join(root, "Makefile"))) return "make";
  if (existsSync(join(root, "pyproject.toml")) || existsSync(join(root, "setup.py"))) return "python3 -m pytest";
  throw new Error("压缩包里没有 package.json、Makefile 或 Python 项目文件，无法确定构建命令。");
}

function collectArtifacts(root: string): { files: Record<string, Uint8Array>; bytes: number } {
  const candidates = ["dist", "build", "out", "public", "output"];
  const files: Record<string, Uint8Array> = {};
  let bytes = 0;
  const walk = (current: string, prefix: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path, name);
      else if (entry.isFile()) {
        const size = statSync(path).size;
        if (bytes + size > MAX_ARTIFACT_BYTES) return;
        bytes += size;
        files[name] = new Uint8Array(readFileSync(path));
      }
    }
  };
  for (const candidate of candidates) {
    const directory = join(root, candidate);
    if (!existsSync(directory) || !statSync(directory).isDirectory()) continue;
    walk(directory, candidate);
  }
  return { files, bytes };
}

export async function runBuild(input: BuildInput, event: (message: string) => void): Promise<BuildResult> {
  if (!/\.zip$/i.test(input.filename)) throw new Error("请上传项目压缩包（.zip）。");
  const workDir = join(process.cwd(), "data", "build-runs", `build-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const projectDir = join(workDir, "project");
  mkdirSync(projectDir, { recursive: true });
  const timeoutMs = Number(process.env.SKILL_BUILD_TIMEOUT_MS || 180000);
  try {
    const extracted = extractProject(input.bytes, projectDir);
    const command = detectCommand(projectDir, input.parameters?.buildCommand || "");
    event(`已在临时目录展开 ${extracted.files} 个文件，执行受限构建：${command}。`);
    const started = Date.now();
    const result = await new Promise<{ code: number; stdout: string; stderr: string; timedOut: boolean }>((resolveRun, rejectRun) => {
      const [bin, ...args] = command.split(" ");
      const child = spawn(bin, args, {
        cwd: projectDir,
        env: scrubEnv(workDir),
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
      }, timeoutMs);
      child.stdout.on("data", chunk => (stdout += String(chunk)));
      child.stderr.on("data", chunk => (stderr += String(chunk)));
      child.on("error", error => {
        clearTimeout(timer);
        rejectRun(new Error(`无法启动构建命令：${error.message}`));
      });
      child.on("close", code => {
        clearTimeout(timer);
        resolveRun({ code: code ?? -1, stdout, stderr, timedOut });
      });
    });
    const durationMs = Date.now() - started;
    const log = [
      `命令：${command}`,
      `退出码：${result.code}${result.timedOut ? "（超时终止）" : ""}`,
      `耗时：${durationMs} ms`,
      "--- stdout ---",
      result.stdout.slice(0, MAX_LOG_BYTES),
      "--- stderr ---",
      result.stderr.slice(0, MAX_LOG_BYTES),
    ].join("\n");
    if (result.timedOut) {
      throw new Error(`构建超过 ${Math.round(timeoutMs / 1000)} 秒上限，已终止。${result.stdout.slice(-400)}`);
    }
    if (result.code !== 0) {
      throw new Error(
        `构建失败（退出码 ${result.code}）。${(result.stderr || result.stdout).slice(-600) || "没有错误输出"}`,
      );
    }
    const artifacts = collectArtifacts(projectDir);
    const report = {
      tool: "code.build",
      command,
      exitCode: result.code,
      durationMs,
      extractedFiles: extracted.files,
      artifactFiles: Object.keys(artifacts.files).length,
      artifactBytes: artifacts.bytes,
      isolation:
        "本地受限子进程执行：独立进程与临时工作目录、清理过凭据的环境变量、超时与输出上限、阻断常见 HTTP(S) 出网代理路径。不是容器或虚拟机隔离，不可用于来路不明的不可信代码。",
      policy: "只有真实退出码为 0 的构建才交付；产物来自构建后实际生成的目录。",
    };
    const outputs: BuildResult["outputs"] = [
      { name: "build-report.json", mime: "application/json", bytes: strToU8(JSON.stringify(report, null, 2)) },
      { name: "build-log.txt", mime: "text/plain", bytes: strToU8(log) },
    ];
    if (Object.keys(artifacts.files).length) {
      outputs.push({
        name: "build-output.zip",
        mime: "application/zip",
        bytes: new Uint8Array(zipSync(artifacts.files, { level: 6 })),
      });
    }
    return {
      summary: `构建成功：${command} 退出码 0，耗时 ${durationMs} ms，交付 ${Object.keys(artifacts.files).length} 个产物文件。执行环境为本机受限子进程，不是容器隔离。`,
      outputs,
    };
  } finally {
    try {
      const { rmSync } = await import("node:fs");
      rmSync(workDir, { recursive: true, force: true });
    } catch {
      /* Cleanup failure must not change the build verdict. */
    }
  }
}
