import { apiFetch } from "../../../apps/web/src/api/client";

export interface GenerationFile {
  path: string;
  content: string;
  language?: "html" | "css" | "javascript" | "json" | "text";
}

export interface GenerateProjectRequest {
  prompt: string;
  projectName: string;
  model?: string;
  provider?: string;
  apiKey?: string;
  designContract?: string;
  currentFiles?: GenerationFile[];
}

export interface GenerateProjectResponse {
  name?: string;
  files: GenerationFile[];
  model?: string;
}

export async function generateProjectWithAI(input: GenerateProjectRequest, signal?: AbortSignal): Promise<GenerateProjectResponse> {
  const prompt = input.prompt.trim();
  if (!prompt) throw new Error("请先描述要生成或修改的内容。");

  const response = await apiFetch("/generation", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, prompt }),
    signal,
  });

  const body = await response.json().catch(() => ({} as { error?: string; message?: string }));
  if (!response.ok) {
    throw new Error(body.message || body.error || `AI 生成服务请求失败（HTTP ${response.status}）。请确认后端已配置并部署。`);
  }

  const result = body as GenerateProjectResponse;
  if (!Array.isArray(result.files) || !result.files.some((file) => file.path === "index.html" && file.content.trim())) {
    throw new Error("AI 服务未返回有效的网页文件，项目未更改。");
  }
  return result;
}

export type LocalCodingAgent = "codex" | "claude" | "opencode" | "gemini" | "cursor-agent";
export async function runLocalCodingAgent(projectId: string, agent: LocalCodingAgent, prompt: string, project: unknown): Promise<{ project: { files: GenerationFile[] }; output: string }> {
  const response = await apiFetch(`/projects/${encodeURIComponent(projectId)}/agent`, {
    method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ agent, prompt, project }),
  });
  const body = await response.json().catch(() => ({} as { error?: string }));
  if (!response.ok) throw new Error(body.error || `Local agent request failed (${response.status}).`);
  return body as { project: { files: GenerationFile[] }; output: string };
}
