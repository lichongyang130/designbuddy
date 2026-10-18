export class AnswerEngine {
  answer(context:string, question:string){
    return `Answer generated for ${question}: ${context}`;
  }
}
