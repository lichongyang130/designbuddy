export interface PluginAuthorization {
  userId: string;
  pluginId: string;
  permissions: string[];
}

export class PluginService {
  authorize(data: PluginAuthorization) {
    return { authorized: true, ...data };
  }

  listPlugins() {
    return [];
  }
}
