import type { Expert } from './Expert';

export function attachSkill(expert: Expert, skillId: string): Expert {
  return {
    ...expert,
    skills: [...new Set([...expert.skills, skillId])],
  };
}

export function createExpertRuntime(expert: Expert) {
  return {
    expert,
    execute(task: string) {
      return {
        expert: expert.name,
        task,
        skills: expert.skills,
      };
    },
  };
}
