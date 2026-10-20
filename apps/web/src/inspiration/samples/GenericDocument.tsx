import { useEffect, useRef, useState } from "react";
import { SampleTop, Notice, copySample, download, useSampleState, type SampleId, type Photo } from "./shared";
import "./samples.css";


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

export function GenericDocument({ draftId, sample }: { draftId?: string; sample: any }) {
  const [s, set, error] = useSampleState(sample.id as SampleId, draftId, {
    page: 0,
    titles: {} as Record<number, string>,
    bodies: {} as Record<number, string>,
    continuous: false,
  });

  const [notice, msg] = useState("");
  const [zoom, scale] = useState(100);
  const [editing, edit] = useState(false);
  
  const papers = useRef<(HTMLDivElement | null)[]>([]);
  const active = Math.max(0, Math.min(sample.photos.length - 1, s.page));
  
  const jump = (page: number) => {
    set((v) => ({ ...v, page }));
    papers.current[page]?.scrollIntoView({ block: "start", behavior: "auto" });
  };

  return (
    <main className="sample-view report-view">
      <SampleTop
        type={`分页文档 · A4 · ${sample.photos.length}页`}
        title={sample.title}
        draftId={draftId}
        onCopy={() => {
          try {
            copySample(sample.id as SampleId, s);
          } catch {
            msg("副本保存失败，请下载文稿备份。");
          }
        }}
      >
        <button onClick={() => window.print()}>直接打印 (A4)</button>
      </SampleTop>
      <Notice text={error || notice} />
      
      <div className="report-workspace">
        <aside className="report-outline">
          <div className="report-outline-head">
            <h3>文档大纲</h3>
            <button aria-pressed={editing} onClick={() => edit(!editing)}>
              {editing ? "退出编辑" : "直接修改内容"}
            </button>
          </div>
          <nav>
            {sample.photos.map((p: Photo, i: number) => {
              const label = s.titles[i] || `第 \${i + 1} 页：\${p.label.split(' - ')[0]}`;
              return (
                <button
                  key={i}
                  className={active === i ? "active" : ""}
                  onClick={() => jump(i)}
                >
                  <span className="outline-page">{i + 1}</span>
                  <span className="outline-text">{label}</span>
                </button>
              );
            })}
          </nav>
        </aside>
        
        <div className="report-desk">
          <div className="report-canvas">
            <div className="report-pages" data-zoom={zoom}>
              <style>{`.report-pages[data-zoom="${zoom}"] { transform: scale(${zoom / 100}); transform-origin: top center; }`}</style>
              <div className={s.continuous ? "papers-continuous" : "papers-discrete"}>
                {sample.photos.map((photo: Photo, i: number) => (
                  <div
                    key={i}
                    ref={(el) => { papers.current[i] = el; }}
                    className={active === i && !s.continuous ? "active-paper-wrap" : ""}
                    onClick={() => !s.continuous && active !== i && jump(i)}
                  >
                    <article className="report-paper generic-doc-paper" data-report-page={i + 1}>
                      <header>
                        <span>{sample.title}</span>
                        <span>{sample.category} / 2026</span>
                      </header>
                                            <div className="paper-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {editing ? (
                          <input 
                            value={s.titles[i] || `章节 ${i + 1}: ${photo.label}`}
                            onChange={(e) => set((prev) => ({ ...prev, titles: { ...prev.titles, [i]: e.target.value }}))}
                            style={{ fontSize: '24px', fontWeight: 'bold', width: '100%', border: 'none', borderBottom: '1px solid #ddd', paddingBottom: '8px' }}
                          />
                        ) : (
                          <h2 style={{ fontSize: '32px', fontWeight: 700, color: '#111827', marginBottom: '8px', letterSpacing: '-0.02em' }}>{s.titles[i] || `章节 ${i + 1}: ${photo.label}`}</h2>
                        )}
                        <img src={photo.url} alt={photo.label} style={{ width: '100%', height: 'auto', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', margin: '20px 0' }} />
                        <div style={{ flex: 1 }}>
                          {editing ? (
                            <textarea 
                              value={s.bodies[i] || generatePlaceholderText(sample.id, i).join('\n\n')}
                              onChange={(e) => set((prev) => ({ ...prev, bodies: { ...prev.bodies, [i]: e.target.value }}))}
                              style={{ width: '100%', minHeight: '300px', border: '1px solid #ddd', borderRadius: '4px', padding: '12px', fontSize: '15px', lineHeight: 1.8, fontFamily: 'inherit' }}
                            />
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', lineHeight: 2.2, color: '#4b5563', fontSize: '15px', letterSpacing: '0.02em', textAlign: 'justify' }}>
                              {(s.bodies[i] || generatePlaceholderText(sample.id, i).join('\n\n')).split('\n\n').map((paragraph: string, pIndex: number) => (
                                <p key={pIndex}>{paragraph}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <footer>
                        <span>DOCUMENT TEMPLATE</span>
                        <b>{String(i + 1).padStart(2, "0")}</b>
                      </footer>
                    </article>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="report-tools">
            <button aria-pressed={!s.continuous} onClick={() => set((v) => ({ ...v, continuous: false }))}>
              单页
            </button>
            <button aria-pressed={s.continuous} onClick={() => set((v) => ({ ...v, continuous: true }))}>
              连续
            </button>
            <div className="report-zoom">
              <button onClick={() => scale(Math.max(50, zoom - 10))}>-</button>
              <span>{zoom}%</span>
              <button onClick={() => scale(Math.min(200, zoom + 10))}>+</button>
            </div>
          </div>
        </div>
      </div>
      
      <style>{`
        
        .report-workspace {
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 0;
          height: calc(100vh - 60px);
          background: #f3f4f6;
        }
        .report-outline {
          background: #fff;
          border-right: 1px solid #e5e7eb;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
        }
        .report-outline-head {
          padding: 24px;
          border-bottom: 1px solid #e5e7eb;
          position: sticky;
          top: 0;
          background: rgba(255,255,255,0.9);
          backdrop-filter: blur(8px);
          z-index: 10;
        }
        .report-outline-head h3 {
          margin: 0 0 12px 0;
          font-size: 16px;
          font-weight: 600;
          color: #111827;
        }
        .report-outline-head button {
          width: 100%;
          padding: 8px 12px;
          background: #f3f4f6;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          color: #4b5563;
          cursor: pointer;
          transition: all 0.2s;
        }
        .report-outline-head button[aria-pressed="true"] {
          background: #111827;
          color: #fff;
        }
        .report-outline nav {
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .report-outline nav button {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border: none;
          background: transparent;
          border-radius: 6px;
          cursor: pointer;
          text-align: left;
          transition: all 0.2s;
        }
        .report-outline nav button:hover {
          background: #f9fafb;
        }
        .report-outline nav button.active {
          background: #eef2ff;
          color: #4f46e5;
        }
        .outline-page {
          font-size: 12px;
          font-weight: 600;
          color: #9ca3af;
          width: 20px;
        }
        .report-outline nav button.active .outline-page {
          color: #4f46e5;
        }
        .outline-text {
          font-size: 13px;
          font-weight: 500;
          color: #374151;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .report-desk {
          position: relative;
          overflow-y: auto;
          padding: 40px;
        }
        .report-tools {
          position: fixed;
          bottom: 32px;
          right: 32px;
          background: #fff;
          padding: 8px;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
          display: flex;
          gap: 8px;
          align-items: center;
          z-index: 100;
        }
        .report-tools button {
          padding: 8px 16px;
          border: none;
          background: transparent;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          color: #4b5563;
          cursor: pointer;
        }
        .report-tools button[aria-pressed="true"] {
          background: #f3f4f6;
          color: #111827;
        }
        .report-zoom {
          display: flex;
          align-items: center;
          gap: 8px;
          padding-left: 8px;
          border-left: 1px solid #e5e7eb;
        }
        .report-zoom span {
          font-size: 13px;
          font-weight: 600;
          width: 48px;
          text-align: center;
        }

        .generic-doc-paper {
          background: white;
          width: 21cm;
          height: 29.7cm;
          box-shadow: 0 12px 32px rgba(0,0,0,0.06), 0 2px 6px rgba(0,0,0,0.03);
          border-radius: 4px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          padding: 2.5cm 2cm;
          box-sizing: border-box;
          font-family: 'Noto Serif SC', 'Source Han Serif SC', serif;
        }
        .generic-doc-paper header {
          display: flex;
          justify-content: space-between;
          border-bottom: 2px solid #000;
          padding-bottom: 0.5cm;
          margin-bottom: 1cm;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .generic-doc-paper .paper-content {
          flex: 1;
        }
        .generic-doc-paper footer {
          display: flex;
          justify-content: space-between;
          border-top: 1px solid #ccc;
          padding-top: 0.5cm;
          margin-top: 1cm;
          font-size: 10px;
          color: #666;
        }
        .papers-discrete > div:not(.active-paper-wrap) {
          display: none;
        }
        .papers-continuous {
          display: flex;
          flex-direction: column;
          gap: 2rem;
          padding: 2rem 0;
        }
      `}</style>
    </main>
  );
}
