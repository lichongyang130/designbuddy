export class ResourceScheduler {
  allocate(cpu: number, memory: number) { return { cpu, memory }; }
  release(id: string) { return id; }
}
