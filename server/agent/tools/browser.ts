export const browserTool = {
  name: 'browser',

  async execute(url: string) {
    return {
      tool: 'browser',
      url,
      status: 'ready'
    };
  }
};
