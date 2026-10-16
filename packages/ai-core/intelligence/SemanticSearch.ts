export class SemanticSearch {
  search(query:string, items:string[]){
    return items.filter(item=>item.includes(query));
  }
}
