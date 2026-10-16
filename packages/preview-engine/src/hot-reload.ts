export class HotReload {
  listeners:Array<()=>void>=[];

  subscribe(callback:()=>void){
    this.listeners.push(callback);
  }

  refresh(){
    this.listeners.forEach(fn=>fn());
  }
}
