export interface PluginManifest {
  name: string;
  version: string;
  description?: string;
  type: 'agent' | 'skill' | 'tool';
  entry: string;
}
