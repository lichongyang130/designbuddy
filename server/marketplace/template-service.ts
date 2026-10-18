export class TemplateService {
  createProject(templateId: string, userId: string) {
    return {
      templateId,
      userId,
      created: true,
    };
  }

  listTemplates() {
    return [];
  }
}
