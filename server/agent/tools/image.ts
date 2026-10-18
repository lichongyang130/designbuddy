export const imageTool = {
  name: 'image',

  async execute(prompt: string) {
    return {
      tool: 'image',
      prompt,
      status: 'queued'
    };
  }
};
