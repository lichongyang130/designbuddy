import React from 'react';

export function SkillCard({ skill }: { skill: any }) {
  return <article>
    <h3>{skill.name}</h3>
    <p>{skill.description}</p>
    <span>{skill.author}</span>
    <span> ⭐ {skill.rating}</span>
    <span> {skill.installs} installs</span>
    <button>安装</button>
  </article>;
}
