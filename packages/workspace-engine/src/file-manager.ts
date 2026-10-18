export interface WorkspaceFile {
  path: string;
  content: string;
  type: string;
}

export class FileManager {
  private files: WorkspaceFile[] = [];

  save(file: WorkspaceFile) {
    this.files.push(file);
  }

  list() {
    return this.files;
  }
}
