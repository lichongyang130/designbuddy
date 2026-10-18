export class TemplateEngine {
  render(template:string, data:Record<string,unknown>) {
    return template.replace(/{{(.*?)}}/g, (_,key)=>String(data[key.trim()] ?? ''));
  }
}
