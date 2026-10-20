import fs from 'fs';
import path from 'path';

const commDir = 'apps/web/src/inspiration/samples/commercial';

const templates = {
  Slide: `<div style={{ flex: 1, display: 'flex', background: '#f1f5f9' }}>
      <div style={{ width: '200px', borderRight: '1px solid #e2e8f0', background: '#fff', padding: '16px', overflowY: 'auto' }}>
        {[1,2,3,4].map(i => <div key={i} style={{ aspectRatio: '16/9', background: i===1?'#e0e7ff':'#f1f5f9', border: i===1?'2px solid #4f46e5':'1px solid #cbd5e1', marginBottom: 16, borderRadius: 4 }}></div>)}
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
        <div style={{ width: '100%', maxWidth: '800px', aspectRatio: '16/9', background: '#fff', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', borderRadius: '8px', display: 'flex', flexDirection: 'column', padding: '48px', position: 'relative' }}>
          <h1 style={{ fontSize: '48px', color: '#0f172a', margin: '0 0 24px 0' }}>{sample.title}</h1>
          <div style={{ width: '60px', height: '8px', background: '#4f46e5', margin: '0 0 24px 0' }}></div>
          <p style={{ fontSize: '20px', color: '#64748b' }}>Strategic presentation layout powered by MCP integration. AiSeed variation: {aiSeed}</p>
          <div style={{ position: 'absolute', bottom: 48, left: 48, fontSize: '14px', color: '#94a3b8' }}>DesignBuddy Keynote Engine</div>
        </div>
      </div>
    </div>`,
  
  Doc: `<div style={{ flex: 1, background: '#fff', overflowY: 'auto', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '720px', padding: '80px 40px' }}>
        <h1 style={{ fontSize: '40px', fontWeight: 800, marginBottom: '24px', color: '#0f172a' }}>{sample.title}</h1>
        <div style={{ color: '#64748b', marginBottom: '40px', display: 'flex', gap: '16px' }}><span>Last edited just now</span><span>Author: DesignBuddy Docs</span><span>Seed: {aiSeed}</span></div>
        <p style={{ fontSize: '18px', lineHeight: 1.8, color: '#334155', marginBottom: '24px' }}>This is an independent document layout. Instead of a generic bounding box, it uses a bespoke rich-text simulation directly rendering native DOM elements.</p>
        <div style={{ padding: '24px', background: '#f8fafc', borderLeft: '4px solid #4f46e5', fontSize: '16px', lineHeight: 1.6, color: '#475569', borderRadius: '0 8px 8px 0' }}>
          "Agent-driven documentation enables structural editing without manual formatting overhead."
        </div>
        <div style={{ marginTop: '40px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
           {[1,2,3].map(i => <div key={i} style={{ height: '16px', background: '#f1f5f9', borderRadius: '4px', width: i === 3 ? '60%' : '100%' }}></div>)}
        </div>
      </div>
    </div>`,

  Img: `<div style={{ flex: 1, background: '#fff', overflowY: 'auto', padding: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
         <h1 style={{ fontSize: '32px', color: '#111827', margin: 0 }}>{sample.title}</h1>
         <span style={{ padding: '8px 16px', background: '#f3f4f6', borderRadius: '20px', fontSize: '14px', fontWeight: 500 }}>Gallery Engine</span>
      </div>
      <div style={{ columnCount: 3, columnGap: '24px' }}>
         {[1,2,3,4,5,6,7,8,9].map(i => (
           <div key={i} style={{ width: '100%', height: \`\${200 + ((i * 47 + aiSeed * 13) % 200)}px\`, background: (i % 2 === 0) ? '#f8fafc' : '#f1f5f9', borderRadius: '12px', marginBottom: '24px', breakInside: 'avoid', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', fontWeight: 'bold' }}>Asset {i}</div>
         ))}
      </div>
    </div>`,

  Vid: `<div style={{ flex: 1, background: '#0a0a0a', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
        <div style={{ width: '100%', maxWidth: '1000px', aspectRatio: '21/9', background: '#000', borderRadius: '12px', position: 'relative', overflow: 'hidden', border: '1px solid #262626' }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <div style={{ width: 0, height: 0, borderTop: '16px solid transparent', borderBottom: '16px solid transparent', borderLeft: '24px solid #fff', marginLeft: '8px' }}></div>
            </div>
          </div>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '24px', background: 'linear-gradient(transparent, rgba(0,0,0,0.8))' }}>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.3)', borderRadius: 2, marginBottom: 16, cursor: 'pointer' }}><div style={{ width: \`\${(30 + aiSeed*5) % 100}%\`, height: '100%', background: '#ef4444', borderRadius: 2 }}></div></div>
            <h2 style={{ color: '#fff', margin: 0, fontSize: '20px' }}>{sample.title} <span style={{ fontSize: '14px', color: '#a3a3a3', fontWeight: 400, marginLeft: 16 }}>Cinematic Player</span></h2>
          </div>
        </div>
      </div>
    </div>`,

  Aud: `<div style={{ flex: 1, background: '#18181b', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
      <div style={{ width: '100%', maxWidth: '600px', background: '#27272a', borderRadius: '24px', padding: '40px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)', border: '1px solid #3f3f46' }}>
        <div style={{ display: 'flex', gap: '32px', alignItems: 'center', marginBottom: '32px' }}>
           <div style={{ width: 120, height: 120, borderRadius: 24, background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}></div>
           <div>
              <h2 style={{ color: '#fff', fontSize: '28px', margin: '0 0 8px 0' }}>{sample.title}</h2>
              <div style={{ color: '#a1a1aa', fontSize: '16px' }}>High-Fidelity Audio Engine</div>
           </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '60px', marginBottom: '32px' }}>
          {Array.from({length: 40}).map((_, i) => (
             <div key={i} style={{ flex: 1, background: i < (15 + aiSeed % 20) ? '#a855f7' : '#3f3f46', height: \`\${Math.max(10, ((i*17 + aiSeed*43) % 100))}%\`, borderRadius: 4, transition: 'height 0.2s ease, background 0.2s ease' }}></div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', alignItems: 'center' }}>
           <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#3f3f46', cursor: 'pointer' }}></div>
           <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 0, height: 0, borderTop: '10px solid transparent', borderBottom: '10px solid transparent', borderLeft: '16px solid #18181b', marginLeft: '6px' }}></div>
           </div>
           <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#3f3f46', cursor: 'pointer' }}></div>
        </div>
      </div>
    </div>`,

  Live: `<div style={{ flex: 1, background: '#0f172a', padding: '32px', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
         <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981' }}></div>
         <h1 style={{ color: '#fff', margin: 0, fontSize: '24px' }}>{sample.title} (LIVE)</h1>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '24px' }}>
         {[1,2,3].map(i => <div key={i} style={{ background: '#1e293b', border: '1px solid #334155', padding: '24px', borderRadius: '12px' }}><div style={{ color: '#94a3b8', fontSize: '14px' }}>Telemetry Node {i}</div><div style={{ color: '#fff', fontSize: '32px', marginTop: 8, fontWeight: 'bold' }}>{((i * 37 + aiSeed * 11) % 100)}%</div></div>)}
      </div>
      <div style={{ background: '#1e293b', border: '1px solid #334155', padding: '24px', borderRadius: '12px', height: '300px', display: 'flex', flexDirection: 'column' }}>
         <h3 style={{ color: '#e2e8f0', margin: '0 0 16px 0', fontSize: '14px' }}>Event Stream (WebSocket Sync)</h3>
         <div style={{ flex: 1, fontFamily: 'monospace', color: '#10b981', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div>[{new Date().toISOString()}] Connection established.</div>
            <div>[INFO] Receiving payload from Edge network... Seed: {aiSeed}</div>
            <div>[INFO] Data synchronized with backend layer.</div>
            <div style={{ color: '#eab308' }}>[WARN] Traffic spike detected on node alpha.</div>
         </div>
      </div>
    </div>`,

  Gl: `<div style={{ flex: 1, background: '#000', position: 'relative', overflow: 'hidden' }}>
       <div style={{ position: 'absolute', inset: -100, background: 'repeating-linear-gradient(0deg, transparent, transparent 49px, rgba(255,255,255,0.05) 50px), repeating-linear-gradient(90deg, transparent, transparent 49px, rgba(255,255,255,0.05) 50px)', transform: \`perspective(500px) rotateX(\${50 + (aiSeed%20)}deg) scale(2)\`, transformOrigin: 'bottom', transition: 'transform 0.5s ease' }}></div>
       <div style={{ position: 'absolute', top: 40, left: 40, background: 'rgba(20,20,20,0.8)', backdropFilter: 'blur(10px)', border: '1px solid #333', padding: '24px', borderRadius: '12px', color: '#fff', width: 280 }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>{sample.title}</h3>
          <div style={{ fontSize: '12px', color: '#a3a3a3', display: 'flex', flexDirection: 'column', gap: '12px' }}>
             <div><div style={{ marginBottom: 4 }}>Material Roughness</div><div style={{ height: 4, background: '#333', borderRadius: 2 }}><div style={{ width: \`\${(30 + aiSeed*15)%100}%\`, height: '100%', background: '#3b82f6' }}></div></div></div>
             <div><div style={{ marginBottom: 4 }}>Environment Lighting</div><div style={{ height: 4, background: '#333', borderRadius: 2 }}><div style={{ width: \`\${(60 + aiSeed*7)%100}%\`, height: '100%', background: '#3b82f6' }}></div></div></div>
          </div>
       </div>
       <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ width: 300, height: 300, background: 'radial-gradient(circle, rgba(59,130,246,0.5) 0%, transparent 70%)', opacity: 0.8, filter: 'blur(20px)' }}></div>
       </div>
    </div>`,

  Hf: `<div style={{ flex: 1, background: '#111827', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 64, borderBottom: '1px solid #374151', display: 'flex', alignItems: 'center', padding: '0 24px', color: '#fff', fontWeight: 600, justifyContent: 'space-between' }}>
         <div>{sample.title} - HyperFrame Sequence</div>
         <div style={{ fontSize: '13px', color: '#9ca3af', background: '#374151', padding: '6px 12px', borderRadius: '16px' }}>Nodes: 4 | FPS: 60</div>
      </div>
      <div style={{ flex: 1, padding: '40px', overflowX: 'auto', display: 'flex', alignItems: 'center', gap: '40px' }}>
         {[1,2,3,4].map((i, idx) => (
            <React.Fragment key={i}>
              <div style={{ width: 280, height: 450, background: '#1f2937', borderRadius: '24px', border: '2px solid #4b5563', padding: '16px', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                 <div style={{ height: 200, background: (idx === aiSeed % 4) ? '#3b82f6' : '#374151', borderRadius: '12px', marginBottom: 24, transition: 'background 0.3s ease' }}></div>
                 <div style={{ height: 16, background: '#4b5563', borderRadius: 4, width: '80%', marginBottom: 12 }}></div>
                 <div style={{ height: 16, background: '#4b5563', borderRadius: 4, width: '60%', marginBottom: 12 }}></div>
                 <div style={{ height: 16, background: '#4b5563', borderRadius: 4, width: '40%' }}></div>
              </div>
              {idx < 3 && <div style={{ color: '#6b7280', fontSize: '32px', flexShrink: 0 }}>→</div>}
            </React.Fragment>
         ))}
      </div>
    </div>`
};

