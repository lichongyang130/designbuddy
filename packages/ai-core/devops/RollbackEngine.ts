export class RollbackEngine {
  async rollback(version: string) {
    return { version, status: 'rollback-completed' };
  }
}
