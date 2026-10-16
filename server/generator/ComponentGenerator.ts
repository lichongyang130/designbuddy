export interface ComponentSchema {
  name: string;
  type: string;
  props: Record<string, unknown>;
}

export class ComponentGenerator {
  create(schema: ComponentSchema) {
    return {
      fileName: `${schema.name}.tsx`,
      schema
    };
  }
}
