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
}

export interface ApiHandlerOptions {
  skills?: SkillService;
  authenticate(request: Request): Promise<ApiPrincipal | null>;
  projects: ProjectRepository;
  collaboration?: RealtimeCollaborationHub;
  collaborationStore?: CollaborationEventStore;
  localAgentWorkspaceRoot?: string;
  memberships?: ProjectMembershipStore;
  canAccessProject?(principal: ApiPrincipal, projectId: string): Promise<boolean>;
  corsOrigin?: string;
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
  async function projectOwnerFor(principal: ApiPrincipal, projectId: string): Promise<string | null> {
    if (await options.projects.getById(principal.id, projectId)) return principal.id;
    const ownerId = options.memberships?.ownerFor(projectId);
    return ownerId && options.memberships?.roleFor(ownerId, projectId, principal.id) ? ownerId : null;
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

      if (url.pathname === "/api/projects" && request.method === "GET") {
        const own = await options.projects.listByOwner(principal.id);
        const shared = await Promise.all((options.memberships?.forUser(principal.id) ?? []).map(({ ownerId, projectId }) => options.projects.getById(ownerId, projectId)));
        const seen = new Set(own.map((project) => project.id));
        return json([...own, ...shared.filter((project): project is ApiProject => Boolean(project && !seen.has(project.id)))].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), 200, options.corsOrigin);
      }
      if (url.pathname === "/api/projects" && request.method === "POST") {
        const project = asProject(await readJson(request));
        const ownerId = await projectOwnerFor(principal, project.id);
        if (ownerId && ownerId !== principal.id && options.memberships?.roleFor(ownerId, project.id, principal.id) !== "editor") return json({ error: "Editor access is required to update this shared project." }, 403, options.corsOrigin);
        const saved = await options.projects.save(ownerId ?? principal.id, project);
        collaboration.publish(project.id, principal.id, "document", { updatedAt: saved.updatedAt });
        return json({ saved: true, project: saved }, 200, options.corsOrigin);
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
          const project = asProject(await readJson(request));
          if (project.id !== id) return json({ error: "Project id mismatch." }, 400, options.corsOrigin);
          const ownerId = await projectOwnerFor(principal, id);
          if (ownerId && ownerId !== principal.id && options.memberships?.roleFor(ownerId, id, principal.id) !== "editor") return json({ error: "Editor access is required to update this shared project." }, 403, options.corsOrigin);
          const existing = ownerId ? await options.projects.getById(ownerId, id) : null;
          if (!existing) return json({ error: "Project not found." }, 404, options.corsOrigin);
          const saved = await options.projects.save(ownerId!, project);
          collaboration.publish(id, principal.id, "document", { updatedAt: saved.updatedAt });
          return json({ saved: true, project: saved }, 200, options.corsOrigin);
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
