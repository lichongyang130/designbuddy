export interface PreviewRoute {
  sessionId: string;
  url: string;
}

export class PreviewRouter {
  create(sessionId: string): PreviewRoute {
    return {
      sessionId,
      url: `/preview/${sessionId}`
    };
  }
}
