export class TaskPriorityQueue {
 private queue:any[]=[];
 push(task:any){this.queue.push(task);this.queue.sort((a,b)=>b.priority-a.priority)}
 pop(){return this.queue.shift()}
}
