export class ToolAccessControl {
  private blocked = new Set<string>();
  block(tool: string) { this.blocked.add(tool); }
  canExecute(tool: string) { return !this.blocked.has(tool); }
}
