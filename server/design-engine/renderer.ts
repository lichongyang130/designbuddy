export class Renderer {
  render(tree: unknown) {
    return {
      type: 'ui-tree',
      tree
    };
  }
}
