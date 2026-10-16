import { ToolRegistry } from '../tools/ToolRegistry';

export class AgentExecutor {
  constructor(private registry: ToolRegistry) {}

  async execute(action: string, input: unknown) {
    const tool = this.registry.get(action);

    if (!tool) {
      throw new Error(`Tool not found: ${action}`);
    }

    return tool.execute(input);
  }
}
