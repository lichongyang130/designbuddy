export interface GeneratedFile {
  path: string;
  content: string;
}

export class CodeGenerator {
  generate(componentName: string): GeneratedFile {
    return {
      path: `${componentName}.tsx`,
      content: `export default function ${componentName}(){ return null; }`
    };
  }
}
