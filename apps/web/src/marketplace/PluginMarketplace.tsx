import React from 'react';
import { PluginCard } from './PluginCard';

export default function PluginMarketplace(){
 const plugins=[
  {name:'GPT Model Connector',category:'AI模型插件'},
  {name:'Office Assistant',category:'办公插件'},
  {name:'MCP Enterprise Connector',category:'企业连接器'},
 ];
 return <section><h1>Plugin Marketplace</h1>{plugins.map(p=><PluginCard key={p.name} plugin={{ name: p.name, description: p.category, version: '' }}/>)}</section>;
}
