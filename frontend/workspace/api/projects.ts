import type { DesignProject, ProjectFile } from "../models/project";
import { apiFetch, readJSON } from "../../../apps/web/src/api/client";
function parseProject(raw: unknown): DesignProject {
  if (!raw || typeof raw !== "object") throw Error("服务器项目格式无效。");
  const p = raw as Record<string, unknown>;
  if (
    !["id", "name", "prompt", "createdAt", "updatedAt"].every(
      (k) => typeof p[k] === "string",
    ) ||
    p.status !== "draft" ||
    !Array.isArray(p.files) ||
    !p.files.every(
      (f) =>
        f &&
        typeof f === "object" &&
        typeof f.path === "string" &&
        typeof f.content === "string",
    )
  )
    throw Error("服务器项目格式无效。");
  return {
    id: p.id as string,
    name: p.name as string,
    prompt: p.prompt as string,
    createdAt: p.createdAt as string,
    updatedAt: p.updatedAt as string,
    status: "draft",
    files: p.files.map((f) => ({
      path: f.path,
      content: f.content,
      language: (["html", "css", "javascript", "json", "text"].includes(
        f.language,
      )
        ? f.language
        : f.path.endsWith(".html")
          ? "html"
          : f.path.endsWith(".css")
            ? "css"
            : f.path.endsWith(".js")
              ? "javascript"
              : "text") as ProjectFile["language"],
    })),
    ...(typeof p.designSystemId === "string"
      ? { designSystemId: p.designSystemId }
      : {}),
    ...(typeof p.workspaceName === "string"
      ? { workspaceName: p.workspaceName }
      : {}),
    ...(typeof p.executionPolicy === "string"
      ? { executionPolicy: p.executionPolicy }
      : {}),
  };
}
export async function saveProjectToCloud(
  project: DesignProject,
): Promise<void> {
  const response = await apiFetch("/projects", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(project),
  });
  const body = await readJSON<{ saved?: boolean; project?: unknown }>(response);
  if (body.saved !== true) throw Error("服务器未确认项目已保存。");
  parseProject(body.project);
}
export async function listCloudProjects(): Promise<DesignProject[]> {
  const body = await readJSON<unknown>(
    await apiFetch("/projects", { headers: { Accept: "application/json" } }),
  );
  if (!Array.isArray(body)) throw Error("服务器没有返回项目列表。");
  return body.map(parseProject);
}
export async function getCloudProject(
  projectId: string,
): Promise<DesignProject> {
  return parseProject(
    await readJSON<unknown>(
      await apiFetch(`/projects/${encodeURIComponent(projectId)}`, {
        headers: { Accept: "application/json" },
      }),
    ),
  );
}
