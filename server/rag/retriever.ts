import { VectorStore } from './vector-store';

export class Retriever {
  constructor(private store: VectorStore) {}

  retrieve(queryVector: number[]) {
    return this.store.search(queryVector);
  }
}
