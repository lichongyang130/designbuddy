export interface GatewayRequestContext {
  requestId: string;
  userId?: string;
}

export function createGatewayContext(requestId: string, userId?: string): GatewayRequestContext {
  return { requestId, userId };
}
