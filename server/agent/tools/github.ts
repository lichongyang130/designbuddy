export const githubTool = {
  name: 'github',

  async execute(action: string) {
    return {
      tool: 'github',
      action,
      status: 'ready'
    };
  }
};
