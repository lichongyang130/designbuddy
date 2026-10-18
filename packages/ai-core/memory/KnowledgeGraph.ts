export interface KnowledgeNode {id:string; label:string;}
export class KnowledgeGraph {nodes:KnowledgeNode[]=[]; add(node:KnowledgeNode){this.nodes.push(node);}}
