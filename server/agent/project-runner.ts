import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, extname, relative, resolve, sep } from "node:path";
import type { ApiProject } from "../api/http-handler";
import { runCodingAgent, type CodingAgentId } from "./cli-runtime";

function safeRelativePath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  if (!normalized.trim() || normalized.startsWith("/") || normalized.split("/").some((part) => part === ".." || part === "")) throw new Error(`Unsafe project file path: ${filePath}`);
  return normalized;
}

function languageFor(filePath: string): ApiProject["files"][number]["language"] {
  const extension = extname(filePath).toLowerCase();
  if (extension === ".html") return "html";
  if (extension === ".css") return "css";
  if ([".js", ".mjs", ".cjs"].includes(extension)) return "javascript";
  return undefined;
}

export async function runAgentOnProject(project: ApiProject, agent: CodingAgentId, prompt: string, workspaceRoot: string) {
  const root = resolve(workspaceRoot);
  const cwd = resolve(root, project.id);
  if (!cwd.startsWith(root + sep)) throw new Error("Invalid project workspace path.");
  await rm(cwd, { recursive: true, force: true });
  await mkdir(cwd, { recursive: true });
  for (const file of project.files) {
    const relativePath = safeRelativePath(file.path);
    const destination = resolve(cwd, relativePath);
    if (!destination.startsWith(cwd + sep)) throw new Error(`Unsafe project file path: ${file.path}`);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, file.content, "utf8");
  }

  const result = await runCodingAgent(agent, [
    "Work only in the current project directory. Read DESIGN.md if present and follow it.",
    "Implement the user's request in the project files. Preserve existing work and avoid adding dependencies unless necessary.",
    `Request: ${prompt.trim()}`,
  ].join("\n\n"), cwd);

  const files: ApiProject["files"] = [];
  let totalBytes = 0;
  async function collect(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === ".git" || entry.name === "node_modules" || entry.name === ".DS_Store") continue;
      const fullPath = resolve(directory, entry.name);
      if (!fullPath.startsWith(cwd + sep)) continue;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) { await collect(fullPath); continue; }
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
  return { files, output: result.output.slice(-12_000), workspacePath: cwd };
}
