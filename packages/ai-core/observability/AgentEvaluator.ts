export interface EvaluationResult { score:number; feedback:string }
export class AgentEvaluator { evaluate(input:string):EvaluationResult{return {score:0,feedback:`evaluate:${input}`}} }
