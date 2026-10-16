import React from 'react';

export interface PluginInfo {
  name: string;
  description: string;
  version: string;
}

export function PluginCard({plugin}:{plugin:PluginInfo}) {
  return (
    <div className="plugin-card">
      <h3>{plugin.name}</h3>
      <p>{plugin.description}</p>
      <small>{plugin.version}</small>
      <button>Install</button>
    </div>
  );
}
