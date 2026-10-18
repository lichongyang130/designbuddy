export interface SocketClient {
  id: string;
  userId: string;
}

export class CollaborationWebSocketServer {
  clients: SocketClient[] = [];

  connect(client: SocketClient) {
    this.clients.push(client);
  }

  broadcast(message: unknown) {
    return { delivered: true, message };
  }
}
