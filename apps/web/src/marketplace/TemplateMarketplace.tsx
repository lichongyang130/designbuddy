import React from 'react';
import { TemplateCard } from './TemplateCard';

const templates = [
  { name: 'SaaS Website Template', type: 'Website', skill: 'Web Design Agent' },
  { name: 'Business Plan PPT', type: 'Presentation', skill: 'PPT Expert' },
  { name: 'Data Analysis Dashboard', type: 'Data', skill: 'Data Analyst' }
];

export default function TemplateMarketplace(){
 return <section>
  <h1>Template Marketplace</h1>
  <p>Ready-to-use AI production templates.</p>
  {templates.map(t => <TemplateCard key={t.name} template={t}/>) }
 </section>;
}
