import React, { useState } from 'react';
import { SampleTop, copySample, SampleId } from "../shared";
import { useAgentConnection } from '../../../utils/useAgentConnection';

export default function Proto13Gen({ draftId, sample }: { draftId?: string; sample: any }) {
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
              
<div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0a0a0a', color: '#fff' }}>
   <div style={{ height: '64px', borderBottom: '1px solid #262626', display: 'flex', alignItems: 'center', padding: '0 32px', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
         <div style={{ width: 24, height: 24, background: '#10b981', borderRadius: '4px' }}></div>
         <span style={{ fontWeight: 'bold', fontSize: '18px' }}>FinDash</span>
      </div>
      <div style={{ display: 'flex', gap: '24px', color: '#a3a3a3' }}>
         <span>Portfolio</span><span>Markets</span><span>Trade</span>
      </div>
   </div>
   <div style={{ flex: 1, display: 'flex', padding: '32px', gap: '32px', overflowY: 'auto' }}>
      <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '32px' }}>
         <div style={{ background: '#171717', borderRadius: '16px', padding: '32px', border: '1px solid #262626' }}>
            <div style={{ color: '#a3a3a3', fontSize: '14px', marginBottom: '8px' }}>Total Balance</div>
            <div style={{ fontSize: '48px', fontWeight: 'bold', letterSpacing: '-1px' }}>$ {(124500 + aiSeed*125).toLocaleString()}</div>
            <div style={{ display: 'flex', height: '120px', alignItems: 'flex-end', gap: '8px', marginTop: '32px' }}>
               {[1,2,3,4,5,6,7,8,9,10].map(i => (
                  <div key={i} style={{ flex: 1, background: (i % 3 === 0) ? '#ef4444' : '#10b981', height: `${20 + (i * aiSeed * 7) % 80}%`, borderRadius: '4px 4px 0 0' }}></div>
               ))}
            </div>
         </div>
         <div style={{ background: '#171717', borderRadius: '16px', padding: '32px', border: '1px solid #262626', flex: 1 }}>
            <h3 style={{ margin: '0 0 24px 0' }}>Recent Transactions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
               {[1,2,3,4].map(i => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid #262626' }}>
                     <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <div style={{ width: 40, height: 40, background: '#262626', borderRadius: '50%' }}></div>
                        <div>
                           <div style={{ fontWeight: 500 }}>Transfer to Account {i}</div>
                           <div style={{ color: '#a3a3a3', fontSize: '12px' }}>Today, 10:{i}4 AM</div>
                        </div>
                     </div>
                     <div style={{ fontWeight: 'bold' }}>- $ {(i * 50 + aiSeed * 10)}</div>
                  </div>
               ))}
            </div>
         </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '32px' }}>
         <div style={{ background: '#171717', borderRadius: '16px', padding: '24px', border: '1px solid #262626' }}>
            <h3 style={{ margin: '0 0 16px 0' }}>Quick Trade</h3>
            <input type="text" placeholder="Amount (USD)" style={{ width: '100%', padding: '12px', background: '#0a0a0a', border: '1px solid #262626', color: '#fff', borderRadius: '8px', marginBottom: '16px' }} />
            <button style={{ width: '100%', padding: '12px', background: '#10b981', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '8px' }}>Buy Asset</button>
         </div>
         <div style={{ background: '#171717', borderRadius: '16px', padding: '24px', border: '1px solid #262626', flex: 1 }}>
            <h3 style={{ margin: '0 0 16px 0' }}>Watchlist</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
               {['BTC', 'ETH', 'SOL', 'DOT'].map((coin, i) => (
                  <div key={coin} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#0a0a0a', borderRadius: '8px' }}>
                     <span style={{ fontWeight: 'bold' }}>{coin}</span>
                     <span style={{ color: '#10b981' }}>+{(i + aiSeed*1.2).toFixed(2)}%</span>
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