export class SharedWorkspace {
 private data=new Map<string,unknown>();
 set(key:string,value:unknown){this.data.set(key,value);}
 get(key:string){return this.data.get(key);}
}
