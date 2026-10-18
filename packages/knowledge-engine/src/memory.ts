export interface MemoryItem {
  key:string;
  value:string;
}

export class DesignMemory {
  private items:MemoryItem[]=[];

  save(item:MemoryItem){
    this.items.push(item);
  }

  list(){
    return this.items;
  }
}
