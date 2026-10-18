export class DataPipeline {
  private stages: string[] = [];
  addStage(stage: string) { this.stages.push(stage); return this; }
  run(input: unknown) { return { input, stages: this.stages }; }
}
