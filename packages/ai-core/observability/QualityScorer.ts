export class QualityScorer { score(values:number[]){return values.length?values.reduce((a,b)=>a+b,0)/values.length:0} }
