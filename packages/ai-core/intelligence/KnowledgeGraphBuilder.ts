export interface KnowledgeNode { id:string; links:string[] }

export class KnowledgeGraphBuilder {
  build(nodes:KnowledgeNode[]){ return {nodes}; }
}
