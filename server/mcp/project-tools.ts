import type { ApiPrincipal, ProjectRepository } from "../api/http-handler";
import type { MCPToolDefinition } from "./protocol";
import { MCPRegistry } from "./registry";
import { MCPServer } from "./server";

const projectIdSchema: MCPToolDefinition["inputSchema"] = {
  type: "object", properties: { projectId: { type: "string", minLength: 1 } }, required: ["projectId"], additionalProperties: false,
};

/** Build an authenticated, owner-scoped MCP server for the project repository. */
export function createProjectMCPServer(principal: ApiPrincipal, projects: ProjectRepository): MCPServer {
  const registry = new MCPRegistry();
  registry.register({
    name: "projects.list", description: "List the authenticated user's saved design projects.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  }, async () => (await projects.listByOwner(principal.id)).map(({ id, name, prompt, designSystemId, updatedAt }) => ({ id, name, prompt, designSystemId, updatedAt })));
  registry.register({
    name: "projects.read", description: "Read a saved design project and its source files.",
    inputSchema: projectIdSchema,
  }, async (input) => {
    const projectId = (input as { projectId?: unknown }).projectId;
    if (typeof projectId !== "string" || !projectId.trim()) throw new Error("projectId is required.");
    const project = await projects.getById(principal.id, projectId);
    if (!project) throw new Error("Project not found.");
    return project;
  });
  registry.register({
    name: "projects.create", description: "Create a local design project draft for the authenticated user.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string", minLength: 1, maxLength: 120 }, prompt: { type: "string", maxLength: 12000 }, files: { type: "array", items: { type: "object" } }, designSystemId: { type: "string" } },
      required: ["name", "prompt"], additionalProperties: false,
    },
  }, async (input) => {
    const value = input as { name?: unknown; prompt?: unknown; files?: unknown; designSystemId?: unknown };
    if (typeof value.name !== "string" || !value.name.trim() || typeof value.prompt !== "string") throw new Error("name and prompt are required.");
    const files = value.files ?? [];
    if (!Array.isArray(files) || files.length > 200 || files.some((file) => {
      if (!file || typeof file !== "object") return true;
      const item = file as { path?: unknown; content?: unknown };
      return typeof item.path !== "string" || !item.path.trim() || item.path.startsWith("/") || item.path.replace(/\\/g, "/").split("/").includes("..") || typeof item.content !== "string";
    })) throw new Error("files must be safe path/content objects.");
    const totalBytes = files.reduce((total, file) => total + new TextEncoder().encode((file as { content: string }).content).byteLength, 0);
    if (totalBytes > 2_000_000) throw new Error("Project source exceeds the 2 MB limit.");
    const now = new Date().toISOString();
    const project = await projects.save(principal.id, {
      id: crypto.randomUUID(), name: value.name.trim().slice(0, 120), prompt: value.prompt.slice(0, 12_000),
      files: files as Array<{ path: string; content: string }>,
      ...(typeof value.designSystemId === "string" ? { designSystemId: value.designSystemId.slice(0, 120) } : {}),
      createdAt: now, updatedAt: now, status: "draft",
    });
    return project;
  });
  registry.register({
    name: "projects.delete", description: "Delete one of the authenticated user's projects.",
    inputSchema: projectIdSchema,
  }, async (input) => {
    const projectId = (input as { projectId?: unknown }).projectId;
    if (typeof projectId !== "string" || !projectId.trim()) throw new Error("projectId is required.");
    const deleted = await projects.delete(principal.id, projectId);
    if (!deleted) throw new Error("Project not found.");
    return { deleted: true, projectId };
  });
  return new MCPServer(registry);
}
