export interface AIUsage {
  userId:string;
  tokens:number;
  requests:number;
  updatedAt:Date;
}

export function recordUsage(usage:AIUsage, tokens:number){
  usage.tokens += tokens;
  usage.requests += 1;
  usage.updatedAt = new Date();
}
