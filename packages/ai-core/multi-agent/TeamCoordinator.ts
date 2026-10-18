export class TeamCoordinator {
 coordinate(tasks:string[],agents:string[]){return tasks.map((task,i)=>({task,agent:agents[i%agents.length]}));}
}
