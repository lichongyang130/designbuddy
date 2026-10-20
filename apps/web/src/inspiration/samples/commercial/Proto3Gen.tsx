import React, { useState } from 'react';
import { SampleTop, copySample, SampleId } from "../shared";
import { useAgentConnection } from '../../../utils/useAgentConnection';

export default function Proto3Gen({ draftId, sample }: { draftId?: string; sample: any }) {
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
              
<div style={{ width: '260px', background: '#0f172a', color: '#cbd5e1', display: 'flex', flexDirection: 'column' }}>
   <div style={{ padding: '24px', fontSize: '20px', fontWeight: 'bold', color: '#fff', display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{ width: 32, height: 32, background: '#4f46e5', borderRadius: 8 }}></div>
      Admin Portal
   </div>
   <div style={{ flex: 1, padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {['Dashboard', 'Analytics', 'Users', 'Settings'].map((item, i) => (
         <div key={item} style={{ padding: '12px 16px', borderRadius: '8px', background: i === (aiSeed % 4) ? '#1e293b' : 'transparent', color: i === (aiSeed % 4) ? '#fff' : '#cbd5e1', cursor: 'pointer' }}>
           {item}
         </div>
      ))}
   </div>
</div>
<div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
   <div style={{ height: '72px', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px' }}>
      <div style={{ fontWeight: 'bold', color: '#0f172a' }}>Welcome back, Admin</div>
   </div>
   <div style={{ padding: '32px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
      {[1,2,3].map(i => (
         <div key={i} style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '14px', color: '#64748b' }}>Metric {i}</div>
            <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{Math.floor(Math.random()*1000) + aiSeed * 10}</div>
         </div>
      ))}
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