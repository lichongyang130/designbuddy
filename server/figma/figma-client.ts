export interface FigmaClientConfig {
  token: string;
}

export class FigmaClient {
  constructor(private config: FigmaClientConfig) {}

  async getFile(fileId: string) {
    return {
      id: fileId,
      source: 'figma'
    };
  }
}
