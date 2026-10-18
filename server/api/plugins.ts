export interface Plugin {
  id: string;
  name: string;
  enabled: boolean;
}

const plugins: Plugin[] = [];

export function listPlugins() {
  return plugins;
}

export function installPlugin(plugin: Plugin) {
  plugins.push(plugin);
  return plugin;
}

export function removePlugin(id: string) {
  const index = plugins.findIndex((item) => item.id === id);
  if (index >= 0) plugins.splice(index, 1);
  return true;
}

export function enablePlugin(id: string) {
  const plugin = plugins.find((item) => item.id === id);
  if (plugin) plugin.enabled = true;
  return plugin;
}
