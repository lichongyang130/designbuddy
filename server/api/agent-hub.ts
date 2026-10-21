import { responseJSON } from "./workspace-backend";
import type { ApiProject, ProjectRepository } from "./http-handler";
import type { ProjectVersionStore } from "./project-versions";
import { canEditWorkspace, canViewWorkspace, type WorkspaceStore } from "./workspaces";
import { analyzeDesignProject, analyzeWorkspaceArchitecture, type AnalyzableFile } from "../agent/analyzer";
import type { MemoryCategory } from "../agent/memory-engine";
import { generateExecutionPlan } from "../agent/planner-engine";
import { runProjectQA } from "../agent/qa-agent";
import { AgentOrchestrator } from "../agent/orchestrator";

export interface AgentHubDependencies {
  orchestrator: AgentOrchestrator;
  projects: ProjectRepository;
  versions?: ProjectVersionStore;
  workspaces?: WorkspaceStore;
}

async function resolveProjectAccess(
  projects: ProjectRepository,
  projectId: string,
  callerId: string,
  workspaces?: WorkspaceStore,
): Promise<{
  found: boolean;
  ownerId: string;
  project: ApiProject | null;
  canRead: boolean;
  canWrite: boolean;
}> {
  const direct = await projects.getById(callerId, projectId);
  if (direct) {
    return { found: true, ownerId: callerId, project: direct, canRead: true, canWrite: true };
  }
  if (projects.findById) {
    const cross = await projects.findById(projectId);
    if (cross) {
      const role = cross.project.workspaceId && workspaces
        ? workspaces.roleFor(cross.project.workspaceId, callerId)
        : null;
      return {
        found: true,
        ownerId: cross.ownerId,
        project: cross.project,
        canRead: canViewWorkspace(role),
        canWrite: canEditWorkspace(role),
      };
    }
  }
  return { found: false, ownerId: callerId, project: null, canRead: false, canWrite: false };
}

function normalizeInlineFiles(raw: unknown): AnalyzableFile[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 200) return null;
  const out: AnalyzableFile[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const f = item as Record<string, unknown>;
    if (typeof f.path !== "string" || !f.path.trim() || f.path.length > 240) return null;
    if (typeof f.content !== "string" || f.content.length > 1_000_000) return null;
    out.push({ path: f.path.trim(), content: f.content, language: typeof f.language === "string" ? f.language : undefined });
  }
  return out;
}

function toGenerationFiles(files: AnalyzableFile[]): ApiProject["files"] {
  return files.map((f) => ({
    path: f.path,
    content: f.content,
    language: (f.path.endsWith(".html")
      ? "html"
      : f.path.endsWith(".css")
        ? "css"
        : /\.(js|mjs|cjs)$/.test(f.path)
          ? "javascript"
          : "html") as ApiProject["files"][number]["language"],
  }));
}

