import React from 'react';
import { SkillCard } from './SkillCard';
import { CategoryFilter } from './CategoryFilter';

const skills = [
  { name: '会议纪要专家', description: '自动整理会议记录并生成任务列表', author: 'DesignBuddy', rating: 4.9, installs: 1200 },
  { name: '商业计划书生成', description: '生成投资级商业计划书', author: 'DesignBuddy', rating: 4.8, installs: 980 }
];

export default function SkillMarketplace() {
  return <section>
    <h1>Skill Marketplace</h1>
    <input placeholder="搜索 Skill..." />
    <CategoryFilter />
    <h2>热门 Skill</h2>
    {skills.map(skill => <SkillCard key={skill.name} skill={skill} />)}
  </section>;
}
