export class SemanticMemory {private data=new Map<string,string>(); set(key:string,value:string){this.data.set(key,value);} get(key:string){return this.data.get(key);}}
