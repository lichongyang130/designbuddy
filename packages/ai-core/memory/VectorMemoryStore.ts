export interface VectorRecord { id:string; vector:number[]; content:string; metadata?:Record<string,unknown>; }
export class VectorMemoryStore {
 private records:VectorRecord[]=[];
 add(record:VectorRecord){this.records.push(record);}
 search(vector:number[],limit=5){return this.records.slice(0,limit);}
}
