export interface LayoutNode {
  children?: LayoutNode[];
  style?: Record<string, unknown>;
}

export class LayoutEngine {
  calculate(node: LayoutNode) {
    return {
      ...node,
      calculated: true
    };
  }
}
