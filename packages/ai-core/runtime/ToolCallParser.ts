export interface ParsedToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export class ToolCallParser {
  parse(payload: any): ParsedToolCall[] {
    const calls = payload?.tool_calls ?? payload?.content?.tool_calls ?? [];
    return calls.map((call: any) => ({
      name: call.function?.name ?? call.name,
      arguments: typeof call.function?.arguments === 'string'
        ? JSON.parse(call.function.arguments)
        : call.function?.arguments ?? call.arguments ?? {}
    }));
  }
}
