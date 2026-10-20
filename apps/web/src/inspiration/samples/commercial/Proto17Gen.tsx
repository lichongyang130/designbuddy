import React, { useState } from 'react';
import { SampleTop, copySample, SampleId } from "../shared";
import { useAgentConnection } from '../../../utils/useAgentConnection';

export default function Proto17Gen({ draftId, sample }: { draftId?: string; sample: any }) {
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
      <SampleTop type="商业级真实 DOM 组件" title={sample.title} draftId={draftId} onCopy={handleClone}>
        <div className="proto-top-actions"></div>
      </SampleTop>
      
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: '24px', gap: '24px' }}>
        <div style={{ flex: 1, background: '#e2e8f0', borderRadius: '16px', padding: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', position: 'relative' }}>
           <div style={{ width: '100%', height: '100%', background: '#fff', borderRadius: '8px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', display: 'flex', overflow: 'hidden', position: 'relative' }}>
              {editMode && (
                <div style={{ position: 'absolute', inset: 0, border: '4px dashed #4f46e5', zIndex: 100, pointerEvents: 'none', background: 'rgba(79, 70, 229, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ background: '#4f46e5', color: '#fff', padding: '8px 16px', borderRadius: '20px', fontWeight: 'bold' }}>MCP Node Element Target Mode Active</span>
                </div>
              )}
              
<div style={{ flex: 1, display: 'flex', background: '#fff' }}>
   <div style={{ width: '260px', background: '#f9fafb', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '24px', fontWeight: 'bold', fontSize: '18px', borderBottom: '1px solid #e5e7eb' }}>GenAI Studio</div>
      <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
         <button style={{ width: '100%', padding: '12px', background: '#111827', color: '#fff', borderRadius: '8px', border: 'none', marginBottom: '24px' }}>+ New Chat</button>
         <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '12px', fontWeight: 'bold' }}>Recent</div>
         {[1,2,3,4,5].map(i => (
            <div key={i} style={{ padding: '10px 12px', fontSize: '14px', color: '#374151', borderRadius: '6px', cursor: 'pointer', background: i === 1 ? '#e5e7eb' : 'transparent' }}>Chat Session {i + aiSeed}</div>
         ))}
      </div>
   </div>
   <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: '64px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', padding: '0 24px', justifyContent: 'space-between' }}>
         <div style={{ fontWeight: 500 }}>Model: GPT-4 Optimized</div>
         <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }}></div>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>System Ready</div>
         </div>
      </div>
      <div style={{ flex: 1, padding: '32px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
         <div style={{ display: 'flex', gap: '16px', alignSelf: 'flex-end', maxWidth: '70%' }}>
            <div style={{ background: '#f3f4f6', padding: '16px', borderRadius: '16px 16px 0 16px', color: '#111827' }}>Hello, please generate a report for me based on the latest metrics.</div>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#d1d5db', flexShrink: 0 }}></div>
         </div>
         <div style={{ display: 'flex', gap: '16px', maxWidth: '80%' }}>
            <div style={{ width: 36, height: 36, borderRadius: '8px', background: '#6366f1', flexShrink: 0 }}></div>
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: '24px', borderRadius: '16px 16px 16px 0', color: '#374151', lineHeight: '1.6' }}>
               <p style={{ margin: '0 0 16px 0' }}>Here is the generated report based on seed data {aiSeed}:</p>
               <div style={{ width: '100%', height: '120px', background: '#f9fafb', borderRadius: '8px', border: '1px dashed #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>[Data Table / Chart Visualization]</div>
            </div>
         </div>
      </div>
      <div style={{ padding: '24px' }}>
         <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input type="text" placeholder="Type a message..." style={{ width: '100%', padding: '16px 48px 16px 24px', borderRadius: '24px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', outline: 'none' }} />
            <button style={{ position: 'absolute', right: '8px', width: '32px', height: '32px', borderRadius: '50%', background: '#111827', border: 'none' }}></button>
         </div>
      </div>
   </div>
</div>
           </div>
        </div>

        {/* Right: Inspector */}
        <aside style={{ width: '320px', background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
           <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>MCP Handoff Panel</h3>
              <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#64748b' }}>1 Case = 1 App Component</p>
           </div>
           <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
              <button onClick={handleClone} style={{ padding: '12px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>使用此案例 (Clone)</button>
              <button onClick={handleRemix} style={{ padding: '12px', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>生成相似原型 (AI Remix)</button>
              <button onClick={() => setEditMode(!editMode)} style={{ padding: '12px', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>{editMode ? "退出设计模式" : "进入设计模式 (Edit)"}</button>
              <button onClick={handleExport} style={{ padding: '12px', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>双向同步 Figma (Figma Bridge)</button>
           </div>
        </aside>
      </div>
    </main>
  );
}