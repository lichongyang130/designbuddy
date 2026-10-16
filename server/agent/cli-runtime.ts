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

export interface AgentRunResult { agent: CodingAgentId; output: string; exitCode: number; }

export async function runCodingAgent(agent: CodingAgentId, prompt: string, cwd: string, timeoutMs = 10 * 60_000): Promise<AgentRunResult> {
  const adapter = adapters[agent];
  if (!adapter) throw new Error("Unsupported coding agent.");
  if (!prompt.trim() || prompt.length > 16_000) throw new Error("Prompt must contain 1 to 16,000 characters.");
  return new Promise((resolve, reject) => {
    const child = spawn(adapter.command, adapter.args(prompt), {
      cwd, shell: false, windowsHide: true,
      env: Object.fromEntries(Object.entries(process.env).filter(([key]) => inheritedEnvKeys.has(key))),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let settled = false;
    const capture = (chunk: Buffer) => {
      output += chunk.toString();
      if (output.length > 2_000_000) {
        output = output.slice(-2_000_000);
        child.kill("SIGTERM");
      }
    };
    const timer = setTimeout(() => { child.kill("SIGTERM"); setTimeout(() => child.kill("SIGKILL"), 3_000).unref(); }, timeoutMs);
    child.stdout.on("data", capture);
    child.stderr.on("data", capture);
    child.once("error", (error) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      reject(error.message.includes("ENOENT") ? new Error(`${adapter.command} CLI is not installed or is not on PATH.`) : error);
    });
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      if (signal) reject(new Error(`${agent} was stopped after timeout or output limit.`));
      else if (code !== 0) reject(new Error(`${agent} exited with status ${code}: ${output.slice(-1200)}`));
      else resolve({ agent, output: output.slice(-2_000_000), exitCode: code ?? 0 });
    });
  });
}
