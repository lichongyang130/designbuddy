export class FigmaExporter {
  export(componentTree: unknown){
    return {
      format:'figma-json',
      data:componentTree
    };
  }
}
