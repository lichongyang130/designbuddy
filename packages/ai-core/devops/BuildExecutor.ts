export class BuildExecutor {
  async execute(source: string) {
    return { source, status: 'built', timestamp: Date.now() };
  }
}
