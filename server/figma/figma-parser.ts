export interface FigmaNode {
  id:string;
  type:string;
  children?:FigmaNode[];
}

export class FigmaParser {
  parse(node:FigmaNode){
    return {
      component: node.type,
      children: node.children || []
    };
  }
}
