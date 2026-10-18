export class BenchmarkRunner { async run(tasks:Function[]){return Promise.all(tasks.map(t=>t()))} }
