export interface SkillInstall {
  userId: string;
  skillId: string;
  installedAt: Date;
}

export class SkillService {
  install(data: SkillInstall) {
    return { success: true, ...data };
  }

  listSkills() {
    return [];
  }
}
