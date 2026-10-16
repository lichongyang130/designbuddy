export class DocumentIndexer {
  index(content:string){
    return { tokens: content.split(/\s+/), length: content.length };
  }
}
