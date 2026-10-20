import React, { useState } from 'react';
import { SampleTop, copySample, SampleId } from "../shared";
import { useAgentConnection } from '../../../utils/useAgentConnection';

export default function Proto30Gen({ draftId, sample }: { draftId?: string; sample: any }) {
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
              
<div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff' }}>
   <div style={{ height: '80px', display: 'flex', alignItems: 'center', padding: '0 40px', borderBottom: '1px solid #e5e7eb', justifyContent: 'space-between' }}>
      <div style={{ fontWeight: 'bold', fontSize: '20px', color: '#be123c' }}>StayHub</div>
      <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: '24px', padding: '8px', border: '1px solid #e5e7eb', gap: '1px' }}>
         <div style={{ padding: '8px 16px', background: '#fff', borderRadius: '16px', fontWeight: 500, fontSize: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>Anywhere</div>
         <div style={{ padding: '8px 16px', fontSize: '14px', color: '#6b7280' }}>Any week</div>
         <div style={{ padding: '8px 16px', fontSize: '14px', color: '#6b7280' }}>Add guests</div>
         <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#be123c', marginLeft: '8px' }}></div>
      </div>
      <div style={{ width: 40, height: 40, borderRadius: '50%', border: '1px solid #e5e7eb' }}></div>
   </div>
   <div style={{ padding: '24px 40px', display: 'flex', gap: '24px', borderBottom: '1px solid #e5e7eb', overflowX: 'auto' }}>
      {['Beachfront', 'Cabins', 'Trending', 'Tiny homes', 'Lakefront', 'Castles', 'Design'].map(t => (
         <div key={t} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', opacity: t === 'Beachfront' ? 1 : 0.6 }}>
            <div style={{ width: 24, height: 24, background: '#cbd5e1', borderRadius: '4px' }}></div>
            <span style={{ fontSize: '12px', fontWeight: t === 'Beachfront' ? 600 : 400 }}>{t}</span>
         </div>
      ))}
   </div>
   <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <div style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px' }}>
         {[1,2,3,4,5,6].map(i => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
               <div style={{ width: '100%', aspectRatio: '1', borderRadius: '16px', background: (i % 2 === 0) ? '#e2e8f0' : '#f1f5f9', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: 16, right: 16, width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.5)' }}></div>
               </div>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                     <div style={{ fontWeight: 'bold', color: '#111827' }}>Location {i + aiSeed}</div>
                     <div style={{ color: '#6b7280', fontSize: '14px' }}>2,300 kilometers away</div>
                     <div style={{ color: '#6b7280', fontSize: '14px' }}>Oct 15 - 20</div>
                     <div style={{ marginTop: '8px', color: '#111827' }}><span style={{ fontWeight: 'bold' }}>$ {150 + i * 20}</span> night</div>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                     ★ 4.{8 + (i % 3)}
                  </div>
               </div>
            </div>
         ))}
      </div>
      <div style={{ width: '30%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
         <span style={{ background: '#fff', padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>Map View</span>
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