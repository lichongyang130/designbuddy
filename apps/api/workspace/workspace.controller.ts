export class WorkspaceController {
  create(name: string, ownerId: string) {
    return {
      id: crypto.randomUUID(),
      name,
      ownerId,
    };
  }

  getWorkspace(id: string) {
    return { id };
  }
}
