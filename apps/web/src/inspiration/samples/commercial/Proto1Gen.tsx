import React, { useState } from 'react';
import { SampleTop, copySample, SampleId } from "../shared";
import { useAgentConnection } from '../../../utils/useAgentConnection';

export default function Proto1Gen({ draftId, sample }: { draftId?: string; sample: any }) {
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

  const handleExport = () => {
    fetch('http://' + window.location.hostname + ':4124/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: 'pdf-export', args: { outputFilename: 'NexusAdmin-Dashboard.pdf' } })
    }).then(r => r.json()).then(res => {
      if (res.status === 'ok') {
        alert("PDF 导出成功：\\n" + res.output);
      } else {
        alert("导出失败：" + res.error);
      }
    }).catch(e => alert("网络错误：" + e.message));
  };

  return (
    <main className="sample-view proto-view" style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f9fafb' }}>
      <SampleTop type="商业级真实 DOM 组件" title={sample.title} draftId={draftId} onCopy={handleClone}>
        <div className="proto-top-actions"></div>
      </SampleTop>
      
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: '24px', gap: '24px' }}>
        {/* Left: Component DOM Wrapper */}
        <div style={{ flex: 1, background: '#e2e8f0', borderRadius: '16px', padding: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', position: 'relative' }}>
           <div style={{ width: '100%', height: '100%', background: '#fff', borderRadius: '8px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', display: 'flex', overflow: 'hidden', position: 'relative' }}>
              
              {editMode && (
                <div style={{ position: 'absolute', inset: 0, border: '4px dashed #4f46e5', zIndex: 100, pointerEvents: 'none', background: 'rgba(79, 70, 229, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ background: '#4f46e5', color: '#fff', padding: '8px 16px', borderRadius: '20px', fontWeight: 'bold' }}>MCP Node Element Target Mode Active</span>
                </div>
              )}

              {/* Real Sidebar (Not fake CSS) */}
              <div style={{ width: '260px', background: '#0f172a', color: '#cbd5e1', display: 'flex', flexDirection: 'column' }}>
                 <div style={{ padding: '24px', fontSize: '20px', fontWeight: 'bold', color: '#fff', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: 32, height: 32, background: '#4f46e5', borderRadius: 8 }}></div>
                    Nexus Admin
                 </div>
                 <div style={{ flex: 1, padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {['Dashboard', 'Analytics', 'Users', 'Transactions', 'Settings'].map((item, i) => (
                       <div key={item} style={{ padding: '12px 16px', borderRadius: '8px', background: i === (aiSeed % 5) ? '#1e293b' : 'transparent', color: i === (aiSeed % 5) ? '#fff' : '#cbd5e1', cursor: 'pointer', fontWeight: 500 }}>
                         {item}
                       </div>
                    ))}
                 </div>
              </div>

              {/* Main App Content */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
                 {/* Topbar */}
                 <div style={{ height: '72px', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px' }}>
                    <div style={{ width: '300px', height: '36px', background: '#f1f5f9', borderRadius: '18px', display: 'flex', alignItems: 'center', padding: '0 16px', color: '#94a3b8' }}>Search platform...</div>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                       <div style={{ width: 36, height: 36, background: '#f1f5f9', borderRadius: '50%' }}></div>
                       <div style={{ width: 40, height: 40, background: '#cbd5e1', borderRadius: '50%' }}></div>
                    </div>
                 </div>

                 {/* Dashboard Body */}
                 <div style={{ flex: 1, padding: '32px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>Overview</h2>
                    
                    {/* KPI Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
                       {[
                         { label: 'Total Revenue', value: '$' + (45231 + aiSeed * 1000).toLocaleString(), change: '+20.1%' },
                         { label: 'Active Users', value: (2350 + aiSeed * 50).toLocaleString(), change: '+15.2%' },
                         { label: 'New Signups', value: (124 + aiSeed * 5).toLocaleString(), change: '-4.1%' },
                         { label: 'Conversion', value: '4.2%', change: '+1.2%' }
                       ].map((kpi, i) => (
                          <div key={i} style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                             <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>{kpi.label}</div>
                             <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#0f172a', marginBottom: '8px' }}>{kpi.value}</div>
                             <div style={{ fontSize: '14px', color: kpi.change.startsWith('+') ? '#10b981' : '#ef4444', fontWeight: 500 }}>{kpi.change} from last month</div>
                          </div>
                       ))}
                    </div>

                    {/* Chart & Table Area */}
                    <div style={{ display: 'flex', gap: '24px', height: '400px' }}>
                       <div style={{ flex: 2, background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', display: 'flex', flexDirection: 'column' }}>
                          <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', marginBottom: '24px', marginTop: 0 }}>Revenue Analytics</h3>
                          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: '16px', borderBottom: '1px solid #e2e8f0' }}>
                             {[40, 70, 45, 90, 60, 85, 55, 75, 50, 100].map((h, i) => (
                                <div key={i} style={{ flex: 1, height: `${(h + (aiSeed * 7)) % 100}%`, background: i === 7 ? '#4f46e5' : '#e0e7ff', borderRadius: '4px 4px 0 0', transition: 'height 0.3s ease' }}></div>
                             ))}
                          </div>
                       </div>
                       <div style={{ flex: 1, background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                          <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', marginBottom: '16px', marginTop: 0 }}>Recent Signups</h3>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                             {[1,2,3,4,5].map(i => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                   <div style={{ width: 40, height: 40, background: '#f1f5f9', borderRadius: '50%' }}></div>
                                   <div style={{ flex: 1 }}>
                                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a' }}>User {(i + aiSeed*2)}</div>
                                      <div style={{ fontSize: '12px', color: '#64748b' }}>user{i}@example.com</div>
                                   </div>
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
        <aside style={{ width: '320px', background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
           <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>MCP Handoff Panel</h3>
              <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#64748b' }}>1 Case = 1 App Component</p>
           </div>
           <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
              <button onClick={handleClone} style={{ padding: '12px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>使用此案例 (Clone)</button>
              <button onClick={handleRemix} style={{ padding: '12px', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>生成相似原型 (AI Remix)</button>
              <button onClick={() => setEditMode(!editMode)} style={{ padding: '12px', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>{editMode ? "退出设计模式" : "进入设计模式 (Edit)"}</button>
              <button onClick={handleExport} style={{ padding: '12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>导出为高保真 PDF (Export)</button>
           </div>
        </aside>
      </div>
    </main>
  );
}
