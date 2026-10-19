import { SkillService } from "./skills/service";
import { createServer } from "node:http";
import { Readable } from "node:stream";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { timingSafeEqual } from "node:crypto";
import { createApiHandler } from "./api/http-handler";
import { createLocalPersistence } from "./api/project-repository";
import {
  WorkspaceBackend,
  responseJSON,
  sameOrigin,
} from "./api/workspace-backend";
import { TaskBackend } from "./api/task-backend";
import { handleAiRegistry } from "./api/ai-models";
import { ProfileStore } from "./api/profile";
import { handleProfileRequest } from "./api/profile-api";
import { ProjectVersionStore } from "./api/project-versions";
import { setAiUsageRecorder } from "./api/ai";
import { PluginRegistry } from "./api/plugin-registry";
import { ProjectShareStore } from "./api/project-shares";
import { AssetStore } from "./api/assets";
import { CommunityTemplateStore } from "./api/community-templates";
import { WorkflowEngine } from "./api/workflows";
import { AdminService } from "./api/admin";
import { ScheduleRunner } from "./api/scheduler";

const host = process.env.DESIGNBUDDY_HOST || "0.0.0.0";
const port = Number(process.env.DESIGNBUDDY_PORT || 8787);
const rendererRoot = resolve(
  process.env.DESIGNBUDDY_RENDERER_DIR || "./apps/web/dist",
);
const workspace = new WorkspaceBackend();
const { projects, collaborationStore, memberships, workspaces } = createLocalPersistence();
const localToken = process.env.DESIGNBUDDY_LOCAL_TOKEN;
function trustedToken(request: Request) {
  const auth = request.headers.get("authorization") || "";
  if (!localToken || !auth.startsWith("Bearer ")) return false;
  const a = Buffer.from(auth.slice(7)),
    b = Buffer.from(localToken);
  return a.length === b.length && timingSafeEqual(a, b);
}
const skills = new SkillService();
// Tasks, schedules and notifications live on the server so a refresh, another
// browser or another device keeps the history.
const tasks = new TaskBackend();
const profiles = new ProfileStore();
const projectVersions = new ProjectVersionStore();
const scheduler = new ScheduleRunner(tasks);
if (process.env.SKILL_SCHEDULER_ENABLED !== "false") scheduler.start();
const plugins = new PluginRegistry();
const projectShares = new ProjectShareStore();
const assets = new AssetStore();
const community = new CommunityTemplateStore();
// Workflows reuse the real skill service, the asset library and the task list.
const workflows = new WorkflowEngine(skills, assets, tasks);
// The operator console reads the accounts, the usage and the task history.
// Who may open it is configured on the server, not in the browser.
const admin = new AdminService(workspace, tasks);
setAiUsageRecorder((ownerId, record) => {
  try {
    tasks.recordAiUsage(ownerId, record);
  } catch {
    /* accounting must never break a call */
  }
});

/** Guests must first hold their own isolated server session, never a shared fallback. */
function resolvePrincipal(request: Request): { id: string } | null {
  return trustedToken(request) ? { id: "local-user" } : workspace.principal(request);
}

