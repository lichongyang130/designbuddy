export interface VectorRecord {
  id:string;
  text:string;
  embedding:number[];
  metadata?:Record<string,unknown>;
}

export class VectorStore {
  private records:VectorRecord[]=[];

  add(record:VectorRecord){
    this.records.push(record);
  }

  search(queryVector:number[],limit=5){
    return this.records.slice(0,limit);
  }
}
