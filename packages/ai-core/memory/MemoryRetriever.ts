export class MemoryRetriever { constructor(private store:any){} retrieve(query:string){return this.store.search?.(query) ?? [];}}
