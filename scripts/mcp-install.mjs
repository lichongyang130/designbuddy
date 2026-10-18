import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const home = homedir();
const script = fileURLToPath(new URL("./mcp-stdio.mjs", import.meta.url));
const targets = {
  claude: { file: path.join(home, ".claude.json"), key: "mcpServers" },
  cursor: { file: path.join(home, ".cursor", "mcp.json"), key: "mcpServers" },
  gemini: { file: path.join(home, ".gemini", "settings.json"), key: "mcpServers" },
  opencode: { file: path.join(home, ".config/opencode/opencode.json"), key: "mcp", format: "opencode" },
  vscode: { file: process.platform === "darwin" ? path.join(home, "Library/Application Support/Code/User/mcp.json") : process.platform === "win32" ? path.join(process.env.APPDATA || home, "Code/User/mcp.json") : path.join(home, ".config/Code/User/mcp.json"), key: "servers" },
  "claude-desktop": { file: process.platform === "darwin" ? path.join(home, "Library/Application Support/Claude/claude_desktop_config.json") : process.platform === "win32" ? path.join(process.env.APPDATA || home, "Claude/claude_desktop_config.json") : path.join(home, ".config/Claude/claude_desktop_config.json"), key: "mcpServers" },
};

const args = process.argv.slice(2);
const uninstall = args.includes("--uninstall");
const print = args.includes("--print");
const targetName = args.find((value) => !value.startsWith("--"));
if (!targetName || !targets[targetName]) {
  process.stderr.write(`Usage: node scripts/mcp-install.mjs <${Object.keys(targets).join("|")}> [--print|--uninstall]\n`);
  process.exit(2);
}

const target = targets[targetName];
const entry = {
  command: process.execPath,
  args: [script],
  env: {
    DESIGNBUDDY_MCP_URL: process.env.DESIGNBUDDY_MCP_URL || "http://127.0.0.1:8787/api/mcp",
    ...(process.env.DESIGNBUDDY_LOCAL_TOKEN ? { DESIGNBUDDY_MCP_TOKEN: process.env.DESIGNBUDDY_LOCAL_TOKEN } : {}),
  },
};
const configEntry = target.format === "opencode"
  ? { type: "local", command: [process.execPath, script], environment: entry.env, enabled: true }
  : entry;
if (print) {
  process.stdout.write(`${JSON.stringify({ [target.key]: { designbuddy: configEntry } }, null, 2)}\n`);
  process.exit(0);
}

let config = {};
try { config = JSON.parse(await readFile(target.file, "utf8")); }
catch (error) { if (error.code !== "ENOENT") throw new Error(`Cannot read ${target.file}: ${error.message}`); }
if (!config || typeof config !== "object" || Array.isArray(config)) throw new Error(`Invalid JSON config: ${target.file}`);
config[target.key] = config[target.key] && typeof config[target.key] === "object" ? config[target.key] : {};
if (uninstall) delete config[target.key].designbuddy;
else config[target.key].designbuddy = configEntry;
await mkdir(path.dirname(target.file), { recursive: true });
await writeFile(target.file, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
await chmod(target.file, 0o600);
process.stdout.write(`DesignBuddy MCP ${uninstall ? "removed from" : "installed in"} ${target.file}. Restart the agent to apply the change.\n`);
