import React, { useState } from 'react';
import { SampleTop, copySample, SampleId } from "../shared";
import { useAgentConnection } from '../../../utils/useAgentConnection';

export default function Aud5Gen({ draftId, sample }: { draftId?: string; sample: any }) {
  useAgentConnection();
  const [editMode, setEditMode] = useState(false);
  const [aiSeed, setAiSeed] = useState(0);

  const handleClone = () => {
    try { copySample(sample.id as SampleId, { aiSeed, editMode }); } catch {}
  };

  
  const handleExport = () => {
    fetch('http://' + window.location.hostname + ':4124/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: 'figma-bridge', args: { fileUrl: 'https://figma.com/file/mock' } })
    }).then(r => r.json()).then(res => {
      if (res.status === 'ok') {
        alert("Figma 同步成功，抽取了 Design Tokens：\n" + res.output);
      } else {
        alert("Figma 同步失败：" + res.error);
      }
    }).catch(e => alert("网络错误：" + e.message));
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
            <div style={{ flex: 1, background: '#18181b', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
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
             <div key={i} style={{ flex: 1, background: i < (15 + aiSeed % 20) ? '#a855f7' : '#3f3f46', height: `${Math.max(10, ((i*17 + aiSeed*43) % 100))}%`, borderRadius: 4, transition: 'height 0.2s ease, background 0.2s ease' }}></div>
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
    </div>
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
              <button onClick={handleExport} style={{ padding: '12px', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>双向同步 Figma (Figma Bridge)</button>
          </div>
        </aside>
      </div>
    </main>
  );
}