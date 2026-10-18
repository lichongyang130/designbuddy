export interface EmbeddingProvider {
  embed(text:string):Promise<number[]>;
}

export class SimpleEmbedding implements EmbeddingProvider {
  async embed(text:string){
    return Array.from(text).map(c=>c.charCodeAt(0));
  }
}
