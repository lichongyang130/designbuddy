import fs from 'fs';
const file = 'apps/web/src/inspiration/samples/GenericDocument.tsx';
let content = fs.readFileSync(file, 'utf-8');

const textGenerationLogic = `
const generatePlaceholderText = (templateId: string, pageIndex: number) => {
  const seed = parseInt(templateId.split('-')[1]) || 1;
  const topics = [
    "在当前高度不确定的市场环境中，我们的核心战略必须转向以用户价值为基础的深度创新。数据表明，过去三个季度的用户留存率与我们对核心交互体验的打磨程度呈高度正相关。因此，接下来的研发资源将优先向底层性能优化与跨端体验一致性倾斜。同时，我们需要建立更加敏捷的反馈闭环，确保每一项微小的改进都能被真实的用户感知并转化为可量化的业务指标。",
    "本报告的第二部分重点分析了竞品的演进路线。通过对市场头部产品的跟踪，我们发现模块化与插件化已成为不可逆转的趋势。未来的系统不再是一个封闭的黑盒，而是一个能够与各种第三方服务无缝对接的开放生态。这不仅要求我们在架构设计上保持极高的灵活性，更需要我们在安全与合规层面制定更为严苛的标准。",
    "关于设计的价值，我们认为它早已超越了单纯的视觉美化。优秀的设计是业务逻辑的最佳翻译官，它能够降低用户的认知成本，引导他们流畅地完成复杂的任务。在这份企划中，我们尝试引入了一种全新的设计语言。它摈弃了繁冗的装饰，将重点放在了信息层级的清晰呈现与核心操作的无缝衔接上。",
    "从商业化变现的角度来看，单纯的流量红利时代已经结束。精细化运营与全生命周期管理才是下一阶段的重点。我们需要在不损害用户体验的前提下，探索更加原生和上下文相关的商业化场景。例如，基于用户当前所处的任务流，提供精准的工具推荐，不仅能提升转化率，还能让用户感受到产品的智能与贴心。",
    "最后，关于团队协作与交付标准。随着项目复杂度的提升，传统的线性交付模式已经难以应对快速变化的需求。我们需要推动设计、研发与测试的深度融合。通过建立统一的设计组件库和规范代码库，我们可以在早期阶段就暴露出绝大多数潜在问题，从而大幅缩短整体的交付周期，并保证最终产出的质量下限。"
  ];
  
  const index1 = (seed + pageIndex * 3) % topics.length;
  const index2 = (seed + pageIndex * 7 + 1) % topics.length;
  const index3 = (seed + pageIndex * 11 + 2) % topics.length;
  
  return [topics[index1], topics[index2], topics[index3]];
};
`;

content = content.replace(
  'export function GenericDocument({ draftId, sample }: { draftId?: string; sample: any }) {',
  textGenerationLogic + '\nexport function GenericDocument({ draftId, sample }: { draftId?: string; sample: any }) {'
);

// We need to change the body render block
const targetRenderRegex = /\{editing \? \([\s\S]*?\) : \([\s\S]*?<\/p>\n\s*\)\}/;

const newRenderBlock = `{editing ? (
                          <textarea 
                            value={s.bodies[i] || generatePlaceholderText(sample.id, i).join('\\n\\n')}
                            onChange={(e) => set((prev) => ({ ...prev, bodies: { ...prev.bodies, [i]: e.target.value }}))}
                            style={{ width: '100%', minHeight: '300px', border: '1px solid #ddd', borderRadius: '4px', padding: '12px', fontSize: '15px', lineHeight: 1.8, fontFamily: 'inherit' }}
                          />
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', lineHeight: 2.2, color: '#4b5563', fontSize: '15px', letterSpacing: '0.02em', textAlign: 'justify' }}>
                            {(s.bodies[i] || generatePlaceholderText(sample.id, i).join('\\n\\n')).split('\\n\\n').map((paragraph: string, pIndex: number) => (
                              <p key={pIndex}>{paragraph}</p>
                            ))}
                          </div>
                        )}`;

content = content.replace(targetRenderRegex, newRenderBlock);

fs.writeFileSync(file, content, 'utf-8');
