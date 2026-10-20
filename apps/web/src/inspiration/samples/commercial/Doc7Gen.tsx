import React, { useState } from 'react';
import { SampleTop, copySample, SampleId } from "../shared";
import { useAgentConnection } from '../../../utils/useAgentConnection';

export default function Doc7Gen({ draftId, sample }: { draftId?: string; sample: any }) {
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
            <div style={{ flex: 1, background: '#fff', overflowY: 'auto', display: 'flex', justifyContent: 'center' }}>
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