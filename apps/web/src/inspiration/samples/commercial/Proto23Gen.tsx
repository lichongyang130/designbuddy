import React, { useState } from 'react';
import { SampleTop, copySample, SampleId } from "../shared";
import { useAgentConnection } from '../../../utils/useAgentConnection';

export default function Proto23Gen({ draftId, sample }: { draftId?: string; sample: any }) {
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
              
<div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f0fdfa' }}>
   <div style={{ height: '72px', background: '#fff', borderBottom: '1px solid #ccfbf1', display: 'flex', alignItems: 'center', padding: '0 40px', justifyContent: 'space-between' }}>
      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f766e' }}>EduLearn</div>
      <div style={{ display: 'flex', gap: '24px', fontWeight: 500, color: '#374151' }}>
         <span>Courses</span><span>My Learning</span><span>Community</span>
      </div>
      <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#ccfbf1' }}></div>
   </div>
   <div style={{ flex: 1, display: 'flex', padding: '32px', gap: '32px', overflowY: 'auto' }}>
      <div style={{ flex: 3, display: 'flex', flexDirection: 'column', gap: '24px' }}>
         <div style={{ width: '100%', aspectRatio: '16/9', background: '#1e293b', borderRadius: '16px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 0, height: 0, borderTop: '12px solid transparent', borderBottom: '12px solid transparent', borderLeft: '20px solid #fff', marginLeft: '6px' }}></div>
               </div>
            </div>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '4px', background: 'rgba(255,255,255,0.3)' }}>
               <div style={{ width: `${(aiSeed * 10) % 100}%`, height: '100%', background: '#0ea5e9' }}></div>
            </div>
         </div>
         <div>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 12px 0' }}>Advanced React & Architecture (Module {aiSeed})</h2>
            <div style={{ color: '#475569', lineHeight: '1.6' }}>Instructor: Dr. Sarah Connor | 1.2k Students Enrolled</div>
         </div>
         <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid #cbd5e1', paddingBottom: '16px' }}>
            <span style={{ fontWeight: 'bold', color: '#0f766e', borderBottom: '2px solid #0f766e', paddingBottom: '16px', marginBottom: '-17px' }}>Overview</span>
            <span style={{ color: '#64748b' }}>Resources</span>
            <span style={{ color: '#64748b' }}>Q&A (23)</span>
         </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
         <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #ccfbf1' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>Course Content</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
               {[1,2,3,4,5,6].map(i => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px', borderRadius: '8px', background: i === 2 ? '#f0fdfa' : 'transparent' }}>
                     <div style={{ width: 24, height: 24, borderRadius: '50%', border: i <= 2 ? 'none' : '1px solid #cbd5e1', background: i < 2 ? '#10b981' : (i === 2 ? '#0f766e' : 'transparent'), color: '#fff', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i < 2 ? '✓' : ''}</div>
                     <span style={{ color: i === 2 ? '#0f766e' : '#333', fontWeight: i === 2 ? 600 : 400 }}>Lesson {i}</span>
                  </div>
               ))}
            </div>
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