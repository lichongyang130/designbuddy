export class PipelineMonitor {
  inspect(id: string) {
    return { pipelineId: id, health: 'healthy' };
  }
}
