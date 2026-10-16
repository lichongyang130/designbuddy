export interface DesignMemoryItem {
  projectId: string;
  profile: Record<string, unknown>;
}

export class DesignMemory {
  private items: DesignMemoryItem[] = [];

  save(item: DesignMemoryItem) {
    this.items.push(item);
  }

  find(projectId: string) {
    return this.items.filter(item => item.projectId === projectId);
  }
}
