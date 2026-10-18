export interface PreviewOptions {
  port?: number;
}

export class PreviewServer {
  port:number;

  constructor(options:PreviewOptions={}) {
    this.port = options.port || 5173;
  }

  start(){
    return `Preview server running on ${this.port}`;
  }
}