const makeComponent = (compName, dom) => `import React, { useState } from 'react';
import { SampleTop, copySample, SampleId } from "../shared";
import { useAgentConnection } from '../../../utils/useAgentConnection';

export default function ${compName}({ draftId, sample }: { draftId?: string; sample: any }) {
  useAgentConnection();
  const [editMode, setEditMode] = useState(false);
  const [aiSeed, setAiSeed] = useState(0);

  const handleClone = () => {
    try { copySample(sample.id as SampleId, { aiSeed, editMode }); } catch {}
  };

  const handleRemix = () => {
    const nextSeed = aiSeed + 1;
    setAiSeed(nextSeed);
    fetch('http://' + window.location.hostname + ':4124/state', { 
      method: 'POST', 
      body: JSON.stringify({ action: 'remix', seed: nextSeed }) 
    }).catch(()=>{});
  };

  return (
    <main className="sample-view proto-view" style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f9fafb' }}>
      <SampleTop type="独立架构案例" title={sample.title} draftId={draftId} onCopy={handleClone}>
        <div className="proto-top-actions"></div>
      </SampleTop>
      
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: '24px', gap: '24px' }}>
        <div style={{ flex: 1, background: '#e2e8f0', borderRadius: '16px', display: 'flex', overflow: 'hidden', position: 'relative' }}>
            {editMode && (
              <div style={{ position: 'absolute', inset: 0, border: '4px dashed #4f46e5', zIndex: 100, pointerEvents: 'none', background: 'rgba(79, 70, 229, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ background: '#4f46e5', color: '#fff', padding: '8px 16px', borderRadius: '20px', fontWeight: 'bold' }}>MCP Select Mode Active</span>
              </div>
            )}
            ${dom}
        </div>

        <aside style={{ width: '320px', background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>MCP Handoff Panel</h3>
              <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#64748b' }}>Independent App Framework</p>
          </div>
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
              <button onClick={handleClone} style={{ padding: '12px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>使用此案例 (Clone)</button>
              <button onClick={handleRemix} style={{ padding: '12px', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>打乱重组内容 (AI Remix)</button>
              <button onClick={() => setEditMode(!editMode)} style={{ padding: '12px', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>{editMode ? "退出选取模式" : "进入 DOM 选取模式"}</button>
              <button onClick={() => alert("Export triggered to MCP OS Daemon!")} style={{ padding: '12px', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>导出资产 (Export)</button>
          </div>
        </aside>
      </div>
    </main>
  );
}`;

const configs = [
  { prefix: 'Slide', max: 8 },
  { prefix: 'Doc', max: 8 },
  { prefix: 'Img', max: 8 },
  { prefix: 'Hf', max: 5 },
  { prefix: 'Vid', max: 9 },
  { prefix: 'Aud', max: 9 },
  { prefix: 'Live', max: 5 },
  { prefix: 'Gl', max: 9 }
];

let generated = 0;
configs.forEach(conf => {
  for (let i = 1; i <= conf.max; i++) {
    const compName = `${conf.prefix}${i}Gen`;
    const dom = templates[conf.prefix];
    fs.writeFileSync(path.join(commDir, compName + '.tsx'), makeComponent(compName, dom), 'utf-8');
    generated++;
  }
});

console.log(`Successfully generated ${generated} multimodality and document framework components!`);
