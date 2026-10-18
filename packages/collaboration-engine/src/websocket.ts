export interface SocketMessage {
  type: string;
  payload: unknown;
}

export class CollaborationSocket {
  send(message: SocketMessage) {
    return message;
  }

  broadcast(message: SocketMessage) {
    return message;
  }
}
