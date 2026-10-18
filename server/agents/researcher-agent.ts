export class ResearcherAgent {
  async research(topic:string) {
    return {
      role:'researcher',
      topic,
      findings:[]
    };
  }
}
