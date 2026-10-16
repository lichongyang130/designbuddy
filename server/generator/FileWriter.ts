export interface GeneratedFile {
  path: string;
  content: string;
}

export class FileWriter {
  write(files: GeneratedFile[]) {
    return files.map(file => ({
      path: file.path,
      status: 'prepared'
    }));
  }
}
