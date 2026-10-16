export interface Document {
  id: string;
  content: string;
}

export class DocumentLoader {
  load(content: string): Document {
    return {
      id: crypto.randomUUID(),
      content
    };
  }
}
