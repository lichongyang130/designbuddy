export type WorkflowState='CREATED'|'RUNNING'|'PAUSED'|'COMPLETED'|'FAILED'|'RECOVERING';
export class WorkflowStateMachine { private state:WorkflowState='CREATED'; transition(next:WorkflowState){this.state=next; return this.state;} getState(){return this.state;} }
