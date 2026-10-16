export class GoalDecomposer {
  decompose(goal:string):string[]{
    return goal.split('->').map(v=>v.trim());
  }
}
