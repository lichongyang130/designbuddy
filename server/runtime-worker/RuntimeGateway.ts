export class RuntimeGateway {
  constructor(private readonly api: unknown) {}

  connect() {
    return {
      connected: true,
      api: this.api
    };
  }
}
