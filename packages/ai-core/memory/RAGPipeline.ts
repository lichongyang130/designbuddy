export class RAGPipeline { constructor(private retriever:any){} async query(input:string){return {input,context:this.retriever.retrieve(input)};}}
