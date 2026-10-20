import { builtinExecutionExpert } from "../../shared/expertExecution";
import { ExpertExecutionError, type ExpertExecutionService } from "./expert-execution";
import type { SkillService } from "../skills/service";
import { matchTaskExpert } from "./expert-match";
import { generateDesignProject, type GenerationFile, type GenerationRequest } from "./generation";
import { createProjectMCPServer } from "../mcp/project-tools";
import { RealtimeCollaborationHub, type CollaborationEventStore, type CollaborationEventType } from "../collaboration/realtime-hub";
import { transcodeWebMToMp4 } from "./video-transcode";
import { generateStudioArtifact } from "./studio-generation";
import { runAgentOnProject } from "../agent/project-runner";
import type { CodingAgentId } from "../agent/cli-runtime";
import { resolve } from "node:path";
import type { ProjectMembershipStore, ProjectMemberRole } from "./project-memberships";
import { proxyAIStream } from "./ai-proxy";
import { streamTaskChat, TaskChatValidationError, type TaskChatRequest } from "./chat";
import { changedFiles, type ProjectVersionStore, type VersionConflict } from "./project-versions";
import { ProjectShareStore } from "./project-shares";
import { AssetInputError, AssetLimitError, AssetStore, type AssetVisibility } from "./assets";
import {
  CommunityInputError,
  CommunityLimitError,
  CommunityTemplateStore,
  type CommunityVisibility,
} from "./community-templates";
import {
  WorkflowEngine,
  WorkflowInputError,
  workflowCatalog,
} from "./workflows";
import { AdminError, AdminService, isAdmin } from "./admin";
import {
  canEditWorkspace,
  canManageMembers,
  canViewWorkspace,
  WorkspaceInputError,
  WorkspacePermissionError,
  type WorkspaceRole,
  type WorkspaceStore,
} from "./workspaces";

export interface ApiPrincipal {
  id: string;
  /** The account name, when the caller signed in with an account. */
  username?: string;
}

export interface ApiProject {
  id: string;
  name: string;
  prompt: string;
  files: GenerationFile[];
  designSystemId?: string;
  workspaceName?: string;
  /** The workspace this project belongs to, if any. */
  workspaceId?: string;
  executionPolicy?: string;
  createdAt: string;
  updatedAt: string;
  status: "draft";
}

export interface ProjectRepository {
  listByOwner(ownerId: string): Promise<ApiProject[]>;
  getById(ownerId: string, projectId: string): Promise<ApiProject | null>;
  save(ownerId: string, project: ApiProject): Promise<ApiProject>;
  delete(ownerId: string, projectId: string): Promise<boolean>;
  /** Find a project by id across owners. Needed to apply workspace level access. */
  findById?(projectId: string): Promise<{ ownerId: string; project: ApiProject } | null>;
  /** The projects that belong to a workspace, with the id of their owner. */
  listByWorkspace?(workspaceId: string): Promise<Array<{ ownerId: string; project: ApiProject }>>;
}

export interface ApiHandlerOptions {
  skills?: SkillService;
  expertExecution?: ExpertExecutionService;
  authenticate(request: Request): Promise<ApiPrincipal | null>;
  projects: ProjectRepository;
  /** Server controlled read-only share links. */
  shares?: ProjectShareStore;
  collaboration?: RealtimeCollaborationHub;
  collaborationStore?: CollaborationEventStore;
  localAgentWorkspaceRoot?: string;
  memberships?: ProjectMembershipStore;
  /** Source version history and audit trail. */
  versions?: ProjectVersionStore;
  /** Workspaces and organisation members. */
  workspaces?: WorkspaceStore;
  /** Server side asset library for uploaded files. */
  assets?: AssetStore;
  /** Templates published to the community by their authors. */
  community?: CommunityTemplateStore;
  /** The workflow recipes and the runs they produce. */
  workflows?: WorkflowEngine;
  /** The operator console. */
  admin?: AdminService;
  canAccessProject?(principal: ApiPrincipal, projectId: string): Promise<boolean>;
  corsOrigin?: string;
}

/** Read the base versions a client claims to have started from. */
function readBaseVersions(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const source = value as Record<string, unknown>;
  const base = source.baseVersions;
  if (!base || typeof base !== "object") return {};
  const result: Record<string, string> = {};
  for (const [path, version] of Object.entries(base as Record<string, unknown>)) {
    // An empty string is meaningful: the client holds a copy without a server base.
    if (typeof version === "string") result[path] = version;
  }
  return result;
}

function findConflicts(
  store: ProjectVersionStore,
  projectId: string,
  body: unknown,
  files: { path: string; content: string }[] = [],
): VersionConflict[] {
  const contents: Record<string, string> = {};
  for (const file of files) contents[file.path] = file.content;
  return store.detectConflicts(projectId, readBaseVersions(body), contents);
}

/** Map a workspace store error to a status code. */
function workspaceErrorStatus(error: unknown): number {
  if (error instanceof WorkspacePermissionError) return 403;
  if (error instanceof WorkspaceInputError) return 400;
  return 400;
}

function workspaceErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "工作空间操作失败。";
}

function json(data: unknown, status = 200, origin?: string): Response {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Vary", "Origin");
  }
  return new Response(JSON.stringify(data), { status, headers });
}

