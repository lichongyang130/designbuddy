export class WebSocketClient {
  private socket?: WebSocket;

  connect(url: string) {
    this.socket = new WebSocket(url);
  }

  send(payload: unknown) {
    this.socket?.send(JSON.stringify(payload));
  }

  onMessage(handler: (event: MessageEvent) => void) {
    if (this.socket) this.socket.onmessage = handler;
  }

  close() {
    this.socket?.close();
  }
}
