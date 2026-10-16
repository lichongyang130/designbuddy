import { DocumentLoader } from './document-loader';
import { EmbeddingService } from './embeddings';

export class KnowledgeManager {
  constructor(
    private loader: DocumentLoader,
    private embedding: EmbeddingService
  ) {}

  async index(content: string) {
    const document = this.loader.load(content);
    return this.embedding.createEmbedding(document.content);
  }
}
