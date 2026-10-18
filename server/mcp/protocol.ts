/** Minimal MCP-compatible tool description used by the server-side adapter. */
export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

export type MCPToolHandler<TInput = unknown, TResult = unknown> = (input: TInput) => TResult | Promise<TResult>;

export interface MCPRequest {
  tool: string;
  input: unknown;
}

export interface MCPResponse {
  success: boolean;
  result?: unknown;
  error?: { code: "TOOL_NOT_FOUND" | "INVALID_INPUT" | "TOOL_ERROR"; message: string };
}
