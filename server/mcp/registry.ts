import type { MCPToolDefinition, MCPToolHandler } from "./protocol";

export interface RegisteredMCPTool extends MCPToolDefinition {
  handler: MCPToolHandler;
}

export class MCPRegistry {
  private tools = new Map<string, RegisteredMCPTool>();

  register(definition: MCPToolDefinition, handler: MCPToolHandler): void {
    if (!/^[a-zA-Z0-9_.-]+$/.test(definition.name)) throw new Error("MCP tool name contains unsupported characters.");
    if (this.tools.has(definition.name)) throw new Error(`MCP tool already registered: ${definition.name}`);
    this.tools.set(definition.name, { ...definition, handler });
  }

  get(name: string): RegisteredMCPTool | undefined {
    return this.tools.get(name);
  }

  list(): MCPToolDefinition[] {
    return [...this.tools.values()].map(({ handler: _handler, ...definition }) => definition);
  }
}
