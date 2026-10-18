export class BusinessRuleEngine { evaluate(rule:string,context:Record<string,unknown>):boolean{return Boolean(rule&&context)} }
