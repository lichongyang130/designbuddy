import React from 'react';
import { PluginCard, PluginInfo } from './PluginCard';

const plugins:PluginInfo[] = [
  {name:'AI Web Designer',description:'Generate landing pages with AI',version:'1.0.0'},
  {name:'UI Component Builder',description:'Create reusable UI components',version:'1.0.0'},
  {name:'PPT Generator',description:'Generate presentation slides',version:'1.0.0'}
];

export function PluginList(){
 return <div>{plugins.map(p=><PluginCard key={p.name} plugin={p}/>)}</div>;
}
