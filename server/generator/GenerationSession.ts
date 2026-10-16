export interface GenerationSession {
  id: string;
  prompt: string;
  status: 'created' | 'generating' | 'completed' | 'failed';
  files: string[];
}

export class GenerationSessionManager {
  private sessions = new Map<string, GenerationSession>();

  create(prompt: string): GenerationSession {
    const session = {
      id: crypto.randomUUID(),
      prompt,
      status: 'created' as const,
      files: []
    };
    this.sessions.set(session.id, session);
    return session;
  }

  get(id: string) {
    return this.sessions.get(id);
  }
}
