import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import * as acorn from "acorn";
import postcss from "postcss";
import type { ApiProject } from "../api/http-handler";
import { runCodingAgent, type AgentRunResult, type CodingAgentId } from "./cli-runtime";

function findRepoRoot(): string {
  let dir = __dirname;
  for (let i = 0; i < 8; i += 1) {
    const pkg = join(dir, "package.json");
    if (existsSync(pkg)) {
      try {
        if (JSON.parse(readFileSync(pkg, "utf8")).workspaces) return dir;
      } catch {
        // ignore invalid json
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(__dirname, "../..");
}

const REPO_ROOT = findRepoRoot();
const PROTECTED_TOP_DIRS = new Set([
  ".git",
  "apps",
  "frontend",
  "server",
  "packages",
  "shared",
  "skills",
  "plugins",
  "themes",
  "design-systems",
  "design-templates",
  "docs",
  "scripts",
  "database",
]);

/** Per-project async lock preventing concurrent runs from racing on the same project id. */
const projectLocks = new Map<string, Promise<unknown>>();

function withProjectLock<T>(projectKey: string, task: () => Promise<T>): Promise<T> {
  const previous = projectLocks.get(projectKey) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(task);
  const settled = next.then(
    () => undefined,
    () => undefined,
  );
  projectLocks.set(projectKey, settled);
  void settled.then(() => {
    if (projectLocks.get(projectKey) === settled) projectLocks.delete(projectKey);
  });
  return next;
}

export function safeRelativePath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  if (!normalized.trim() || normalized.startsWith("/") || normalized.split("/").some((part) => part === ".." || part === "")) {
    throw new Error(`Unsafe project file path: ${filePath}`);
  }
  return normalized;
}

export function assertIsolatedWorkspaceRoot(workspaceRoot: string): string {
  const root = resolve(workspaceRoot);
  if (root === REPO_ROOT || root === resolve("/")) {
    throw new Error("Refusing to use repository root or filesystem root as agent workspace.");
  }
  if (root.startsWith(REPO_ROOT + sep)) {
    const rel = relative(REPO_ROOT, root).split(sep)[0];
    if (PROTECTED_TOP_DIRS.has(rel)) {
      throw new Error(`Refusing to use protected source directory '${rel}' as mutable agent workspace.`);
    }
    if (rel === "data" && relative(REPO_ROOT, root) === "data") {
      throw new Error("Agent workspace must be a dedicated subdirectory (e.g. data/agent-projects), never data/ root.");
    }
  }
  return root;
}

function safeProjectSegment(id: string): string {
  const cleaned = id.trim();
  if (!cleaned || cleaned === "." || cleaned === ".." || /[\\/\0]/.test(cleaned)) {
    throw new Error("Invalid project identifier.");
  }
  return cleaned;
}

function languageFor(filePath: string): ApiProject["files"][number]["language"] {
  const extension = extname(filePath).toLowerCase();
  if (extension === ".html") return "html";
  if (extension === ".css") return "css";
  if ([".js", ".mjs", ".cjs"].includes(extension)) return "javascript";
  return undefined;
}

export interface ProjectRunValidationIssue {
  file: string;
  line?: number;
  message: string;
}

export interface ProjectRunDiffSummary {
  added: string[];
  modified: string[];
  removed: string[];
  unchanged: string[];
}

export interface ProjectRunnerOptions {
  runId?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Retain the per-run sandbox directory for inspection instead of auto-cleaning it on exit. */
  keepWorkspace?: boolean;
  /** Validate JS/CSS/JSON syntax after execution; defaults to true. */
  validateSyntax?: boolean;
  /** Serialize runs targeting the same project id; defaults to true. */
  serializePerProject?: boolean;
  /** Injectable executor for deterministic tests without global process mocks. */
  executor?: (
    agent: CodingAgentId,
    prompt: string,
    cwd: string,
    options: { timeoutMs?: number; signal?: AbortSignal },
  ) => Promise<AgentRunResult>;
}

export function validateProjectFilesSyntax(files: ApiProject["files"]): ProjectRunValidationIssue[] {
  const issues: ProjectRunValidationIssue[] = [];
  for (const file of files) {
    const ext = extname(file.path).toLowerCase();
    if ([".js", ".mjs", ".cjs"].includes(ext)) {
      try {
        acorn.parse(file.content, { ecmaVersion: "latest", sourceType: ext === ".cjs" ? "script" : "module" });
      } catch (err: any) {
        issues.push({
          file: file.path,
          line: err?.loc?.line,
          message: `JavaScript syntax error: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    } else if (ext === ".css") {
      try {
        postcss.parse(file.content, { from: file.path });
      } catch (err: any) {
        issues.push({
          file: file.path,
          line: err?.line,
          message: `CSS syntax error: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    } else if (ext === ".json") {
      try {
        JSON.parse(file.content);
      } catch (err: any) {
        issues.push({
          file: file.path,
          message: `JSON syntax error: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
  }
  return issues;
}

function summarizeDiff(before: ApiProject["files"], after: ApiProject["files"]): ProjectRunDiffSummary {
  const beforeMap = new Map(before.map((f) => [f.path, f.content]));
  const afterMap = new Map(after.map((f) => [f.path, f.content]));
  const added: string[] = [];
  const modified: string[] = [];
  const unchanged: string[] = [];
  const removed: string[] = [];
  for (const [path, content] of afterMap) {
    if (!beforeMap.has(path)) added.push(path);
    else if (beforeMap.get(path) !== content) modified.push(path);
    else unchanged.push(path);
  }
  for (const path of beforeMap.keys()) {
    if (!afterMap.has(path)) removed.push(path);
  }
  return { added, modified, removed, unchanged };
}

export async function runAgentOnProject(
  project: ApiProject,
  agent: CodingAgentId,
  prompt: string,
  workspaceRoot: string,
  options: ProjectRunnerOptions = {},
) {
  const root = assertIsolatedWorkspaceRoot(workspaceRoot);
  const projectSegment = safeProjectSegment(project.id);
  const runId = (options.runId && /^[a-zA-Z0-9_-]{1,64}$/.test(options.runId)) ? options.runId : randomUUID();
  const projectBase = resolve(root, projectSegment);
  const cwd = resolve(projectBase, `run-${runId}`);
  if (!cwd.startsWith(root + sep) || !cwd.startsWith(projectBase + sep)) {
    throw new Error("Invalid project workspace path.");
  }

  const execute = async () => {
    await mkdir(cwd, { recursive: true });
    try {
      for (const file of project.files) {
        const relativePath = safeRelativePath(file.path);
        const destination = resolve(cwd, relativePath);
        if (!destination.startsWith(cwd + sep)) throw new Error(`Unsafe project file path: ${file.path}`);
        await mkdir(dirname(destination), { recursive: true });
        await writeFile(destination, file.content, "utf8");
      }

      const execFn = options.executor ?? runCodingAgent;
      const result = await execFn(
        agent,
        [
          "Work only in the current project directory. Read DESIGN.md if present and follow it.",
          "Implement the user's request in the project files. Preserve existing work and avoid adding dependencies unless necessary.",
          `Request: ${prompt.trim()}`,
        ].join("\n\n"),
        cwd,
        { timeoutMs: options.timeoutMs, signal: options.signal },
      );

      const files: ApiProject["files"] = [];
      let totalBytes = 0;
      async function collect(directory: string): Promise<void> {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
          if (entry.name === ".git" || entry.name === "node_modules" || entry.name === ".DS_Store") continue;
          const fullPath = resolve(directory, entry.name);
          if (!fullPath.startsWith(cwd + sep)) continue;
          if (entry.isSymbolicLink()) continue;
          if (entry.isDirectory()) {
            await collect(fullPath);
            continue;
          }
          if (!entry.isFile() || files.length >= 200) continue;
          const info = await stat(fullPath);
          if (info.size > 2_000_000 - totalBytes) throw new Error("Agent output exceeded the 2 MB project storage limit.");
          const content = await readFile(fullPath, "utf8");
          totalBytes += Buffer.byteLength(content);
          if (totalBytes > 2_000_000) throw new Error("Agent output exceeded the 2 MB project storage limit.");
          files.push({ path: relative(cwd, fullPath).split(sep).join("/"), content, language: languageFor(fullPath) });
        }
      }
      await collect(cwd);
      if (!files.length) throw new Error("Agent completed without leaving project files.");

      const validationIssues = options.validateSyntax === false ? [] : validateProjectFilesSyntax(files);
      if (validationIssues.length > 0) {
        const first = validationIssues[0];
        throw new Error(`Post-run syntax verification failed in ${first.file}${first.line ? `:${first.line}` : ""}: ${first.message}`);
      }
      const diff = summarizeDiff(project.files, files);
      return {
        runId,
        files,
        diff,
        validationIssues,
        output: result.output.slice(-12_000),
        workspacePath: cwd,
      };
    } finally {
      if (!options.keepWorkspace) {
        await rm(cwd, { recursive: true, force: true }).catch(() => undefined);
      }
    }
  };

  if (options.serializePerProject === false) {
    return execute();
  }
  return withProjectLock(projectSegment, execute);
}
