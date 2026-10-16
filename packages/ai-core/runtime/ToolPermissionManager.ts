export interface ToolPermissionPolicy {
  allowedTools: string[];
}

export class ToolPermissionManager {
  constructor(private policy: ToolPermissionPolicy) {}

  canExecute(toolName: string): boolean {
    return this.policy.allowedTools.includes(toolName);
  }

  check(toolName: string) {
    if (!this.canExecute(toolName)) {
      throw new Error(`Tool permission denied: ${toolName}`);
    }
  }
}
