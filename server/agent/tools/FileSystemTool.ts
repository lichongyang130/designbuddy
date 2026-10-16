export interface FileOperation {
  path: string;
  content?: string;
}

export class FileSystemTool {
  name = 'filesystem';

  async read(operation: FileOperation) {
    return {
      path: operation.path,
      content: ''
    };
  }

  async write(operation: FileOperation) {
    return {
      success: true,
      path: operation.path
    };
  }
}
