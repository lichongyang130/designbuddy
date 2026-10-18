export class ReleaseOrchestrator {
  async release(version: string) {
    return { version, stage: 'release' };
  }
}
