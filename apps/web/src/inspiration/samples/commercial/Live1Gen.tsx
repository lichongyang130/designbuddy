import React, { useState } from 'react';
import { SampleTop, copySample, SampleId } from "../shared";
import { useAgentConnection } from '../../../utils/useAgentConnection';

export default function Live1Gen({ draftId, sample }: { draftId?: string; sample: any }) {
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
            <div style={{ flex: 1, background: '#0f172a', padding: '32px', overflowY: 'auto' }}>
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