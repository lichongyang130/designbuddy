export interface ResourceLimit {
  cpu: number;
  memory: number;
  timeout: number;
}

export class ResourceLimiter {
  constructor(private limit: ResourceLimit) {}

  getLimit() {
    return this.limit;
  }
}
