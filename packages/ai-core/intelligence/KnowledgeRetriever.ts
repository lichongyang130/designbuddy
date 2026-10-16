export class KnowledgeRetriever {
  retrieve(query:string, docs:{content:string}[]){
    return docs.filter(d=>d.content.toLowerCase().includes(query.toLowerCase()));
  }
}
