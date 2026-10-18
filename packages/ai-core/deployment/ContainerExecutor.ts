export class ContainerExecutor {
  async execute(image: string, command: string[]) {
    return { image, command, status: 'scheduled' };
  }
}
