export interface TimelineEntry { name:string; start:number; end?:number }
export class ExecutionTimeline { private items:TimelineEntry[]=[]; add(item:TimelineEntry){this.items.push(item)} list(){return this.items} }
