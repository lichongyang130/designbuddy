export interface Expert {
  id: string;
  name: string;
  avatar?: string;
  role: string;
  description: string;
  systemPrompt: string;
  skills: string[];
  tools: string[];
  knowledgeBases?: string[];
  modelConfig?: {
    provider: string;
    model: string;
  };
  createdAt: string;
}

export class ExpertRegistry {
  private experts: Map<string, Expert> = new Map();

  register(expert: Expert) {
    this.experts.set(expert.id, expert);
  }

  get(id: string) {
    return this.experts.get(id);
  }

  list() {
    return Array.from(this.experts.values());
  }
}
