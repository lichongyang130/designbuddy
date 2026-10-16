export interface RequestContext {
  requestId: string;
  timestamp: number;
  userId?: string;
}

export function createRequestContext(userId?: string): RequestContext {
  return {
    requestId: crypto.randomUUID(),
    timestamp: Date.now(),
    userId,
  };
}