export function createAgentHubHandler(deps: AgentHubDependencies) {
  const { orchestrator, projects, versions, workspaces } = deps;

  return async function handleAgentCore(request: Request, callerId: string): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    // 1. Live static repository module architecture graph
    if (path === "/api/agent-core/architecture" && method === "GET") {
      return responseJSON(analyzeWorkspaceArchitecture());
    }

    // 2. Project Analyzer
    if (path === "/api/agent-core/analyze" && method === "POST") {
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body) return responseJSON({ error: "请求体必须为有效 JSON。" }, 400);
      if (typeof body.projectId === "string" && body.projectId.trim()) {
        const access = await resolveProjectAccess(projects, body.projectId.trim(), callerId, workspaces);
        if (!access.found || !access.project || !access.canRead) {
          return responseJSON({ error: "未找到该项目或无访问权限。" }, access.found ? 403 : 404);
        }
        return responseJSON(analyzeDesignProject({ id: access.project.id, name: access.project.name, files: access.project.files }));
      }
      const files = normalizeInlineFiles(body.files);
      if (!files) return responseJSON({ error: "请提供有效的 projectId 或非空 files 数组。" }, 400);
      return responseJSON(
        analyzeDesignProject({
          id: typeof body.id === "string" ? body.id : "inline-project",
          name: typeof body.name === "string" ? body.name : "内联项目",
          files,
        }),
      );
    }

    // 3. Planner Agent
    if (path === "/api/agent-core/plan" && method === "POST") {
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body || typeof body.goal !== "string" || !body.goal.trim()) {
        return responseJSON({ error: "请提供有效的任务目标 goal。" }, 400);
      }
      let targetId = "inline-project";
      let targetName = "内联项目";
      let targetFiles: AnalyzableFile[] | null = null;
      if (typeof body.projectId === "string" && body.projectId.trim()) {
        const access = await resolveProjectAccess(projects, body.projectId.trim(), callerId, workspaces);
        if (!access.found || !access.project || !access.canRead) {
          return responseJSON({ error: "未找到该项目或无访问权限。" }, access.found ? 403 : 404);
        }
        targetId = access.project.id;
        targetName = access.project.name;
        targetFiles = access.project.files;
      } else {
        targetFiles = normalizeInlineFiles(body.files) ?? [
          { path: "index.html", content: "<!doctype html><html><head><title>App</title></head><body></body></html>" },
        ];
      }
      const analysis = analyzeDesignProject({ id: targetId, name: targetName, files: targetFiles });
      const memories = orchestrator.memory.selectRelevantContext(callerId, targetId === "inline-project" ? "" : targetId, body.goal);
      try {
        const plan = await generateExecutionPlan({
          userId: callerId,
          goal: body.goal,
          analysis,
          memories,
          allowExternalAi: body.allowExternalAi === true,
          apiKey: typeof body.apiKey === "string" ? body.apiKey : undefined,
          provider: typeof body.provider === "string" ? body.provider : undefined,
          baseUrl: typeof body.baseUrl === "string" ? body.baseUrl : undefined,
          model: typeof body.model === "string" ? body.model : undefined,
        });
        return responseJSON({ plan, analysis });
      } catch (err) {
        return responseJSON({ error: err instanceof Error ? err.message : "生成计划失败。" }, 400);
      }
    }

    // 4. QA Agent standalone check & diff
    if (path === "/api/agent-core/qa" && method === "POST") {
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body) return responseJSON({ error: "请求体必须为有效 JSON。" }, 400);
      let targetId = "inline-project";
      let targetName = "内联项目";
      let files: AnalyzableFile[] | null = null;
      if (typeof body.projectId === "string" && body.projectId.trim()) {
        const access = await resolveProjectAccess(projects, body.projectId.trim(), callerId, workspaces);
        if (!access.found || !access.project || !access.canRead) {
          return responseJSON({ error: "未找到该项目或无访问权限。" }, access.found ? 403 : 404);
        }
        targetId = access.project.id;
        targetName = access.project.name;
        files = access.project.files;
      } else {
        files = normalizeInlineFiles(body.files);
      }
      if (!files) return responseJSON({ error: "请提供有效的 projectId 或 files。" }, 400);
      const baselineFiles = normalizeInlineFiles(body.baselineFiles) ?? undefined;
      return responseJSON(runProjectQA({ projectId: targetId, projectName: targetName, files, baselineFiles }));
    }

    // 5. Memory Engine CRUD (isolated by callerId + projectId)
    if (path === "/api/agent-core/memories" && method === "GET") {
      const projectId = url.searchParams.get("projectId") ?? undefined;
      const includeGlobal = url.searchParams.get("includeGlobal") !== "false";
      const category = (url.searchParams.get("category") ?? undefined) as MemoryCategory | undefined;
      const query = url.searchParams.get("q") ?? undefined;
      return responseJSON({
        memories: orchestrator.memory.list(callerId, { projectId, includeGlobal, category, query }),
      });
    }

    if (path === "/api/agent-core/memories" && method === "POST") {
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body) return responseJSON({ error: "请求体必须为有效 JSON。" }, 400);
      if (typeof body.projectId === "string" && body.projectId.trim()) {
        const access = await resolveProjectAccess(projects, body.projectId.trim(), callerId, workspaces);
        if (access.found && !access.canWrite) {
          return responseJSON({ error: "无权写入该项目的记忆约束。" }, 403);
        }
      }
      try {
        const memory = orchestrator.memory.create(callerId, {
          projectId: typeof body.projectId === "string" ? body.projectId : "",
          category: typeof body.category === "string" ? (body.category as MemoryCategory) : undefined,
          title: String(body.title ?? ""),
          content: String(body.content ?? ""),
          tags: Array.isArray(body.tags) ? (body.tags as string[]) : undefined,
          pinned: Boolean(body.pinned),
        });
        return responseJSON({ memory }, 201);
      } catch (err) {
        return responseJSON({ error: err instanceof Error ? err.message : "创建记忆失败。" }, 400);
      }
    }

    const memMatch = path.match(/^\/api\/agent-core\/memories\/([^/]+)$/);
    if (memMatch) {
      const memoryId = decodeURIComponent(memMatch[1]);
      if (method === "PATCH") {
        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        if (!body) return responseJSON({ error: "请求体必须为有效 JSON。" }, 400);
        try {
          const updated = orchestrator.memory.update(callerId, memoryId, {
            category: typeof body.category === "string" ? (body.category as MemoryCategory) : undefined,
            title: typeof body.title === "string" ? body.title : undefined,
            content: typeof body.content === "string" ? body.content : undefined,
            tags: Array.isArray(body.tags) ? (body.tags as string[]) : undefined,
            pinned: typeof body.pinned === "boolean" ? body.pinned : undefined,
          });
          if (!updated) return responseJSON({ error: "未找到该记忆条目。" }, 404);
          return responseJSON({ memory: updated });
        } catch (err) {
          return responseJSON({ error: err instanceof Error ? err.message : "更新记忆失败。" }, 400);
        }
      }
      if (method === "DELETE") {
        const deleted = orchestrator.memory.delete(callerId, memoryId);
        if (!deleted) return responseJSON({ error: "未找到该记忆条目。" }, 404);
        return responseJSON({ ok: true });
      }
    }

    // 6. Agent Orchestrator Runs: list / execute / detail / cancel / retry / rollback
    if (path === "/api/agent-core/runs" && method === "GET") {
      const projectId = url.searchParams.get("projectId") || undefined;
      return responseJSON({ runs: orchestrator.listRuns(callerId, projectId) });
    }

    if (path === "/api/agent-core/runs" && method === "POST") {
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body || typeof body.goal !== "string" || !body.goal.trim()) {
        return responseJSON({ error: "请填写有效的任务目标 goal。" }, 400);
      }
      if (typeof body.projectId !== "string" || !body.projectId.trim()) {
        return responseJSON({ error: "请指定目标项目 projectId。" }, 400);
      }
      const access = await resolveProjectAccess(projects, body.projectId.trim(), callerId, workspaces);
      if (!access.found || !access.project || !access.canWrite) {
        return responseJSON({ error: "未找到该项目或没有写入权限。" }, access.found ? 403 : 404);
      }
      const targetProject = access.project;
      const targetOwnerId = access.ownerId;
      const idempotencyKey =
        (request.headers.get("idempotency-key") || (typeof body.idempotencyKey === "string" ? body.idempotencyKey : ""))
          .trim()
          .slice(0, 80) || undefined;
      const run = await orchestrator.executeRun({
        ownerId: callerId,
        project: targetProject,
        goal: body.goal,
        idempotencyKey,
        pauseBeforeApply: body.pauseBeforeApply === true,
        allowExternalAi: body.allowExternalAi === true,
        apiKey: typeof body.apiKey === "string" ? body.apiKey : undefined,
        provider: typeof body.provider === "string" ? body.provider : undefined,
        baseUrl: typeof body.baseUrl === "string" ? body.baseUrl : undefined,
        model: typeof body.model === "string" ? body.model : undefined,
        versions,
        persistProject: async (updatedFiles) => {
          await projects.save(targetOwnerId, {
            ...targetProject,
            files: toGenerationFiles(updatedFiles),
            updatedAt: new Date().toISOString(),
          });
        },
      });
      return responseJSON({ run }, run.status === "failed" ? 422 : 200);
    }

    const runAction = path.match(/^\/api\/agent-core\/runs\/([^/]+)(?:\/(cancel|retry|rollback|approve|reject))?$/);
    if (runAction) {
      const runId = decodeURIComponent(runAction[1]);
      const subAction = runAction[2];
      if (!subAction && method === "GET") {
        const run = orchestrator.getRun(callerId, runId);
        if (!run) return responseJSON({ error: "未找到该执行记录。" }, 404);
        return responseJSON({ run });
      }
      if (subAction === "approve" && method === "POST") {
        const existing = orchestrator.getRun(callerId, runId);
        if (!existing) return responseJSON({ error: "未找到该执行记录。" }, 404);
        const access = await resolveProjectAccess(projects, existing.projectId, callerId, workspaces);
        if (!access.found || !access.project || !access.canWrite) {
          return responseJSON({ error: "目标项目不存在或无写入权限。" }, access.found ? 403 : 404);
        }
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown> | null;
        const fileOverrides = body?.files !== undefined ? normalizeInlineFiles(body.files) : undefined;
        if (body?.files !== undefined && !fileOverrides) {
          return responseJSON({ error: "提供的 files 覆盖内容格式无效。" }, 400);
        }
        const targetProject = access.project;
        const targetOwnerId = access.ownerId;
        try {
          const approved = await orchestrator.approveRun({
            ownerId: callerId,
            runId,
            projectName: targetProject.name,
            fileOverrides: fileOverrides ?? undefined,
            note: typeof body?.note === "string" ? body.note : undefined,
            versions,
            persistProject: async (updatedFiles) => {
              await projects.save(targetOwnerId, {
                ...targetProject,
                files: toGenerationFiles(updatedFiles),
                updatedAt: new Date().toISOString(),
              });
            },
          });
          return responseJSON({ run: approved });
        } catch (err) {
          return responseJSON(
            { error: err instanceof Error ? err.message : "批准运行失败。" },
            422,
          );
        }
      }
      if (subAction === "reject" && method === "POST") {
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown> | null;
        try {
          const rejected = orchestrator.rejectRun(
            callerId,
            runId,
            typeof body?.reason === "string" ? body.reason : undefined,
          );
          if (!rejected) return responseJSON({ error: "未找到该执行记录。" }, 404);
          return responseJSON({ run: rejected });
        } catch (err) {
          return responseJSON(
            { error: err instanceof Error ? err.message : "驳回运行失败。" },
            400,
          );
        }
      }
      if (subAction === "cancel" && method === "POST") {
        const cancelled = orchestrator.cancelRun(callerId, runId);
        if (!cancelled) return responseJSON({ error: "未找到该执行记录。" }, 404);
        return responseJSON({ run: cancelled });
      }
      if (subAction === "retry" && method === "POST") {
        const existing = orchestrator.getRun(callerId, runId);
        if (!existing) return responseJSON({ error: "未找到该执行记录。" }, 404);
        const access = await resolveProjectAccess(projects, existing.projectId, callerId, workspaces);
        if (!access.found || !access.project || !access.canWrite) {
          return responseJSON({ error: "目标项目不存在或无写入权限。" }, access.found ? 403 : 404);
        }
        const targetProject = access.project;
        const targetOwnerId = access.ownerId;
        const retried = await orchestrator.executeRun({
          ownerId: callerId,
          project: targetProject,
          goal: existing.goal,
          versions,
          retryOf: existing,
          persistProject: async (updatedFiles) => {
            await projects.save(targetOwnerId, {
              ...targetProject,
              files: toGenerationFiles(updatedFiles),
              updatedAt: new Date().toISOString(),
            });
          },
        });
        return responseJSON({ run: retried }, retried.status === "failed" ? 422 : 200);
      }
      if (subAction === "rollback" && method === "POST") {
        const existing = orchestrator.getRun(callerId, runId);
        if (!existing) return responseJSON({ error: "未找到该执行记录。" }, 404);
        const access = await resolveProjectAccess(projects, existing.projectId, callerId, workspaces);
        if (!access.found || !access.project || !access.canWrite) {
          return responseJSON({ error: "目标项目不存在或无写入权限。" }, access.found ? 403 : 404);
        }
        const restoredFiles = toGenerationFiles(existing.baselineFiles);
        await projects.save(access.ownerId, {
          ...access.project,
          files: restoredFiles,
          updatedAt: new Date().toISOString(),
        });
        if (versions) {
          for (const f of restoredFiles) {
            versions.commit({
              projectId: access.project.id,
              ownerId: callerId,
              path: f.path,
              content: f.content,
              author: callerId,
              label: `回滚运行 ${existing.id.slice(0, 8)}`,
            });
          }
        }
        const marked = orchestrator.markRolledBack(callerId, runId);
        return responseJSON({ run: marked, files: restoredFiles });
      }
    }

    return responseJSON({ error: "未找到该 Agent Core 接口。" }, 404);
  };
}
