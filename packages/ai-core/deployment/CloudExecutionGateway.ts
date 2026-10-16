export class CloudExecutionGateway {
  async invoke(runtime: string, payload: unknown) {
    return { runtime, payload, accepted: true };
  }
}
