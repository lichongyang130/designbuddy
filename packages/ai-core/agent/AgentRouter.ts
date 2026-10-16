import { ExpertService } from '../experts/ExpertService';
import { SkillService } from '../skills/SkillService';

export class AgentRouter {
  constructor(
    private expertService: ExpertService,
    private skillService: SkillService
  ) {}

  async execute(expertId: string, input: unknown) {
    const expert = this.expertService.get(expertId);

    if (!expert) {
      throw new Error(`Expert ${expertId} not found`);
    }

    const results = [];

    for (const skillId of expert.skills) {
      results.push(await this.skillService.execute(skillId, input));
    }

    return {
      expert,
      results
    };
  }
}
