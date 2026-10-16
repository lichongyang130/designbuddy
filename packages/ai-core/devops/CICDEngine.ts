export class CICDEngine {
  async run(pipeline: { id: string; stages: string[] }) {
    return { pipelineId: pipeline.id, status: 'running', stages: pipeline.stages };
  }
}
