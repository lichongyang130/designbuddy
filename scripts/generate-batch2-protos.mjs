import fs from 'fs';
import path from 'path';

const commDir = 'apps/web/src/inspiration/samples/commercial';

function getDomainType(i) {
  if (i <= 5) return 'SaaS';
  if (i <= 10) return 'Ecom';
  if (i <= 15) return 'Finance';
  if (i <= 20) return 'AI';
  if (i <= 25) return 'Edu';
  return 'Booking';
}

const renderSaaS = () => `
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
</div>`;

const renderEcom = () => `
<div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff' }}>
   <div style={{ height: '80px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 40px' }}>
      <div style={{ fontSize: '24px', fontWeight: 'bold', letterSpacing: '-1px' }}>STOREFRONT</div>
      <div style={{ display: 'flex', gap: '24px', fontWeight: 500, color: '#374151' }}>
         <span>Men</span><span>Women</span><span>Accessories</span><span>Sale</span>
      </div>
      <div style={{ display: 'flex', gap: '16px' }}>
         <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#e5e7eb' }}></div>
         <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#e5e7eb' }}></div>
      </div>
   </div>
   <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <div style={{ width: '240px', borderRight: '1px solid #e5e7eb', padding: '32px', overflowY: 'auto' }}>
         <h3 style={{ fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '16px' }}>Categories</h3>
         <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', color: '#4b5563', fontSize: '14px' }}>
            {['All Products', 'New Arrivals', 'Best Sellers', 'Discounted'].map(cat => <div key={cat}>{cat}</div>)}
         </div>
         <h3 style={{ fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', margin: '32px 0 16px 0' }}>Price</h3>
         <input type="range" style={{ width: '100%' }} />
      </div>
      <div style={{ flex: 1, padding: '32px', overflowY: 'auto', background: '#f9fafb' }}>
         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px' }}>
            {[1,2,3,4,5,6].map(i => (
               <div key={i} style={{ background: '#fff', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                  <div style={{ height: '200px', background: (i + aiSeed) % 2 === 0 ? '#f3f4f6' : '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>Image</div>
                  <div style={{ padding: '16px' }}>
                     <div style={{ fontWeight: 'bold', color: '#111827' }}>Product Item {i + aiSeed}</div>
                     <div style={{ color: '#6b7280', fontSize: '14px', marginTop: '4px' }}>$ {(99 + i * 10).toFixed(2)}</div>
                     <button style={{ width: '100%', padding: '8px', marginTop: '16px', background: '#111827', color: '#fff', borderRadius: '6px', border: 'none' }}>Add to Cart</button>
                  </div>
               </div>
            ))}
         </div>
      </div>
   </div>
</div>`;

const renderFinance = () => `
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
                  <div key={i} style={{ flex: 1, background: (i % 3 === 0) ? '#ef4444' : '#10b981', height: \`\${20 + (i * aiSeed * 7) % 80}%\`, borderRadius: '4px 4px 0 0' }}></div>
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
</div>`;

const renderAI = () => `
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
</div>`;

const renderEdu = () => `
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
               <div style={{ width: \`\${(aiSeed * 10) % 100}%\`, height: '100%', background: '#0ea5e9' }}></div>
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
</div>`;

const renderBooking = () => `
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
</div>`;

const domainRenderMap = {
  SaaS: renderSaaS(),
  Ecom: renderEcom(),
  Finance: renderFinance(),
  AI: renderAI(),
  Edu: renderEdu(),
  Booking: renderBooking(),
};

const wrapper = (compName, contentDom) => `import React, { useState } from 'react';
import { SampleTop, copySample, SampleId } from "../shared";
import { useAgentConnection } from '../../../utils/useAgentConnection';

export default function ${compName}({ draftId, sample }: { draftId?: string; sample: any }) {
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
              ${contentDom}
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
              <button onClick={() => alert("OS MCP Daemon received Export Command!")} style={{ padding: '12px', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>导出到代码 / Figma (Export)</button>
           </div>
        </aside>
      </div>
    </main>
  );
}`;

for (let i = 2; i <= 30; i++) {
  const compName = `Proto${i}Gen`;
  const domain = getDomainType(i);
  const dom = domainRenderMap[domain];
  fs.writeFileSync(path.join(commDir, compName + '.tsx'), wrapper(compName, dom), 'utf-8');
}

console.log("Successfully generated all 29 remaining Prototypes across 6 domains!");
