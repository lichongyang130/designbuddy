import { KnowledgeRetriever } from './KnowledgeRetriever';

export class IntelligenceAgent {
  constructor(private retriever = new KnowledgeRetriever()){}
  execute(query:string, docs:{content:string}[]){
    return this.retriever.retrieve(query, docs);
  }
}
