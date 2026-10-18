export const codeTool = {
  name: 'code',

  async execute(code: string) {
    return {
      tool: 'code',
      preview: code,
      status: 'generated'
    };
  }
};
