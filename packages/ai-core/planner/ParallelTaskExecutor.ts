export class ParallelTaskExecutor {
  async execute(tasks:any[]){
    return Promise.all(tasks.map(t=>t.execute()));
  }
}
