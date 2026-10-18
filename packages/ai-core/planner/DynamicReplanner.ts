export class DynamicReplanner {
  async replan(context:any, failure:any){
    return {reason:failure, steps:context.remainingSteps ?? []};
  }
}
