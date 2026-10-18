export class RetryStrategy {
 shouldRetry(attempt:number,max:number){return attempt<max;}
}
