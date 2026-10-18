export class ToolResultProcessor {
  process(name: string, result: unknown) {
    return {
      role: 'tool',
      name,
      content: JSON.stringify(result)
    };
  }
}
