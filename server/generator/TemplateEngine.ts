export class TemplateEngine {
  render(template: string, variables: Record<string,string>) {
    return Object.entries(variables).reduce(
      (result,[key,value])=>result.replaceAll(`{{${key}}}`,value),
      template
    );
  }
}