const taskPaths = ["/api/tasks", "/api/notifications", "/api/schedules"];
const aiPaths = ["/api/ai"];
const profilePaths = ["/api/profile"];
const pluginPaths = ["/api/plugins"];
const api = createApiHandler({
  skills,
  projects,
  collaborationStore,
  memberships,
  versions: projectVersions,
  shares: projectShares,
  assets,
  community,
  workflows,
  admin,
  workspaces,
  authenticate: async (request) => resolvePrincipal(request),
  localAgentWorkspaceRoot:
    process.env.DESIGNBUDDY_ENABLE_LOCAL_AGENT === "true"
      ? process.env.DESIGNBUDDY_AGENT_WORKSPACE_DIR || "./data/agent-projects"
      : undefined,
});
const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".mp4": "video/mp4",
  ".wav": "audio/wav",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".json": "application/json",
};
const server = createServer(async (incoming, outgoing) => {
  const send = (response: Response) => {
    outgoing.writeHead(
      response.status,
      Object.fromEntries(response.headers.entries()),
    );
    if (!response.body) {
      outgoing.end();
      return;
    }
    const stream = Readable.fromWeb(
      response.body as import("node:stream/web").ReadableStream,
    );
    stream.on("error", () => outgoing.destroy());
    outgoing.once("close", () => stream.destroy());
    stream.pipe(outgoing);
  };
  try {
    const requestHost = incoming.headers.host || `${host}:${port}`;
    const hostname = new URL(`http://${requestHost}`).hostname;
    const publicHostname = process.env.DESIGNBUDDY_PUBLIC_ORIGIN
      ? new URL(process.env.DESIGNBUDDY_PUBLIC_ORIGIN).hostname
      : undefined;
    if (
      !["localhost", "127.0.0.1", "0.0.0.0", "[::1]"].includes(hostname) &&
      !hostname.endsWith(".e2b.app") &&
      !hostname.endsWith(".arena.site") &&
      hostname !== process.env.DESIGNBUDDY_PUBLIC_HOST &&
      hostname !== publicHostname
    ) {
      send(responseJSON({ error: "Host not allowed." }, 403));
      return;
    }
    const url = new URL(incoming.url || "/", `http://${requestHost}`),
      method = incoming.method || "GET";
    const headers = new Headers();
    for (const [k, v] of Object.entries(incoming.headers))
      if (v && !Array.isArray(v)) headers.set(k, v);
    // Never trust client-supplied rate-limit keys.
    headers.set(
      "x-workspace-rate-key",
      incoming.socket.remoteAddress || "local",
    );
    const shellRequest = new Request(url, { method, headers });
    const isAPI = url.pathname === "/api" || url.pathname.startsWith("/api/");
    if (
      isAPI &&
      !["GET", "HEAD", "OPTIONS"].includes(method) &&
      !trustedToken(shellRequest) &&
      !sameOrigin(shellRequest)
    ) {
      send(responseJSON({ error: "跨站修改请求已拒绝。" }, 403));
      return;
    }
    if (isAPI && /\/agent$/.test(url.pathname) && !trustedToken(shellRequest)) {
      send(
        responseJSON(
          { error: "浏览器不能调用本机 CLI。请使用明确配置的本机工具凭据。" },
          403,
        ),
      );
      return;
    }
    if (
      url.pathname === "/api/video/transcode" &&
      !resolvePrincipal(shellRequest) &&
      !trustedToken(shellRequest)
    ) {
      send(responseJSON({ error: "Authentication required." }, 401));
      return;
    }
    const chunks: Buffer[] = [];
    let bytes = 0;
    const limit =
      url.pathname === "/api/video/transcode" ? 101 * 1024 * 1024 : 2_500_000;
    for await (const chunk of incoming) {
      const b = Buffer.from(chunk);
      bytes += b.length;
      if (bytes > limit) {
        send(responseJSON({ error: "Request too large." }, 413));
        return;
      }
      chunks.push(b);
    }
    if (isAPI) {
      const controller = new AbortController();
      outgoing.once("close", () => controller.abort());
      const request = new Request(url, {
        method,
        headers,
        signal: controller.signal,
        ...(["GET", "HEAD"].includes(method)
          ? {}
          : { body: Buffer.concat(chunks) }),
      });
      const handled = await workspace.handle(request);
      if (handled) {
        send(handled);
        return;
      }
      if (pluginPaths.some(prefix => url.pathname === prefix || url.pathname.startsWith(prefix + "/"))) {
        const owner = resolvePrincipal(request);
        if (!owner) {
          send(responseJSON({ error: "服务器会话未建立或已过期。", code: "SESSION_REQUIRED" }, 401));
          return;
        }
        send((await plugins.handle(request, owner.id)) || responseJSON({ error: "未找到该接口。" }, 404));
        return;
      }
      if (profilePaths.some(prefix => url.pathname === prefix || url.pathname.startsWith(prefix + "/"))) {
        const owner = resolvePrincipal(request);
        if (!owner) {
          send(responseJSON({ error: "服务器会话未建立或已过期。", code: "SESSION_REQUIRED" }, 401));
          return;
        }
        send(await handleProfileRequest(request, owner.id, profiles));
        return;
      }
      if (aiPaths.some(prefix => url.pathname === prefix || url.pathname.startsWith(prefix + "/"))) {
        const owner = resolvePrincipal(request);
        if (!owner) {
          send(responseJSON({ error: "服务器会话未建立或已过期。", code: "SESSION_REQUIRED" }, 401));
          return;
        }
        send(await handleAiRegistry(request, owner.id, tasks));
        return;
      }
      if (taskPaths.some(prefix => url.pathname === prefix || url.pathname.startsWith(prefix + "/"))) {
        const owner = resolvePrincipal(request);
        if (!owner) {
          send(responseJSON({ error: "服务器会话未建立或已过期。", code: "SESSION_REQUIRED" }, 401));
          return;
        }
        send((await tasks.handle(request, owner.id)) || responseJSON({ error: "未找到该接口。" }, 404));
        return;
      }
      send(await api(request));
      return;
    }
    if (method !== "GET" && method !== "HEAD") {
      send(responseJSON({ error: "Method not allowed." }, 405));
      return;
    }
    const requested = resolve(
      rendererRoot,
      `.${decodeURIComponent(url.pathname)}`,
    );
    if (
      requested !== rendererRoot &&
      !requested.startsWith(rendererRoot + sep)
    ) {
      send(responseJSON({ error: "Not found." }, 404));
      return;
    }
    let file = requested;
    try {
      if (!(await stat(file)).isFile())
        file = resolve(rendererRoot, "index.html");
    } catch {
      if (extname(requested)) {
        send(responseJSON({ error: "File not found." }, 404));
        return;
      }
      file = resolve(rendererRoot, "index.html");
    }
    const data = await readFile(file);
    const type = mime[extname(file)] || "application/octet-stream";
    // Native video seeking needs byte ranges when serving the production renderer.
    const range = incoming.headers.range;
    if (range) {
      const m = range.match(/^bytes=(\d*)-(\d*)$/);
      let start = m && m[1] ? Number(m[1]) : 0,
        end = m && m[2] ? Number(m[2]) : data.length - 1;
      if (m && !m[1] && m[2]) {
        start = Math.max(0, data.length - Number(m[2]));
        end = data.length - 1;
      }
      if (!m || start > end || start >= data.length) {
        outgoing
          .writeHead(416, { "Content-Range": `bytes */${data.length}` })
          .end();
        return;
      }
      end = Math.min(end, data.length - 1);
      outgoing.writeHead(206, {
        "Content-Type": type,
        "Accept-Ranges": "bytes",
        "Content-Range": `bytes ${start}-${end}/${data.length}`,
        "Content-Length": String(end - start + 1),
        "X-Content-Type-Options": "nosniff",
      });
      outgoing.end(
        method === "HEAD" ? undefined : data.subarray(start, end + 1),
      );
      return;
    }
    outgoing.writeHead(200, {
      "Content-Type": type,
      "Content-Length": String(data.length),
      "Accept-Ranges": "bytes",
      "X-Content-Type-Options": "nosniff",
    });
    outgoing.end(method === "HEAD" ? undefined : data);
  } catch {
    if (!outgoing.headersSent)
      send(responseJSON({ error: "服务器处理请求失败。" }, 500));
    else outgoing.destroy();
  }
});
server.listen(port, host, () => {
  const address = server.address();
  console.log(
    `DesignBuddy API listening on ${host}:${typeof address === "object" && address ? address.port : port}`,
  );
  console.log(
    "Persistent SQLite workspace enabled. Browser sessions are isolated; local CLI execution is disabled unless explicitly enabled and authenticated.",
  );
});
server.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, () => {
    server.close(() => {
      workspace.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 3000).unref();
  });
