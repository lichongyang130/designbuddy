export interface CodeGenerationRequest {
  framework: string;
  componentTree: unknown;
}

export class CodeGenerator {
  generate(request: CodeGenerationRequest) {
    return `// Generated ${request.framework} component`;
  }
}
