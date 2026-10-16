import type { SkillService } from "../skills/service";
import { matchTaskExpert } from "./expert-match";
import { generateDesignProject, type GenerationFile } from "./generation";
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

async function readJson(request: Request): Promise<Record<string, unknown>> {
  const type = request.headers.get("content-type") || "";
  if (!type.toLowerCase().includes("application/json")) throw new Error("Content-Type must be application/json.");
  const raw = await readBytesLimited(request, 2_500_000);
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
      if (url.pathname === "/api/skill-plans" || url.pathname.startsWith("/api/skill-plans/") || url.pathname === "/api/skill-runs" || url.pathname.startsWith("/api/skill-runs/")) {
        return options.skills ? options.skills.handle(request, principal.id) : json({ error: "技能执行服务尚未启用。" }, 503);
      }
      if (url.pathname === "/api/expert-match" && request.method === "POST") {
        return json(await matchTaskExpert(await readJson(request), request.signal), 200, options.corsOrigin);
      }
      if (url.pathname === "/api/chat" && request.method === "POST") {
        const body = await readJson(request);
        const response = await streamTaskChat({
          messages: body.messages as TaskChatRequest["messages"],
          model: typeof body.model === "string" ? body.model : undefined,
          provider: typeof body.provider === "string" ? body.provider : undefined,
          apiKey: typeof body.apiKey === "string" ? body.apiKey : undefined,
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
      const status = error instanceof TaskChatValidationError || /required|must be|invalid|too (long|many|large)|unsafe|exceeds/i.test(message) ? 400 : 502;
      return json({ error: message }, status, options.corsOrigin);
    }
  };
}
