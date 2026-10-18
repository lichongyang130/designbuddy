export interface CodeExecutionRequest {
  language: string;
  code: string;
}

export class CodeExecutionTool {
  name = 'code_execution';

  async execute(request: CodeExecutionRequest) {
    return {
      language: request.language,
      output: '',
      sandbox: true
    };
  }
}
