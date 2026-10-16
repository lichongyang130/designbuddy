export interface KnowledgeDocument { id:string; title:string; content:string; metadata?:Record<string,unknown> }

export class EnterpriseKnowledgeBase {
  private documents = new Map<string, KnowledgeDocument>();
  add(document: KnowledgeDocument){ this.documents.set(document.id, document); return document; }
  get(id:string){ return this.documents.get(id); }
  all(){ return [...this.documents.values()]; }
}
