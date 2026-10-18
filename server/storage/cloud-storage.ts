export interface CloudStorage {
  upload(path: string, content: string): Promise<string>;
  download(path: string): Promise<string | null>;
  delete(path: string): Promise<boolean>;
}

export class LocalCloudStorage implements CloudStorage {
  private files = new Map<string, string>();

  async upload(path: string, content: string) {
    this.files.set(path, content);
    return path;
  }

  async download(path: string) {
    return this.files.get(path) ?? null;
  }

  async delete(path: string) {
    return this.files.delete(path);
  }
}
