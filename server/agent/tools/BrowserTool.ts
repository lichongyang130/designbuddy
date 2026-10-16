export interface BrowserAction {
  url: string;
  action: 'open' | 'capture';
}

export class BrowserTool {
  name = 'browser';

  async execute(input: BrowserAction) {
    return {
      url: input.url,
      action: input.action,
      status: 'queued'
    };
  }
}
