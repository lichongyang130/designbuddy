import {VectorStore} from './vector-store';

export class Retriever {
  constructor(private store:VectorStore){}

  retrieve(query:string){
    const vector=query.split('').map(c=>c.charCodeAt(0));
    return this.store.search(vector);
  }
}
