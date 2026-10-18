import { MCPRegistry } from './registry';
import type { MCPRequest, MCPResponse } from './protocol';

export class MCPServer {
  constructor(private registry: MCPRegistry) {}

  listTools() {
    return this.registry.list();
  }

  async call(tool: string, input: unknown): Promise<MCPResponse> {
    const registered = this.registry.get(tool);
    if (!registered) return { success: false, error: { code: "TOOL_NOT_FOUND", message: `Unknown MCP tool: ${tool}` } };
    if (input !== undefined && (input === null || typeof input !== "object" || Array.isArray(input))) {
      return { success: false, error: { code: "INVALID_INPUT", message: "Tool input must be a JSON object." } };
    }
    try {
      return { success: true, result: await registered.handler(input ?? {}) };
    } catch (error) {
      return {
        success: false,
        error: { code: "TOOL_ERROR", message: error instanceof Error ? error.message : "MCP tool failed." },
      };
    }
  }

  async handle(request: MCPRequest): Promise<MCPResponse> {
    return this.call(request.tool, request.input);
  }

  async handleJSONRPC(value: unknown): Promise<Record<string, unknown> | null> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid Request" } };
    const request = value as { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown };
    if (request.jsonrpc !== "2.0" || typeof request.method !== "string") {
      return { jsonrpc: "2.0", id: request.id ?? null, error: { code: -32600, message: "Invalid Request" } };
    }
    const id = request.id;
    const params = request.params && typeof request.params === "object" ? request.params as Record<string, unknown> : {};
    const meta = params._meta && typeof params._meta === "object" ? params._meta as Record<string, unknown> : {};
    const protocolVersion = meta["io.modelcontextprotocol/protocolVersion"];
    const modern = protocolVersion === "2026-07-28";
    if (request.method.startsWith("notifications/")) return null;
    if (request.method === "server/discover") {
      return { jsonrpc: "2.0", id, result: {
        resultType: "complete", supportedVersions: ["2026-07-28", "2025-03-26"],
        capabilities: { tools: { listChanged: false } },
        _meta: { "io.modelcontextprotocol/serverInfo": { name: "designbuddy", version: "0.1.0" } },
        ttlMs: 30_000, cacheScope: "private",
      } };
    }
    if (request.method === "initialize") {
      return { jsonrpc: "2.0", id, result: { protocolVersion: "2025-03-26", capabilities: { tools: { listChanged: false } }, serverInfo: { name: "designbuddy", version: "0.1.0" } } };
    }
    if (request.method === "ping") return { jsonrpc: "2.0", id, result: {} };
    if (request.method === "tools/list") {
      return { jsonrpc: "2.0", id, result: { ...(modern ? { resultType: "complete" } : {}), tools: this.listTools(), ...(modern ? { ttlMs: 30_000, cacheScope: "private", _meta: { "io.modelcontextprotocol/serverInfo": { name: "designbuddy", version: "0.1.0" } } } : {}) } };
    }
    if (request.method === "tools/call") {
      if (typeof params.name !== "string") return { jsonrpc: "2.0", id, error: { code: -32602, message: "Tool name is required." } };
      const response = await this.call(params.name, params.arguments ?? {});
      if (!response.success) return { jsonrpc: "2.0", id, result: { ...(modern ? { resultType: "complete" } : {}), isError: true, content: [{ type: "text", text: response.error?.message ?? "Tool call failed." }], ...(modern ? { _meta: { "io.modelcontextprotocol/serverInfo": { name: "designbuddy", version: "0.1.0" } } } : {}) } };
      const result = response.result;
      const structuredContent = result && typeof result === "object" && !Array.isArray(result) ? { structuredContent: result } : {};
      return { jsonrpc: "2.0", id, result: { ...(modern ? { resultType: "complete" } : {}), isError: false, content: [{ type: "text", text: typeof result === "string" ? result : JSON.stringify(result) }], ...structuredContent, ...(modern ? { _meta: { "io.modelcontextprotocol/serverInfo": { name: "designbuddy", version: "0.1.0" } } } : {}) } };
    }
    return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${request.method}` } };
  }
}
