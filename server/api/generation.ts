import { requestAI } from "./ai";

export interface GenerationFile {
  path: string;
  content: string;
  language?: "html" | "css" | "javascript";
}

export interface GenerationRequest {
  userId: string;
  prompt: string;
  projectName: string;
  model?: string;
  designContract?: string;
  apiKey?: string;
  provider?: string;
  currentFiles?: GenerationFile[];
}

export interface GenerationResponse { name: string; files: GenerationFile[]; model: string; }

const allowedPaths = new Set(["index.html", "src/styles.css", "src/main.js"]);
const maxFileBytes = 250_000;
const maxTotalBytes = 600_000;

function parseModelJSON(content: string): unknown {
  let text = content.trim();
  const fence = String.fromCharCode(96).repeat(3);
  if (text.startsWith(fence)) {
    text = text.slice(fence.length).replace(/^json\s*/i, "").replace(new RegExp("\\s*" + fence + "$"), "");
  }
  try { return JSON.parse(text); }
  catch { throw new Error("AI provider did not return valid JSON. Choose a compatible model or check its response format."); }
}

function languageForPath(path: string): GenerationFile["language"] {
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".js")) return "javascript";
  return undefined;
}

function validateFiles(value: unknown): GenerationFile[] {
  if (!value || typeof value !== "object" || !("files" in value) || !Array.isArray((value as {files?:unknown}).files)) {
    throw new Error("AI response must contain a files array.");
  }
  const entries = (value as { files: unknown[] }).files;
  if (entries.length < 1 || entries.length > allowedPaths.size) throw new Error("AI response must contain between 1 and 3 project files.");
  const seen = new Set<string>();
  let totalBytes = 0;
  const files: GenerationFile[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object" || !("path" in entry) || !("content" in entry)) throw new Error("AI returned a malformed file entry.");
    const candidate = entry as { path: unknown; content: unknown };
    if (typeof candidate.path !== "string" || !allowedPaths.has(candidate.path)) throw new Error("AI returned an unsupported project path.");
    if (typeof candidate.content !== "string" || !candidate.content.trim()) throw new Error("AI returned an empty project file: " + String(candidate.path));
    const bytes = new TextEncoder().encode(candidate.content).length;
    if (bytes > maxFileBytes) throw new Error("AI generated a file that is too large: " + candidate.path);
    totalBytes += bytes;
    if (totalBytes > maxTotalBytes) throw new Error("AI generated files exceed the project size limit.");
    if (seen.has(candidate.path)) throw new Error("AI returned a duplicate file path: " + candidate.path);
    seen.add(candidate.path);
    files.push({ path: candidate.path, content: candidate.content, ...(languageForPath(candidate.path) ? { language: languageForPath(candidate.path) } : {}) });
  }
  if (!seen.has("index.html")) throw new Error("AI response must include index.html.");
  if (!seen.has("src/styles.css")) files.push({ path: "src/styles.css", content: "/* Add styles in code mode. */", language: "css" });
  if (!seen.has("src/main.js")) files.push({ path: "src/main.js", content: "// Add interactions in code mode.", language: "javascript" });
  const order = ["index.html", "src/styles.css", "src/main.js"];
  return files.sort((a, b) => order.indexOf(a.path) - order.indexOf(b.path));
}

export async function generateDesignProject(input: GenerationRequest): Promise<GenerationResponse> {
  const prompt = input.prompt.trim();
  if (!input.userId.trim()) throw new Error("An authenticated user is required to generate a project.");
  if (!prompt) throw new Error("A design prompt is required.");
  if (prompt.length > 12_000) throw new Error("The design prompt is too long.");
  if (input.model && !/^[a-zA-Z0-9._:-]{1,120}$/.test(input.model)) throw new Error("The requested model identifier is invalid.");
  if (input.designContract && input.designContract.length > 24_000) throw new Error("The design contract is too long.");

  const existingFiles = (input.currentFiles ?? []).filter((file) => allowedPaths.has(file.path));
  const existingSource = existingFiles.length
    ? existingFiles.map((file) => "\n--- " + file.path + " ---\n" + file.content).join("\n").slice(0, 450_000)
    : "No existing project files. Create a polished responsive starting design.";
  const systemPrompt = [
    "You are DesignBuddy, an expert frontend designer and developer.",
    "If the user request names a selected expert or skill, adopt that role and apply its methods while completing the task.",
    "When a DESIGN.md brand contract is supplied, follow its colors, typography, spacing, component, and accessibility rules consistently.",
    "Return ONLY a JSON object with keys name and files.",
    "files must contain source files using only these exact paths: index.html, src/styles.css, src/main.js.",
    "index.html must be complete HTML and link to ./src/styles.css and ./src/main.js.",
    "Do not use external scripts, remote fonts, tracking, data exfiltration, or hidden forms. Use accessible, responsive semantic HTML and high-quality visual hierarchy.",
    "Keep interactions local to the page and do not claim backend features exist when they do not.",
    "Each file entry is {path:string,content:string}. Do not wrap JSON in markdown fences."
  ].join(" ");
  const response = await requestAI({
    userId: input.userId,
    apiKey: input.apiKey,
    provider: input.provider,
    model: input.model || process.env.AI_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini",
    systemPrompt,
    prompt: [
      "Project name: " + (input.projectName.trim() || "DesignBuddy project"),
      input.designContract ? "Selected DESIGN.md brand contract:\n" + input.designContract : "No brand contract was selected.",
      "User request: " + prompt,
      "Current source files:", existingSource,
      "Create updated working files that fulfill the user request. Return JSON only."
    ].join("\n")
  });
  const parsed = parseModelJSON(response.content);
  const files = validateFiles(parsed);
  const parsedName = parsed && typeof parsed === "object" && "name" in parsed && typeof (parsed as {name:unknown}).name === "string"
    ? (parsed as {name:string}).name.trim().slice(0, 80) : "";
  return { name: parsedName || input.projectName.trim().slice(0, 80) || "DesignBuddy project", files, model: response.model };
}
