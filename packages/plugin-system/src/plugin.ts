export interface Plugin {
  name: string;
  version: string;
  type: string;
  activate(): Promise<void>;
  deactivate(): Promise<void>;
}
