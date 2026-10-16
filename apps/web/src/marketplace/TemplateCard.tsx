import React from 'react';

export function TemplateCard({template}: any){
 return <article>
  <h3>{template.name}</h3>
  <p>Category: {template.type}</p>
  <p>Bound Skill: {template.skill}</p>
 </article>;
}
