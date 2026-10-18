import { PluginManifest } from './manifest';

export class PluginLoader {
  async load(manifest: PluginManifest) {
    return {
      loaded: true,
      plugin: manifest.name,
    };
  }
}
