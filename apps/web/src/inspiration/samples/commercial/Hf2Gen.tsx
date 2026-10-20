import React, { useState } from 'react';
import { SampleTop, copySample, SampleId } from "../shared";
import { useAgentConnection } from '../../../utils/useAgentConnection';

export default function Hf2Gen({ draftId, sample }: { draftId?: string; sample: any }) {
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
            <div style={{ flex: 1, background: '#111827', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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