export interface Feedback { score:number; comment?:string; metadata?:Record<string,unknown> }
export class FeedbackCollector { private items:Feedback[]=[]; collect(feedback:Feedback){this.items.push(feedback); return feedback;} list(){return this.items;} }
