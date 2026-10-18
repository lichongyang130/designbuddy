export interface WorkflowKnowledge { workflowId:string; knowledge:string[] }
export class WorkflowKnowledgeMapper { map(workflowId:string, knowledge:string[]):WorkflowKnowledge{return {workflowId,knowledge}} }
