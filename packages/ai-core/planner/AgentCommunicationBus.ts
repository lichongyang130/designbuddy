export class AgentCommunicationBus {
 private handlers=new Map<string,Function[]>();
 on(type:string,handler:Function){this.handlers.set(type,[...(this.handlers.get(type)||[]),handler])}
 emit(type:string,data:any){for(const h of this.handlers.get(type)||[])h(data)}
}
