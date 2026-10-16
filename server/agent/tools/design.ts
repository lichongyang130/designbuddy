export const designTool = {
  name: 'design',
  async execute(command: string) {
    return {
      action: command,
      status: 'ready'
    };
  }
};
