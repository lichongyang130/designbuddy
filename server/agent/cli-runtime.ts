import { spawn } from "node:child_process";

export type CodingAgentId = "codex" | "claude" | "opencode" | "gemini" | "cursor-agent";
const adapters: Record<CodingAgentId, { command: string; args: (prompt: string) => string[] }> = {
  codex: { command: "codex", args: (prompt) => ["exec", "--json", "--skip-git-repo-check", "--sandbox", "workspace-write", prompt] },
  claude: { command: "claude", args: (prompt) => ["-p", "--permission-mode", "acceptEdits", "--output-format", "text", prompt] },
  opencode: { command: "opencode", args: (prompt) => ["run", prompt] },
  gemini: { command: "gemini", args: (prompt) => ["--prompt", prompt] },
  "cursor-agent": { command: "cursor-agent", args: (prompt) => ["-p", prompt] },
};
const inheritedEnvKeys = new Set([
  "PATH", "HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "XDG_CONFIG_HOME", "XDG_DATA_HOME",
  "TMPDIR", "TMP", "TEMP", "SYSTEMROOT", "WINDIR", "COMSPEC", "PATHEXT", "LANG", "LC_ALL", "TERM",
  "SSL_CERT_FILE", "SSL_CERT_DIR", "CODEX_HOME", "CLAUDE_CONFIG_DIR",
]);

export interface AgentRunResult {
  agent: CodingAgentId;
  output: string;
  exitCode: number;
}

export interface CodingAgentExecutionOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

export async function runCodingAgent(
  agent: CodingAgentId,
  prompt: string,
  cwd: string,
  timeoutOrOptions: number | CodingAgentExecutionOptions = 10 * 60_000,
): Promise<AgentRunResult> {
  const adapter = adapters[agent];
  if (!adapter) throw new Error("Unsupported coding agent.");
  if (!prompt.trim() || prompt.length > 16_000) throw new Error("Prompt must contain 1 to 16,000 characters.");
  const opts = typeof timeoutOrOptions === "number" ? { timeoutMs: timeoutOrOptions } : timeoutOrOptions;
  const timeoutMs = Math.min(Math.max(opts.timeoutMs ?? 10 * 60_000, 100), 30 * 60_000);
  if (opts.signal?.aborted) {
    throw new Error(`${agent} execution was cancelled before start.`);
  }
  return new Promise((resolve, reject) => {
    const child = spawn(adapter.command, adapter.args(prompt), {
      cwd,
      shell: false,
      windowsHide: true,
      env: Object.fromEntries(Object.entries(process.env).filter(([key]) => inheritedEnvKeys.has(key))),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let settled = false;
    let cancelled = false;
    const capture = (chunk: Buffer) => {
      output += chunk.toString();
      if (output.length > 2_000_000) {
        output = output.slice(-2_000_000);
        child.kill("SIGTERM");
      }
    };
    const onAbort = () => {
      cancelled = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 1_000).unref();
    };
    opts.signal?.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 3_000).unref();
    }, timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onAbort);
    };
    child.stdout.on("data", capture);
    child.stderr.on("data", capture);
    child.once("error", (error) => {
      cleanup();
      if (settled) return;
      settled = true;
      reject(error.message.includes("ENOENT") ? new Error(`${adapter.command} CLI is not installed or is not on PATH.`) : error);
    });
    child.once("close", (code, signal) => {
      cleanup();
      if (settled) return;
      settled = true;
      if (cancelled) reject(new Error(`${agent} execution was cancelled.`));
      else if (signal) reject(new Error(`${agent} was stopped after timeout or output limit.`));
      else if (code !== 0) reject(new Error(`${agent} exited with status ${code}: ${output.slice(-1200)}`));
      else resolve({ agent, output: output.slice(-2_000_000), exitCode: code ?? 0 });
    });
  });
}
