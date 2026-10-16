export interface RealtimeEvent {
  type: string;
  workspaceId: string;
  payload: unknown;
}

export class RealtimeGateway {
  broadcast(event: RealtimeEvent) {
    return event;
  }
}
