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
    ...(typeof p.workspaceId === "string" ? { workspaceId: p.workspaceId } : {}),
    ...(typeof p.executionPolicy === "string"
      ? { executionPolicy: p.executionPolicy }
      : {}),
  };
}
/** A stored version of one project file. */
export type ProjectVersion = {
  id: string;
  projectId: string;
  path: string;
  version: number;
  content: string;
  hash: string;
  author: string;
  label: string;
  createdAt: number;
};

export type ProjectVersionConflict = {
  path: string;
  baseVersion: string;
  headVersion: string;
  headContent: string;
  headAuthor: string;
  headAt: number;
  headLabel: string;
};

export type ProjectAuditEntry = {
  id: string;
  projectId: string;
  actor: string;
  action: string;
  detail: string;
  createdAt: number;
};

/** Thrown when the server holds a newer version of a file the client edited. */
export class ProjectConflictError extends Error {
  conflicts: ProjectVersionConflict[];
  constructor(conflicts: ProjectVersionConflict[]) {
    super("服务器上已有更新的版本，请先处理冲突再保存。");
    this.conflicts = conflicts;
  }
}

export async function saveProjectToCloud(
  project: DesignProject,
  baseVersions?: Record<string, string>,
): Promise<Record<string, string>> {
  const response = await apiFetch("/projects", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(baseVersions ? { ...project, baseVersions } : project),
  });
  if (response.status === 409) {
    // A refused save is a normal outcome, not a transport failure: the conflicts
    // have to reach the editor so the person can choose how to continue.
    const body = (await response.json().catch(() => ({}))) as { conflicts?: ProjectVersionConflict[] };
    throw new ProjectConflictError(Array.isArray(body.conflicts) ? body.conflicts : []);
  }
  const body = await readJSON<{ saved?: boolean; project?: unknown; versions?: Record<string, string> }>(response);
  if (body.saved !== true) throw Error("服务器未确认项目已保存。");
  parseProject(body.project);
  return body.versions ?? {};
}

/** The stored history of a project and the newest version id per file. */
export async function listProjectVersions(
  projectId: string,
  path?: string,
): Promise<{ versions: ProjectVersion[]; heads: Record<string, string> }> {
  const query = path ? `?path=${encodeURIComponent(path)}` : "";
  const body = await readJSON<{ versions?: ProjectVersion[]; heads?: Record<string, string> }>(
    await apiFetch(`/projects/${encodeURIComponent(projectId)}/versions${query}`, {
      headers: { Accept: "application/json" },
    }),
  );
  return { versions: Array.isArray(body.versions) ? body.versions : [], heads: body.heads ?? {} };
}

/** Restore an old version. The restore itself is stored as a new version. */
export async function restoreProjectVersion(
  projectId: string,
  versionId: string,
): Promise<{ project: DesignProject; version: ProjectVersion; heads: Record<string, string> }> {
  const body = await readJSON<{ project?: unknown; version?: ProjectVersion; versions?: Record<string, string> }>(
    await apiFetch(`/projects/${encodeURIComponent(projectId)}/restore`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ versionId }),
    }),
  );
  return { project: parseProject(body.project), version: body.version as ProjectVersion, heads: body.versions ?? {} };
}

/** Who changed what, and when. */
export async function listProjectAudit(projectId: string): Promise<ProjectAuditEntry[]> {
  const body = await readJSON<{ entries?: ProjectAuditEntry[] }>(
    await apiFetch(`/projects/${encodeURIComponent(projectId)}/audit`, {
      headers: { Accept: "application/json" },
    }),
  );
  return Array.isArray(body.entries) ? body.entries : [];
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

/** A server controlled read-only share link. */
export type ProjectShare = {
  token: string;
  projectId: string;
  ownerId?: string;
  createdAt: number;
  expiresAt: number;
  revokedAt?: number | null;
  views?: number;
  lastViewedAt?: number | null;
};

/** Create a share link. The server decides the token and the expiry. */
export async function createProjectShare(
  projectId: string,
  expiresInDays = 7,
): Promise<ProjectShare> {
  const body = await readJSON<{ share?: ProjectShare }>(
    await apiFetch(`/projects/${encodeURIComponent(projectId)}/shares`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ expiresInDays }),
    }),
  );
  if (!body.share) throw Error("服务器没有返回分享链接。");
  return body.share;
}

export async function listProjectShares(projectId: string): Promise<ProjectShare[]> {
  const body = await readJSON<{ shares?: ProjectShare[] }>(
    await apiFetch(`/projects/${encodeURIComponent(projectId)}/shares`, {
      headers: { Accept: "application/json" },
    }),
  );
  return Array.isArray(body.shares) ? body.shares : [];
}

export async function revokeProjectShare(token: string): Promise<void> {
  await readJSON<{ revoked?: boolean }>(
    await apiFetch(`/shares/${encodeURIComponent(token)}`, { method: "DELETE" }),
  );
}

/** Read a public share. No account is needed: the token decides. */
export async function fetchPublicShare(token: string): Promise<{
  share: { token: string; projectId: string; createdAt: number; expiresAt: number };
  project: { name: string; prompt: string; files: ProjectFile[]; designSystemId?: string };
}> {
  const response = await fetch(`/api/shares/${encodeURIComponent(token)}`, {
    headers: { Accept: "application/json" },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(typeof body?.error === "string" ? body.error : "分享链接无效或已过期。");
  const project = body?.project;
  if (!project || !Array.isArray(project.files)) throw Error("分享内容格式无效。");
  return {
    share: body.share,
    project: {
      name: String(project.name ?? "共享项目"),
      prompt: String(project.prompt ?? ""),
      files: project.files,
      designSystemId: typeof project.designSystemId === "string" ? project.designSystemId : undefined,
    },
  };
}
