export interface DesignComponent {
  id: string;
  type: string;
  props: Record<string, unknown>;
}

export class ComponentParser {
  parse(node: unknown): DesignComponent {
    return {
      id: crypto.randomUUID(),
      type: 'component',
      props: { source: node }
    };
  }
}
