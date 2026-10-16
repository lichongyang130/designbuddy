export class NodeConverter {
  convert(node:any){
    return {
      type: node.type,
      props: node.properties || {}
    };
  }
}