async function readJson(request: Request, limit = 2_500_000): Promise<Record<string, unknown>> {
  const type = request.headers.get("content-type") || "";
  if (!type.toLowerCase().includes("application/json")) throw new Error("Content-Type must be application/json.");
  const raw = await readBytesLimited(request, limit);
  let body: unknown;
  try { body = JSON.parse(new TextDecoder().decode(raw)); }
  catch { throw new Error("Request body must contain valid JSON."); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Request body must be a JSON object.");
  return body as Record<string, unknown>;
}

async function readBytesLimited(request: Request, limit: number): Promise<Uint8Array> {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) { await reader.cancel(); throw new Error(`Request exceeds the ${Math.floor(limit / 1_000_000)} MB limit.`); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}

function asProject(value: Record<string, unknown>): ApiProject {
  if (typeof value.id !== "string" || !value.id.trim()) throw new Error("Project id is required.");
  if (typeof value.name !== "string" || !value.name.trim()) throw new Error("Project name is required.");
  if (typeof value.prompt !== "string" || !Array.isArray(value.files)) throw new Error("Project prompt and files are required.");
  if (value.files.length > 200) throw new Error("Project contains too many files.");

  let total = 0;
  const files = value.files.map((item): GenerationFile => {
    if (!item || typeof item !== "object" || !("path" in item) || !("content" in item)) throw new Error("Invalid project file.");
    const file = item as { path: unknown; content: unknown };
    if (typeof file.path !== "string" || !file.path.trim() || file.path.startsWith("/") ||
        file.path.replace(/\\/g, "/").split("/").includes("..")) {
      throw new Error("Project contains an unsafe file path.");
    }
    if (typeof file.content !== "string") throw new Error("Project file content must be text.");
    total += new TextEncoder().encode(file.content).length;
    if (total > 2_000_000) throw new Error("Project source exceeds the 2 MB limit.");
    return { path: file.path, content: file.content };
  });

  const now = new Date().toISOString();
  return {
    id: value.id.trim(),
    name: value.name.trim().slice(0, 120),
    prompt: value.prompt.slice(0, 12_000),
    files,
    ...(typeof value.designSystemId === "string" ? { designSystemId: value.designSystemId.slice(0, 120) } : {}),
    ...(typeof value.workspaceName === "string" ? { workspaceName: value.workspaceName.slice(0, 120) } : {}),
    ...(typeof value.workspaceId === "string" && value.workspaceId.trim()
      ? { workspaceId: value.workspaceId.trim().slice(0, 120) }
      : {}),
    ...(typeof value.executionPolicy === "string" ? { executionPolicy: value.executionPolicy.slice(0, 120) } : {}),
    createdAt: typeof value.createdAt === "string" ? value.createdAt : now,
    updatedAt: now,
    status: "draft",
  };
}

/**
 * Mount this handler under /api in the host server. A real session authenticator
 * and durable project repository must be supplied by the deployment.
 */
export function createApiHandler(options: ApiHandlerOptions): (request: Request) => Promise<Response> {
  const collaboration = options.collaboration ?? new RealtimeCollaborationHub(options.collaborationStore);
  /** The people who share a workspace with this account. */
  const workspacePeerIds = (viewerId: string): string[] => {
    if (!options.workspaces) return [];
    const peers = new Set<string>();
    for (const workspace of options.workspaces.listFor(viewerId)) {
      for (const member of options.workspaces.listMembers(workspace.id)) peers.add(member.userId);
    }
    return [...peers];
  };
  /** The workspace a project belongs to and the role the person has in it. */
  async function workspaceAccessFor(
    principal: ApiPrincipal,
    projectId: string,
  ): Promise<{ workspaceId: string; role: WorkspaceRole; ownerId: string } | null> {
    if (!options.workspaces || !options.projects.findById) return null;
    const found = await options.projects.findById(projectId);
    const workspaceId = found?.project.workspaceId;
    if (!found || !workspaceId) return null;
    const role = options.workspaces.roleFor(workspaceId, principal.id);
    return role ? { workspaceId, role, ownerId: found.ownerId } : null;
  }
  /**
   * A project may only be written into a workspace the person may edit, and only
   * its owner may move it in or out of a workspace.
   */
  function checkWorkspaceWrite(
    principal: ApiPrincipal,
    project: ApiProject,
    existing: ApiProject | null,
    ownerId: string | null,
  ): { error: string; status: number } | null {
    const target = project.workspaceId;
    if (target) {
      const role = options.workspaces?.roleFor(target, principal.id) ?? null;
      if (!role) return { error: "你不是该工作空间的成员，无法把项目存进去。", status: 403 };
      if (!canEditWorkspace(role)) return { error: "你在该工作空间里只有只读权限。", status: 403 };
    }
    if (existing?.workspaceId && existing.workspaceId !== target && ownerId !== principal.id)
      return { error: "只有项目所有者可以改变它所属的工作空间。", status: 403 };
    return null;
  }
  async function projectOwnerFor(principal: ApiPrincipal, projectId: string): Promise<string | null> {
    if (await options.projects.getById(principal.id, projectId)) return principal.id;
    const ownerId = options.memberships?.ownerFor(projectId);
    if (ownerId && options.memberships?.roleFor(ownerId, projectId, principal.id)) return ownerId;
    const workspace = await workspaceAccessFor(principal, projectId);
    return workspace ? workspace.ownerId : null;
  }
  /** May the person change the project? A workspace role counts like a direct share. */
  async function canEditProject(principal: ApiPrincipal, ownerId: string, projectId: string): Promise<boolean> {
    if (ownerId === principal.id) return true;
    const direct = options.memberships?.roleFor(ownerId, projectId, principal.id);
    if (direct === "editor") return true;
    if (direct) return false;
    const workspace = await workspaceAccessFor(principal, projectId);
    return Boolean(workspace && canEditWorkspace(workspace.role));
  }
  /** Tell the person why the project is read-only for them. */
  async function projectEditError(principal: ApiPrincipal, projectId: string): Promise<string> {
    const workspace = await workspaceAccessFor(principal, projectId);
    if (workspace && !canEditWorkspace(workspace.role))
      return "你在该工作空间里只有只读权限，无法修改这个项目。";
    return "Editor access is required to update this shared project.";
  }
  async function writableProjectOwner(principal: ApiPrincipal, projectId: string): Promise<string | null> {
    const ownerId = await projectOwnerFor(principal, projectId);
    if (!ownerId) return null;
    if (ownerId === principal.id) return ownerId;
    const direct = options.memberships?.roleFor(ownerId, projectId, principal.id);
    if (direct === "editor") return ownerId;
    if (direct) return null;
    const workspace = await workspaceAccessFor(principal, projectId);
    return workspace && canEditWorkspace(workspace.role) ? ownerId : null;
  }
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const origin = request.headers.get("origin");
    if (request.method === "OPTIONS") {
      const headers = new Headers({
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "600",
      });
      if (options.corsOrigin && origin === options.corsOrigin) {
        headers.set("Access-Control-Allow-Origin", options.corsOrigin);
        headers.set("Access-Control-Allow-Credentials", "true");
        headers.set("Vary", "Origin");
      }
      return new Response(null, { status: 204, headers });
    }

    if (!url.pathname.startsWith("/api/")) return json({ error: "Not found." }, 404);
    if (options.corsOrigin && origin && origin !== options.corsOrigin) return json({ error: "Origin not allowed." }, 403);

    // Skill metadata is a public, read-only catalogue. Keep discovery available even before a guest session exists;
    // plans, uploads, run records, and execution stay behind authentication below.
    if (url.pathname === "/api/skill-runtime" && request.method === "GET") {
      return options.skills
        ? options.skills.handle(request, "public-catalog")
        : json({ error: "技能执行服务尚未启用。" }, 503);
    }

    // A share link is public by design: the token decides, and the server still
    // decides when it stops working. Only a read-only snapshot is handed out.
    const publicShare = url.pathname.match(/^\/api\/shares\/([A-Za-z0-9_-]{16,64})$/);
    if (publicShare && request.method === "GET") {
      if (!options.shares) return json({ error: "分享服务尚未启用。" }, 503, options.corsOrigin);
      const share = options.shares.get(publicShare[1]);
      if (!share) return json({ error: "分享链接不存在。" }, 404, options.corsOrigin);
      if (share.revokedAt) return json({ error: "分享链接已被作者撤销。" }, 410, options.corsOrigin);
      if (share.expiresAt <= Date.now()) return json({ error: "分享链接已过期。" }, 410, options.corsOrigin);
      const project = await options.projects.getById(share.ownerId, share.projectId);
      if (!project) return json({ error: "分享的项目已不存在。" }, 404, options.corsOrigin);
      options.shares.recordView(share.token);
      return json(
        {
          share: { token: share.token, projectId: share.projectId, createdAt: share.createdAt, expiresAt: share.expiresAt },
          project: { name: project.name, prompt: project.prompt, files: project.files, designSystemId: project.designSystemId },
        },
        200,
        options.corsOrigin,
      );
    }

    let principal: ApiPrincipal | null;
    try {
      principal = await options.authenticate(request);
    } catch {
      return json({ error: "Unable to authenticate request." }, 401, options.corsOrigin);
    }
    if (!principal?.id) return json({ error: "Authentication required." }, 401, options.corsOrigin);

    try {
      if (url.pathname === "/api/expert-bindings" || url.pathname.startsWith("/api/expert-bindings/") || url.pathname === "/api/expert-task-plans" || url.pathname.startsWith("/api/expert-task-plans/")) {
        const service = options.expertExecution;
        if (!service) return json({ error: "专家执行服务尚未启用。" }, 503);
        if (url.pathname === "/api/expert-bindings") {
          if (request.method === "GET") return json({ bindings: service.bindings(principal.id) });
          if (request.method === "POST") return json({ binding: service.bind(principal.id, await readJson(request, 16000)) }, 201);
        }
        const bindingPath = url.pathname.match(/^\/api\/expert-bindings\/([A-Za-z0-9_-]{8,80})$/);
        if (bindingPath && request.method === "DELETE") return service.removeBinding(principal.id, bindingPath[1]) ? json({ deleted: true }) : json({ error: "绑定不存在。" }, 404);
        if (url.pathname === "/api/expert-task-plans") {
          if (request.method === "POST") return json({ plan: service.create(principal.id, await readJson(request, 24000)) });
          if (request.method === "GET") {
            const taskId = url.searchParams.get("taskId");
            if (!taskId || !/^[A-Za-z0-9_.:-]{1,100}$/.test(taskId)) throw new ExpertExecutionError("需要有效的任务ID。");
            return json(service.list(principal.id, taskId));
          }
        }
        const path = url.pathname.match(/^\/api\/expert-task-plans\/([a-f0-9-]{36})(?:\/(execute|word-draft))?$/);
        if (path && !path[2] && request.method === "GET") return json({ plan: service.get(principal.id, path[1]) });
        if (path && path[2] === "word-draft" && request.method === "DELETE") return json({ deleted: service.removeWordDrafts(principal.id, path[1]) });
        if (path && path[2] === "word-draft" && request.method === "POST") return json(await service.wordDraft(principal.id, path[1], await readJson(request, 100000)));
        if (path && path[2] === "execute" && request.method === "POST") {
          if (!options.skills) return json({ error: "技能服务尚未启用。" }, 503);
          return await service.execute(principal.id, path[1], request, options.skills, options.workflows);
        }
        return json({ error: "不支持的专家任务操作。" }, 405);
      }
      if (url.pathname === "/api/skill-plans" || url.pathname.startsWith("/api/skill-plans/") || url.pathname === "/api/skill-runs" || url.pathname.startsWith("/api/skill-runs/")) {
        return options.skills ? options.skills.handle(request, principal.id) : json({ error: "技能执行服务尚未启用。" }, 503);
      }
      if (url.pathname === "/api/expert-match" && request.method === "POST") {
        return json(await matchTaskExpert(await readJson(request), request.signal), 200, options.corsOrigin);
      }
      if (url.pathname === "/api/chat" && request.method === "POST") {
        const body = await readJson(request);
        const expert = typeof body.expertId === "string" ? options.expertExecution?.expert(principal.id, body.expertId) || builtinExecutionExpert(body.expertId) : undefined;
        if (expert && body.expertVersion !== undefined && body.expertVersion !== expert.configVersion) return json({ error: "专家配置版本已变化，请核对当前专家后继续；未发送模型。" }, 409);
        const response = await streamTaskChat({
          expertProfile: expert,
          messages: body.messages as TaskChatRequest["messages"],
          model: typeof body.model === "string" ? body.model : undefined,
          provider: typeof body.provider === "string" ? body.provider : undefined,
          apiKey: typeof body.apiKey === "string" ? body.apiKey : undefined,
          baseUrl: typeof body.baseUrl === "string" ? body.baseUrl : undefined,
          options: body.options && typeof body.options === "object" ? body.options as TaskChatRequest["options"] : undefined,
          userId: principal.id,
        }, request.signal);
        if (options.corsOrigin) {
          response.headers.set("Access-Control-Allow-Origin", options.corsOrigin);
          response.headers.set("Access-Control-Allow-Credentials", "true");
          response.headers.set("Vary", "Origin");
        }
        return response;
      }

      if (url.pathname === "/api/generation" && request.method === "POST") {
        const body = await readJson(request);
        if (typeof body.prompt !== "string" || typeof body.projectName !== "string") {
          return json({ error: "prompt and projectName are required." }, 400, options.corsOrigin);
        }
        const currentFiles = Array.isArray(body.currentFiles) ? body.currentFiles as GenerationFile[] : [];
        const result = await generateDesignProject({
          userId: principal.id,
          prompt: body.prompt,
          projectName: body.projectName,
          model: typeof body.model === "string" ? body.model : undefined,
          designContract: typeof body.designContract === "string" ? body.designContract : undefined,
          apiKey: typeof body.apiKey === "string" ? body.apiKey : undefined,
          provider: typeof body.provider === "string" ? body.provider : undefined,
          baseUrl: typeof body.baseUrl === "string" ? body.baseUrl : undefined,
          options: body.options && typeof body.options === "object" ? body.options as GenerationRequest["options"] : undefined,
          currentFiles,
        });
        return json(result, 200, options.corsOrigin);
      }

      if (url.pathname === "/api/studio/generation" && request.method === "POST") {
        const body = await readJson(request);
        if (typeof body.kind !== "string" || typeof body.title !== "string" || typeof body.prompt !== "string") return json({ error: "kind, title, and prompt are required." }, 400, options.corsOrigin);
        const result = await generateStudioArtifact({
          userId: principal.id,
          kind: body.kind as "prototype" | "slides" | "image" | "video",
          title: body.title,
          prompt: body.prompt,
          designContract: typeof body.designContract === "string" ? body.designContract : undefined,
          model: typeof body.model === "string" ? body.model : undefined,
          apiKey: typeof body.apiKey === "string" ? body.apiKey : undefined,
          provider: typeof body.provider === "string" ? body.provider : undefined,
        });
        return json(result, 200, options.corsOrigin);
      }

      const proxyPath = url.pathname.match(/^\/api\/proxy\/([a-z0-9-]+)\/stream$/);
      if (proxyPath && request.method === "POST") {
        const body = await readJson(request);
        if (typeof body.apiKey !== "string" || typeof body.model !== "string" || !Array.isArray(body.messages)) return json({ error: "apiKey, model, and messages are required." }, 400, options.corsOrigin);
        const response = await proxyAIStream(proxyPath[1], body.apiKey, body.model, body.messages as Array<{ role: "system" | "user" | "assistant"; content: string }>);
        if (options.corsOrigin) { response.headers.set("Access-Control-Allow-Origin", options.corsOrigin); response.headers.set("Access-Control-Allow-Credentials", "true"); response.headers.set("Vary", "Origin"); }
        return response;
      }

      if (url.pathname === "/api/mcp" && request.method === "POST") {
        const mcp = createProjectMCPServer(principal, options.projects);
        if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Content-Type must be application/json." } }, 415, options.corsOrigin);
        let payload: unknown;
        try { payload = JSON.parse(new TextDecoder().decode(await readBytesLimited(request, 2_500_000))); }
        catch { return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Invalid or oversized JSON-RPC request." } }, 400, options.corsOrigin); }
        const protocolVersion = request.headers.get("mcp-protocol-version");
        if (protocolVersion && !["2026-07-28", "2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"].includes(protocolVersion)) {
          return json({ jsonrpc: "2.0", id: null, error: { code: -32022, message: "Unsupported protocol version.", data: { supported: ["2026-07-28", "2025-03-26"] } } }, 400, options.corsOrigin);
        }
        if (protocolVersion === "2026-07-28" && Array.isArray(payload)) return json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "JSON-RPC batch requests are not supported over stateless MCP HTTP." } }, 400, options.corsOrigin);
        const values = Array.isArray(payload) ? payload : [payload];
        if (protocolVersion === "2026-07-28") {
          if (!values[0] || typeof values[0] !== "object" || Array.isArray(values[0])) return json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid JSON-RPC request." } }, 400, options.corsOrigin);
          if (request.headers.get("mcp-method") !== (values[0] as { method?: unknown })?.method) return json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Mcp-Method header must match the JSON-RPC method." } }, 400, options.corsOrigin);
          const first = values[0] as { method?: string; params?: { name?: unknown; _meta?: Record<string, unknown> } };
          if (first.params?._meta?.["io.modelcontextprotocol/protocolVersion"] !== protocolVersion) return json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "The JSON-RPC request must declare the negotiated protocol version in _meta." } }, 400, options.corsOrigin);
          if (first.method === "tools/call" && request.headers.get("mcp-name") !== first.params?.name) return json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Mcp-Name header must match the requested tool." } }, 400, options.corsOrigin);
        }
        if (Array.isArray(payload)) {
          const responses = await Promise.all(values.map((item) => mcp.handleJSONRPC(item)));
          const present = responses.filter((item): item is Record<string, unknown> => item !== null);
          const response = present.length ? json(present, 200, options.corsOrigin) : new Response(null, { status: 202 });
          if (protocolVersion === "2026-07-28") response.headers.set("MCP-Protocol-Version", protocolVersion);
          return response;
        }
        const response = await mcp.handleJSONRPC(payload);
        const result = response ? json(response, 200, options.corsOrigin) : new Response(null, { status: 202 });
        if (protocolVersion === "2026-07-28") result.headers.set("MCP-Protocol-Version", protocolVersion);
        return result;
      }

      if (url.pathname === "/api/video/transcode" && request.method === "POST") {
        if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("video/webm")) return json({ error: "Content-Type must be video/webm." }, 400, options.corsOrigin);
        const bytes = await readBytesLimited(request, 100 * 1024 * 1024);
        const mp4 = await transcodeWebMToMp4(bytes);
        return new Response(new Uint8Array(mp4).buffer, { status: 200, headers: { "Content-Type": "video/mp4", "Content-Disposition": "attachment; filename=designbuddy.mp4", "Cache-Control": "no-store", ...(options.corsOrigin ? { "Access-Control-Allow-Origin": options.corsOrigin, "Access-Control-Allow-Credentials": "true" } : {}) } });
      }

      const agentPath = url.pathname.match(/^\/api\/projects\/([^/]+)\/agent$/);
      if (agentPath && request.method === "POST") {
        if (!options.localAgentWorkspaceRoot) return json({ error: "Local coding-agent runtime is not configured on this server." }, 501, options.corsOrigin);
        const projectId = decodeURIComponent(agentPath[1]);
        const body = await readJson(request);
        let project = await options.projects.getById(principal.id, projectId);
        if (body.project && typeof body.project === "object" && !Array.isArray(body.project)) {
          const submitted = asProject(body.project as Record<string, unknown>);
          if (submitted.id !== projectId) return json({ error: "Project id mismatch." }, 400, options.corsOrigin);
          project = submitted;
        }
        if (!project) return json({ error: "Project not found." }, 404, options.corsOrigin);
        const supportedAgents: CodingAgentId[] = ["codex", "claude", "opencode", "gemini", "cursor-agent"];
        if (typeof body.agent !== "string" || !supportedAgents.includes(body.agent as CodingAgentId)) return json({ error: "Choose a supported local coding agent." }, 400, options.corsOrigin);
        if (typeof body.prompt !== "string" || !body.prompt.trim() || body.prompt.length > 16_000) return json({ error: "A prompt between 1 and 16,000 characters is required." }, 400, options.corsOrigin);
        const result = await runAgentOnProject(project, body.agent as CodingAgentId, body.prompt, resolve(options.localAgentWorkspaceRoot));
        const saved = await options.projects.save(principal.id, { ...project, files: result.files });
        return json({ saved: true, project: saved, agent: body.agent, output: result.output }, 200, options.corsOrigin);
      }

      const collaborationPath = url.pathname.match(/^\/api\/projects\/([^/]+)\/collaboration(?:\/(events))?$/);
      if (collaborationPath) {
        const projectId = decodeURIComponent(collaborationPath[1]);
        const allowed = options.canAccessProject
          ? await options.canAccessProject(principal, projectId)
          : Boolean(await projectOwnerFor(principal, projectId));
        if (!allowed) return json({ error: "Project not found or access denied." }, 404, options.corsOrigin);

        if (request.method === "GET" && collaborationPath[2] === "events") {
          let unsubscribe = () => {};
          let heartbeat: ReturnType<typeof setInterval> | undefined;
          let poller: ReturnType<typeof setInterval> | undefined;
          const encoder = new TextEncoder();
          const cleanup = () => { unsubscribe(); if (heartbeat) clearInterval(heartbeat); if (poller) clearInterval(poller); };
          const body = new ReadableStream<Uint8Array>({
            start(controller) {
              const connectedAt = Date.now();
              const seen = new Set<string>();
              const send = (event: unknown) => {
                if (event && typeof event === "object" && "id" in event && typeof event.id === "string") {
                  if (seen.has(event.id)) return;
                  seen.add(event.id);
                  if (seen.size > 500) seen.delete(seen.values().next().value!);
                  controller.enqueue(encoder.encode(`id: ${event.id}\n`));
                }
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
              };
              send({ type: "presence.snapshot", projectId, users: collaboration.activePresence(projectId) });
              unsubscribe = collaboration.subscribe(projectId, send, principal.id);
              collaboration.recent(projectId).filter((event) => event.type === "comment").forEach(send);
              heartbeat = setInterval(() => controller.enqueue(encoder.encode(": keep-alive\n\n")), 20_000);
              poller = setInterval(() => {
                collaboration.recent(projectId).filter((event) => event.userId !== principal.id && Date.parse(event.createdAt) >= connectedAt).forEach(send);
              }, 1_000);
              request.signal.addEventListener("abort", () => { cleanup(); try { controller.close(); } catch {} }, { once: true });
            },
            cancel() { cleanup(); },
          });
          return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no", ...(options.corsOrigin ? { "Access-Control-Allow-Origin": options.corsOrigin, "Access-Control-Allow-Credentials": "true" } : {}) } });
        }

        if (request.method === "POST" && !collaborationPath[2]) {
          const input = await readJson(request);
          const type = input.type;
          const allowedTypes: CollaborationEventType[] = ["presence", "cursor", "comment", "document"];
          if (typeof type !== "string" || !allowedTypes.includes(type as CollaborationEventType)) return json({ error: "Unsupported collaboration event type." }, 400, options.corsOrigin);
          if (!options.canAccessProject && !await options.projects.getById(principal.id, projectId) && type === "document") {
            const ownerId = options.memberships?.ownerFor(projectId);
            if (!ownerId || options.memberships?.roleFor(ownerId, projectId, principal.id) !== "editor") return json({ error: "Editor access is required to publish this event." }, 403, options.corsOrigin);
          }
          const payload = input.payload;
          if (payload === undefined || new TextEncoder().encode(JSON.stringify(payload)).byteLength > 16_000) return json({ error: "Collaboration payload is missing or exceeds 16 KB." }, 400, options.corsOrigin);
          return json({ event: collaboration.publish(projectId, principal.id, type as CollaborationEventType, payload) }, 202, options.corsOrigin);
        }
      }

      const membersPath = url.pathname.match(/^\/api\/projects\/([^/]+)\/members$/);
      if (membersPath && options.memberships) {
        const projectId = decodeURIComponent(membersPath[1]);
        const ownedProject = await options.projects.getById(principal.id, projectId);
        if (!ownedProject) return json({ error: "Only the project owner can manage members." }, 404, options.corsOrigin);
        if (request.method === "GET") return json({ members: options.memberships.list(principal.id, projectId) }, 200, options.corsOrigin);
        if (request.method === "POST") {
          const body = await readJson(request);
          if (typeof body.userId !== "string" || !body.userId.trim() || body.userId === principal.id) return json({ error: "A different member userId is required." }, 400, options.corsOrigin);
          const role = body.role;
          if (role !== "viewer" && role !== "editor") return json({ error: "role must be viewer or editor." }, 400, options.corsOrigin);
          return json({ member: options.memberships.add(principal.id, projectId, body.userId.trim().slice(0, 160), role as ProjectMemberRole) }, 201, options.corsOrigin);
        }
        if (request.method === "DELETE") {
          const memberId = url.searchParams.get("userId")?.trim();
          if (!memberId) return json({ error: "userId is required." }, 400, options.corsOrigin);
          const removed = options.memberships.remove(principal.id, projectId, memberId);
          return removed ? json({ removed: true }, 200, options.corsOrigin) : json({ error: "Member not found." }, 404, options.corsOrigin);
        }
      }

      // Workspaces and organisation members.
      if (url.pathname === "/api/workspaces" && request.method === "GET") {
        if (!options.workspaces) return json({ error: "工作空间功能未启用。" }, 404, options.corsOrigin);
        const workspaces = options.workspaces.listFor(principal.id).map((workspace) => ({
          ...workspace,
          role: options.workspaces!.roleFor(workspace.id, principal.id),
        }));
        return json({ workspaces }, 200, options.corsOrigin);
      }
      if (url.pathname === "/api/workspaces" && request.method === "POST") {
        if (!options.workspaces) return json({ error: "工作空间功能未启用。" }, 404, options.corsOrigin);
        const body = await readJson(request);
        const workspace = options.workspaces.create(principal.id, typeof body.name === "string" ? body.name : "");
        return json({ workspace, members: options.workspaces.listMembers(workspace.id) }, 200, options.corsOrigin);
      }
      if (url.pathname === "/api/workspaces/join" && request.method === "POST") {
        if (!options.workspaces) return json({ error: "工作空间功能未启用。" }, 404, options.corsOrigin);
        const body = await readJson(request);
        const workspace = options.workspaces.joinByCode(principal.id, typeof body.code === "string" ? body.code : "");
        if (!workspace) return json({ error: "加入码无效，或该工作空间已关闭加入。" }, 404, options.corsOrigin);
        return json({ workspace, role: options.workspaces.roleFor(workspace.id, principal.id) }, 200, options.corsOrigin);
      }
      const workspaceMemberPath = url.pathname.match(/^\/api\/workspaces\/([^/]+)\/members(?:\/([^/]+))?$/);
      if (workspaceMemberPath && options.workspaces) {
        const workspaceId = decodeURIComponent(workspaceMemberPath[1]);
        const workspace = options.workspaces.get(workspaceId);
        if (!workspace) return json({ error: "工作空间不存在。" }, 404, options.corsOrigin);
        const myRole = options.workspaces.roleFor(workspaceId, principal.id);
        if (!myRole) return json({ error: "你不是该工作空间的成员。" }, 403, options.corsOrigin);
        if (!workspaceMemberPath[2]) {
          if (request.method === "GET") {
            return json({ members: options.workspaces.listMembers(workspaceId), role: myRole }, 200, options.corsOrigin);
          }
          if (request.method === "POST") {
            const body = await readJson(request);
            const userId = typeof body.userId === "string" ? body.userId.trim() : "";
            if (!userId) return json({ error: "需要成员的用户 ID。" }, 400, options.corsOrigin);
            const role = (typeof body.role === "string" ? body.role : "member") as WorkspaceRole;
            try {
              const member = options.workspaces.addMember(workspaceId, principal.id, userId, role);
              return json({ member, members: options.workspaces.listMembers(workspaceId) }, 200, options.corsOrigin);
            } catch (error) {
              return json({ error: workspaceErrorMessage(error) }, workspaceErrorStatus(error), options.corsOrigin);
            }
          }
          return json({ error: "Method not allowed." }, 405, options.corsOrigin);
        }
        const memberId = decodeURIComponent(workspaceMemberPath[2]);
        if (request.method === "PATCH") {
          const body = await readJson(request);
          const role = (typeof body.role === "string" ? body.role : "member") as WorkspaceRole;
          try {
            const member = options.workspaces.setRole(workspaceId, principal.id, memberId, role);
            return json({ member, members: options.workspaces.listMembers(workspaceId) }, 200, options.corsOrigin);
          } catch (error) {
            return json({ error: workspaceErrorMessage(error) }, workspaceErrorStatus(error), options.corsOrigin);
          }
        }
        if (request.method === "DELETE") {
          try {
            const removed = options.workspaces.removeMember(workspaceId, principal.id, memberId);
            if (!removed) return json({ error: "该成员不在这个工作空间里。" }, 404, options.corsOrigin);
            return json({ removed: true, members: options.workspaces.listMembers(workspaceId) }, 200, options.corsOrigin);
          } catch (error) {
            return json({ error: workspaceErrorMessage(error) }, workspaceErrorStatus(error), options.corsOrigin);
          }
        }
        return json({ error: "Method not allowed." }, 405, options.corsOrigin);
      }
      const workspaceCodePath = url.pathname.match(/^\/api\/workspaces\/([^/]+)\/join-code$/);
      if (workspaceCodePath && options.workspaces) {
        if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, options.corsOrigin);
        const workspaceId = decodeURIComponent(workspaceCodePath[1]);
        if (!options.workspaces.get(workspaceId)) return json({ error: "工作空间不存在。" }, 404, options.corsOrigin);
        if (!canManageMembers(options.workspaces.roleFor(workspaceId, principal.id)))
          return json({ error: "只有工作空间的所有者或管理员可以管理加入码。" }, 403, options.corsOrigin);
        const body = await readJson(request);
        if (body.enabled === false) {
          options.workspaces.setJoinCodeEnabled(workspaceId, principal.id, false);
          return json({ joinCode: "", enabled: false }, 200, options.corsOrigin);
        }
        const code = body.rotate === false
          ? options.workspaces.get(workspaceId)?.joinCode ?? ""
          : options.workspaces.rotateJoinCode(workspaceId, principal.id) ?? "";
        return json({ joinCode: code, enabled: Boolean(code) }, 200, options.corsOrigin);
      }
      const workspacePath = url.pathname.match(/^\/api\/workspaces\/([^/]+)$/);
      if (workspacePath && options.workspaces) {
        const workspaceId = decodeURIComponent(workspacePath[1]);
        const workspace = options.workspaces.get(workspaceId);
        if (!workspace) return json({ error: "工作空间不存在。" }, 404, options.corsOrigin);
        const myRole = options.workspaces.roleFor(workspaceId, principal.id);
        if (!myRole) return json({ error: "你不是该工作空间的成员。" }, 403, options.corsOrigin);
        if (request.method === "GET") {
          const projects = options.projects.listByWorkspace
            ? await options.projects.listByWorkspace(workspaceId)
            : [];
          return json(
            {
              workspace: { ...workspace, joinCode: canManageMembers(myRole) ? workspace.joinCode : "" },
              role: myRole,
              members: options.workspaces.listMembers(workspaceId),
              projects: projects.map((entry) => entry.project),
            },
            200,
            options.corsOrigin,
          );
        }
        if (request.method === "DELETE") {
          const removed = options.workspaces.remove(workspaceId, principal.id);
          return removed
            ? json({ deleted: true }, 200, options.corsOrigin)
            : json({ error: "只有工作空间的所有者可以删除它。" }, 403, options.corsOrigin);
        }
        return json({ error: "Method not allowed." }, 405, options.corsOrigin);
      }

      if (url.pathname === "/api/projects" && request.method === "GET") {
        const own = await options.projects.listByOwner(principal.id);
        const shared = await Promise.all((options.memberships?.forUser(principal.id) ?? []).map(({ ownerId, projectId }) => options.projects.getById(ownerId, projectId)));
        const seen = new Set(own.map((project) => project.id));
        const entries: Array<{ project: ApiProject; access: "owner" | "editor" | "viewer" }> = [
          ...own.map((project) => ({ project, access: "owner" as const })),
          ...shared
            .filter((project): project is ApiProject => Boolean(project && !seen.has(project.id)))
            .map((project) => ({ project, access: "editor" as const })),
        ];
        // The projects of the workspaces the person belongs to, with the access
        // their workspace role allows.
        if (options.workspaces && options.projects.listByWorkspace) {
          for (const workspace of options.workspaces.listFor(principal.id)) {
            const role = options.workspaces.roleFor(workspace.id, principal.id);
            if (!role) continue;
            for (const entry of await options.projects.listByWorkspace(workspace.id)) {
              if (seen.has(entry.project.id)) continue;
              seen.add(entry.project.id);
              entries.push({
                project: entry.project,
                access: canEditWorkspace(role) ? "editor" : "viewer",
              });
            }
          }
        }
        return json(
          entries
            .sort((a, b) => b.project.updatedAt.localeCompare(a.project.updatedAt))
            .map((entry) => ({ ...entry.project, access: entry.access })),
          200,
          options.corsOrigin,
        );
      }
      if (url.pathname === "/api/projects" && request.method === "POST") {
        const body = await readJson(request);
        const project = asProject(body);
        const ownerId = await projectOwnerFor(principal, project.id);
        if (ownerId && !(await canEditProject(principal, ownerId, project.id)))
          return json({ error: await projectEditError(principal, project.id) }, 403, options.corsOrigin);
        const existing = ownerId ? await options.projects.getById(ownerId, project.id) : null;
        const workspaceCheck = checkWorkspaceWrite(principal, project, existing, ownerId);
        if (workspaceCheck) return json({ error: workspaceCheck.error }, workspaceCheck.status, options.corsOrigin);
        const conflicts = options.versions ? findConflicts(options.versions, project.id, body, project.files) : [];
        if (conflicts.length) {
          options.versions?.recordAudit(project.id, principal.id, "project.conflict", conflicts.map((item) => item.path).join(", "));
          return json({ error: "服务器上已有更新的版本，请先处理冲突再保存。", conflicts }, 409, options.corsOrigin);
        }
        const saved = await options.projects.save(ownerId ?? principal.id, project);
        const changed = changedFiles(
          existing?.files ?? [],
          project.files,
          options.versions ? (path) => !options.versions!.head(project.id, path) : undefined,
        );
        if (options.versions) {
          for (const file of changed) {
            options.versions.commit({ projectId: project.id, ownerId: ownerId ?? principal.id, path: file.path, content: file.content, author: principal.id, label: "保存" });
          }
          options.versions.recordAudit(project.id, principal.id, "project.save", changed.length ? changed.map((file) => file.path).join(", ") : "无文件变化");
        }
        collaboration.publish(project.id, principal.id, "document", { updatedAt: saved.updatedAt });
        return json({ saved: true, project: saved, versions: options.versions?.heads(project.id) ?? {} }, 200, options.corsOrigin);
      }

      const projectSharesPath = url.pathname.match(/^\/api\/projects\/([^/]+)\/shares$/);
      if (projectSharesPath && options.shares) {
        const projectId = decodeURIComponent(projectSharesPath[1]);
        const ownerId = await projectOwnerFor(principal, projectId);
        if (!ownerId) return json({ error: "Project not found." }, 404, options.corsOrigin);
        if (request.method === "GET") {
          // Only the project owner sees the list of links they handed out.
          if (ownerId !== principal.id) return json({ error: "只有项目所有者可以查看分享链接。" }, 403, options.corsOrigin);
          return json({ shares: options.shares.listForProject(projectId, principal.id) }, 200, options.corsOrigin);
        }
        if (request.method === "POST") {
          if (!(await canEditProject(principal, ownerId, projectId)))
            return json({ error: "没有分享这个项目的权限。" }, 403, options.corsOrigin);
          const body = await readJson(request);
          const days = typeof body.expiresInDays === "number" ? body.expiresInDays : 7;
          const share = options.shares.create(ownerId, projectId, days);
          options.versions?.recordAudit(projectId, principal.id, "project.share.create", `创建只读分享链接，有效期 ${days} 天`);
          return json({ share }, 201, options.corsOrigin);
        }
        return json({ error: "Method not allowed." }, 405, options.corsOrigin);
      }

      const shareRevokePath = url.pathname.match(/^\/api\/shares\/([A-Za-z0-9_-]{16,64})$/);
      if (shareRevokePath && options.shares && request.method === "DELETE") {
        const token = shareRevokePath[1];
        const share = options.shares.get(token);
        if (!share) return json({ error: "分享链接不存在。" }, 404, options.corsOrigin);
        if (share.ownerId !== principal.id) return json({ error: "只有分享者可以撤销这个链接。" }, 403, options.corsOrigin);
        options.shares.revoke(token, principal.id);
        options.versions?.recordAudit(share.projectId, principal.id, "project.share.revoke", "撤销只读分享链接");
        return json({ revoked: true }, 200, options.corsOrigin);
      }

      const assetCollectionPath = url.pathname.match(/^\/api\/assets$/);
      if (assetCollectionPath && options.assets) {
        if (request.method === "GET") {
          return json({ assets: options.assets.listVisible(principal.id, workspacePeerIds(principal.id)) }, 200, options.corsOrigin);
        }
        if (request.method === "POST") {
          const body = await readJson(request, 8_000_000);
          const name = typeof body.name === "string" ? body.name : "";
          const mime = typeof body.mime === "string" ? body.mime : "application/octet-stream";
          const dataBase64 = typeof body.dataBase64 === "string" ? body.dataBase64 : "";
          if (!dataBase64) return json({ error: "请提供文件内容。" }, 400, options.corsOrigin);
          const bytes = Buffer.from(dataBase64, "base64");
          // A truncated or mangled payload must not be stored as a valid file.
          if (!bytes.byteLength || bytes.toString("base64").replace(/=+$/, "") !== dataBase64.replace(/\s+/g, "").replace(/=+$/, "")) {
            return json({ error: "文件内容不是有效的编码。" }, 400, options.corsOrigin);
          }
          const visibility = body.visibility === "workspace" || body.visibility === "public" ? body.visibility : "private";
          try {
            const asset = options.assets.create(principal.id, { name, mime, bytes }, visibility as AssetVisibility);
            return json({ asset }, 201, options.corsOrigin);
          } catch (error) {
            if (error instanceof AssetLimitError) return json({ error: error.message }, 413, options.corsOrigin);
            if (error instanceof AssetInputError) return json({ error: error.message }, 400, options.corsOrigin);
            throw error;
          }
        }
        return json({ error: "Method not allowed." }, 405, options.corsOrigin);
      }

      const assetPath = url.pathname.match(/^\/api\/assets\/([A-Za-z0-9_-]{4,64})(?:\/(content|events|download))?$/);
      if (assetPath && options.assets) {
        const asset = options.assets.get(assetPath[1]);
        if (assetPath[2] === "events" && request.method === "GET") {
          // The trail of a deleted file stays readable for its owner.
          return json({ events: options.assets.events(assetPath[1], principal.id) }, 200, options.corsOrigin);
        }
        if (!asset) return json({ error: "素材不存在。" }, 404, options.corsOrigin);
        const peers = workspacePeerIds(principal.id);
        const visible = asset.ownerId === principal.id || asset.visibility === "public" || (asset.visibility === "workspace" && peers.includes(asset.ownerId));
        if (!visible) return json({ error: "没有查看这个素材的权限。" }, 403, options.corsOrigin);
        if (!assetPath[2] && request.method === "GET") return json({ asset }, 200, options.corsOrigin);
        if (assetPath[2] === "download" && request.method === "GET") {
          const bytes = options.assets.read(asset);
          if (!bytes) return json({ error: "素材文件已不可用。" }, 404);
          return new Response(Uint8Array.from(bytes).buffer, { headers: { "Content-Type": asset.mime, "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(asset.name)}`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
        }
        if (assetPath[2] === "content" && request.method === "GET") {
          if (!asset.extracted) return json({ error: "这个文件不是文本，服务端没有解析它。" }, 415, options.corsOrigin);
          return json({ assetId: asset.id, name: asset.name, text: asset.excerpt }, 200, options.corsOrigin);
        }
        if (!assetPath[2] && request.method === "PATCH") {
          if (asset.ownerId !== principal.id) return json({ error: "只有素材的所有者可以修改可见范围。" }, 403, options.corsOrigin);
          const body = await readJson(request);
          const visibility = body.visibility === "workspace" || body.visibility === "public" || body.visibility === "private" ? body.visibility : null;
          if (!visibility) return json({ error: "可见范围只能是 private、workspace 或 public。" }, 400, options.corsOrigin);
          const updated = options.assets.setVisibility(asset.id, principal.id, visibility as AssetVisibility);
          return json({ asset: updated }, 200, options.corsOrigin);
        }
        if (!assetPath[2] && request.method === "DELETE") {
          if (asset.ownerId !== principal.id) return json({ error: "只有素材的所有者可以删除它。" }, 403, options.corsOrigin);
          options.assets.remove(asset.id, principal.id);
          return json({ ok: true }, 200, options.corsOrigin);
        }
        return json({ error: "Method not allowed." }, 405, options.corsOrigin);
      }

      if (options.admin) {
        // The console is for the operator of this server. A signed in account
        // that is not on the configured list gets a clear refusal, not a page
        // with half the data.
        const allowed = isAdmin(principal);
        const adminOverviewPath = url.pathname.match(/^\/api\/admin\/overview$/);
        if (adminOverviewPath && request.method === "GET") {
          if (!allowed) return json({ error: "只有本机配置的管理员账号可以打开管理后台。" }, 403, options.corsOrigin);
          return json({ overview: options.admin.overview() }, 200, options.corsOrigin);
        }
        const adminAccountPath = url.pathname.match(/^\/api\/admin\/accounts\/([A-Za-z0-9_-]{4,64})\/status$/);
        if (adminAccountPath && request.method === "POST") {
          if (!allowed) return json({ error: "只有本机配置的管理员账号可以操作账号。" }, 403, options.corsOrigin);
          const body = await readJson(request, 2000);
          if (typeof body.enabled !== "boolean") return json({ error: "enabled 必须是布尔值。" }, 400, options.corsOrigin);
          try {
            return json({ account: options.admin.setAccountEnabled(adminAccountPath[1], body.enabled) }, 200, options.corsOrigin);
          } catch (error) {
            if (error instanceof AdminError) return json({ error: error.message }, error.status, options.corsOrigin);
            throw error;
          }
        }
        const adminTaskPath = url.pathname.match(/^\/api\/admin\/tasks\/([A-Za-z0-9_-]{4,64})\/([A-Za-z0-9_-]{4,64})\/retry$/);
        if (adminTaskPath && request.method === "POST") {
          if (!allowed) return json({ error: "只有本机配置的管理员账号可以重试任务。" }, 403, options.corsOrigin);
          try {
            return json({ task: options.admin.retryTask(adminTaskPath[1], adminTaskPath[2]) }, 200, options.corsOrigin);
          } catch (error) {
            if (error instanceof AdminError) return json({ error: error.message }, error.status, options.corsOrigin);
            throw error;
          }
        }
        const adminSchedulePath = url.pathname.match(/^\/api\/admin\/schedules\/([A-Za-z0-9_-]{4,64})\/([A-Za-z0-9_-]{4,64})\/status$/);
        if (adminSchedulePath && request.method === "POST") {
          if (!allowed) return json({ error: "只有本机配置的管理员账号可以操作定时任务。" }, 403, options.corsOrigin);
          const body = await readJson(request, 2000);
          if (typeof body.enabled !== "boolean") return json({ error: "enabled 必须是布尔值。" }, 400, options.corsOrigin);
          try {
            return json({ schedule: options.admin.setScheduleEnabled(adminSchedulePath[1], adminSchedulePath[2], body.enabled) }, 200, options.corsOrigin);
          } catch (error) {
            if (error instanceof AdminError) return json({ error: error.message }, error.status, options.corsOrigin);
            throw error;
          }
        }
      }

      if (options.workflows) {
        const workflowListPath = url.pathname.match(/^\/api\/workflows$/);
        if (workflowListPath && request.method === "GET") {
          return json({ workflows: workflowCatalog() }, 200, options.corsOrigin);
        }
        const workflowRunPath = url.pathname.match(/^\/api\/workflows\/([a-z0-9-]{3,60})\/runs$/);
        if (workflowRunPath && request.method === "POST") {
          const body = await readJson(request, 400_000);
          const inputs = {
            fields: body.fields && typeof body.fields === "object" ? (body.fields as Record<string, unknown>) : {},
            files: body.files && typeof body.files === "object" ? (body.files as Record<string, { assetId: string }>) : {},
          };
          try {
            const run = await options.workflows.start(principal.id, workflowRunPath[1], inputs);
            return json({ run }, 202, options.corsOrigin);
          } catch (error) {
            if (error instanceof WorkflowInputError) return json({ error: error.message }, 400, options.corsOrigin);
            throw error;
          }
        }
        const workflowRunsPath = url.pathname.match(/^\/api\/workflow-runs$/);
        if (workflowRunsPath && request.method === "GET") {
          return json({ runs: options.workflows.list(principal.id, url.searchParams.get("taskId") || undefined) }, 200, options.corsOrigin);
        }
        const workflowRunIdPath = url.pathname.match(/^\/api\/workflow-runs\/([A-Za-z0-9_-]{6,64})$/);
        if (workflowRunIdPath && request.method === "GET") {
          const run = options.workflows.get(principal.id, workflowRunIdPath[1]);
          if (!run) return json({ error: "没有这次工作流运行记录。" }, 404, options.corsOrigin);
          return json({ run }, 200, options.corsOrigin);
        }
        const workflowRetryPath = url.pathname.match(/^\/api\/workflow-runs\/([A-Za-z0-9_-]{6,64})\/steps\/([A-Za-z0-9_-]{1,60})\/retry$/);
        if (workflowRetryPath && request.method === "POST") {
          try {
            const run = await options.workflows.retryStep(principal.id, workflowRetryPath[1], workflowRetryPath[2]);
            return json({ run }, 202, options.corsOrigin);
          } catch (error) {
            if (error instanceof WorkflowInputError) return json({ error: error.message }, 400, options.corsOrigin);
            throw error;
          }
        }
      }

      const communityListPath = url.pathname.match(/^\/api\/community\/templates$/);
      if (communityListPath && options.community) {
        if (request.method === "GET") {
          return json({ templates: options.community.list(principal.id, workspacePeerIds(principal.id)) }, 200, options.corsOrigin);
        }
        if (request.method === "POST") {
          const body = await readJson(request, 400_000);
          const sample = typeof body.sample === "string" ? body.sample : "";
          const title = typeof body.title === "string" ? body.title : "";
          const description = typeof body.description === "string" ? body.description : "";
          const visibility = body.visibility === "workspace" || body.visibility === "public" || body.visibility === "private" ? body.visibility : "private";
          if (!body.state || typeof body.state !== "object") {
            return json({ error: "请先保存模板内容再发布。" }, 400, options.corsOrigin);
          }
          try {
            const template = options.community.publish(principal.id, {
              sample, title, description, visibility: visibility as CommunityVisibility, state: body.state,
            });
            return json({ template }, 201, options.corsOrigin);
          } catch (error) {
            if (error instanceof CommunityLimitError) return json({ error: error.message }, 413, options.corsOrigin);
            if (error instanceof CommunityInputError) return json({ error: error.message }, 400, options.corsOrigin);
            throw error;
          }
        }
        return json({ error: "Method not allowed." }, 405, options.corsOrigin);
      }

      const communityPath = url.pathname.match(/^\/api\/community\/templates\/([a-f0-9]{20})(?:\/(events|state))?$/);
      if (communityPath && options.community) {
        const template = options.community.get(communityPath[1]);
        if (communityPath[2] === "events" && request.method === "GET") {
          return json({ events: options.community.events(communityPath[1], principal.id) }, 200, options.corsOrigin);
        }
        if (!template) return json({ error: "模板不存在。" }, 404, options.corsOrigin);
        const peers = workspacePeerIds(principal.id);
        const visible = template.ownerId === principal.id || template.visibility === "public" || (template.visibility === "workspace" && peers.includes(template.ownerId));
        if (!visible) return json({ error: "没有查看这个模板的权限。" }, 403, options.corsOrigin);
        if (!communityPath[2] && request.method === "GET") {
          return json({ template }, 200, options.corsOrigin);
        }
        if (communityPath[2] === "state" && request.method === "GET") {
          const stateJson = options.community.state(template.id);
          if (!stateJson) return json({ error: "模板内容不存在。" }, 404, options.corsOrigin);
          return json({ template, state: JSON.parse(stateJson) }, 200, options.corsOrigin);
        }
        if (!communityPath[2] && request.method === "PATCH") {
          if (template.ownerId !== principal.id) return json({ error: "只有发布者可以修改可见范围。" }, 403, options.corsOrigin);
          const body = await readJson(request);
          const visibility = body.visibility === "workspace" || body.visibility === "public" || body.visibility === "private" ? body.visibility : null;
          if (!visibility) return json({ error: "可见范围只能是 private、workspace 或 public。" }, 400, options.corsOrigin);
          return json({ template: options.community.setVisibility(template.id, principal.id, visibility as CommunityVisibility) }, 200, options.corsOrigin);
        }
        if (!communityPath[2] && request.method === "DELETE") {
          if (template.ownerId !== principal.id) return json({ error: "只有发布者可以下架这个模板。" }, 403, options.corsOrigin);
          options.community.unpublish(template.id, principal.id);
          return json({ ok: true }, 200, options.corsOrigin);
        }
        return json({ error: "Method not allowed." }, 405, options.corsOrigin);
      }

      const versionsPath = url.pathname.match(/^\/api\/projects\/([^/]+)\/versions(?:\/([^/]+))?$/);
      if (versionsPath && options.versions) {
        const projectId = decodeURIComponent(versionsPath[1]);
        const ownerId = await projectOwnerFor(principal, projectId);
        if (!ownerId) return json({ error: "Project not found." }, 404, options.corsOrigin);
        if (request.method === "GET") {
          if (versionsPath[2]) {
            const version = options.versions.get(projectId, decodeURIComponent(versionsPath[2]));
            return version ? json({ version }, 200, options.corsOrigin) : json({ error: "Version not found." }, 404, options.corsOrigin);
          }
          const path = url.searchParams.get("path") || undefined;
          return json({ versions: options.versions.list(projectId, path), heads: options.versions.heads(projectId) }, 200, options.corsOrigin);
        }
        return json({ error: "Method not allowed." }, 405, options.corsOrigin);
      }

      const restorePath = url.pathname.match(/^\/api\/projects\/([^/]+)\/restore$/);
      if (restorePath && options.versions) {
        if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, options.corsOrigin);
        const projectId = decodeURIComponent(restorePath[1]);
        const ownerId = await writableProjectOwner(principal, projectId);
        if (!ownerId) return json({ error: "Editor access is required to restore a version." }, 403, options.corsOrigin);
        const body = await readJson(request);
        const version = typeof body.versionId === "string" ? options.versions.get(projectId, body.versionId) : null;
        if (!version) return json({ error: "Version not found." }, 404, options.corsOrigin);
        const project = await options.projects.getById(ownerId, projectId);
        if (!project) return json({ error: "Project not found." }, 404, options.corsOrigin);
        const files = project.files.some((file) => file.path === version.path)
          ? project.files.map((file) => (file.path === version.path ? { ...file, content: version.content } : file))
          : [...project.files, { path: version.path, content: version.content }];
        const saved = await options.projects.save(ownerId, { ...project, files });
        const committed = options.versions.commit({
          projectId,
          ownerId,
          path: version.path,
          content: version.content,
          author: principal.id,
          label: `恢复自 v${version.version}`,
        });
        options.versions.recordAudit(projectId, principal.id, "project.restore", `${version.path} 恢复自 v${version.version}`);
        collaboration.publish(projectId, principal.id, "document", { updatedAt: saved.updatedAt });
        return json({ saved: true, project: saved, version: committed, versions: options.versions.heads(projectId) }, 200, options.corsOrigin);
      }

      const auditPath = url.pathname.match(/^\/api\/projects\/([^/]+)\/audit$/);
      if (auditPath && options.versions) {
        if (request.method !== "GET") return json({ error: "Method not allowed." }, 405, options.corsOrigin);
        const projectId = decodeURIComponent(auditPath[1]);
        const ownerId = await projectOwnerFor(principal, projectId);
        if (!ownerId) return json({ error: "Project not found." }, 404, options.corsOrigin);
        return json({ entries: options.versions.listAudit(projectId) }, 200, options.corsOrigin);
      }

      const projectPath = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
      if (projectPath) {
        const id = decodeURIComponent(projectPath[1]);
        if (request.method === "GET") {
          const ownerId = await projectOwnerFor(principal, id);
          const project = ownerId ? await options.projects.getById(ownerId, id) : null;
          return project ? json(project, 200, options.corsOrigin) : json({ error: "Project not found." }, 404, options.corsOrigin);
        }
        if (request.method === "DELETE") {
          const deleted = await options.projects.delete(principal.id, id);
          return deleted ? json({ deleted: true }, 200, options.corsOrigin) : json({ error: "Project not found." }, 404, options.corsOrigin);
        }
        if (request.method === "PUT") {
          const body = await readJson(request);
          const project = asProject(body);
          if (project.id !== id) return json({ error: "Project id mismatch." }, 400, options.corsOrigin);
          const ownerId = await projectOwnerFor(principal, id);
          if (ownerId && !(await canEditProject(principal, ownerId, id)))
            return json({ error: await projectEditError(principal, id) }, 403, options.corsOrigin);
          const existing = ownerId ? await options.projects.getById(ownerId, id) : null;
          if (!existing) return json({ error: "Project not found." }, 404, options.corsOrigin);
          const workspaceCheck = checkWorkspaceWrite(principal, project, existing, ownerId);
          if (workspaceCheck) return json({ error: workspaceCheck.error }, workspaceCheck.status, options.corsOrigin);
          const conflicts = options.versions ? findConflicts(options.versions, id, body, project.files) : [];
          if (conflicts.length) {
            options.versions?.recordAudit(id, principal.id, "project.conflict", conflicts.map((item) => item.path).join(", "));
            return json({ error: "服务器上已有更新的版本，请先处理冲突再保存。", conflicts }, 409, options.corsOrigin);
          }
          const saved = await options.projects.save(ownerId!, project);
          const changed = changedFiles(existing.files, project.files, options.versions ? (path) => !options.versions!.head(id, path) : undefined);
          if (options.versions) {
            for (const file of changed) {
              options.versions.commit({ projectId: id, ownerId: ownerId!, path: file.path, content: file.content, author: principal.id, label: "保存" });
            }
            options.versions.recordAudit(id, principal.id, "project.save", changed.length ? changed.map((file) => file.path).join(", ") : "无文件变化");
          }
          collaboration.publish(id, principal.id, "document", { updatedAt: saved.updatedAt });
          return json({ saved: true, project: saved, versions: options.versions?.heads(id) ?? {} }, 200, options.corsOrigin);
        }
      }
      return json({ error: "Not found." }, 404, options.corsOrigin);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed.";
      const status = error instanceof ExpertExecutionError ? error.status : error instanceof TaskChatValidationError || /required|must be|invalid|too (long|many|large)|unsafe|exceeds/i.test(message) ? 400 : 502;
      return json({ error: message }, status, options.corsOrigin);
    }
  };
}
