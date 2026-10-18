export const filesystemTool = {
  name: 'filesystem',
  async execute(input: unknown) {
    return {
      tool: 'filesystem',
      input
    };
  }
};
