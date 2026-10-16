export interface StorageAdapter {
  save(key:string,value:string):Promise<void>;
  load(key:string):Promise<string | null>;
}

export class MemoryStorage implements StorageAdapter {
 private store = new Map<string,string>();

 async save(key:string,value:string){
  this.store.set(key,value);
 }

 async load(key:string){
  return this.store.get(key) ?? null;
 }
}
