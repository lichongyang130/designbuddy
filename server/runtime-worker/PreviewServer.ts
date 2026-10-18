export interface PreviewInstance {
  id: string;
  url: string;
}

export class PreviewServer {
  createPreview(id: string): PreviewInstance {
    return {
      id,
      url: `/preview/${id}`
    };
  }
}
