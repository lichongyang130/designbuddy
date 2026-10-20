import { useState, useMemo } from "react";
import { FakeUIRenderer } from './FakeUIRenderer';
import { useAgentConnection } from '../../utils/useAgentConnection';
import { SampleTop, Notice, copySample, download, useSampleState, type SampleId, type Photo } from "./shared";

// Mock design token generator based on seed and page
const generateColors = (seed: number, page: number) => {
  const h = (seed * 137 + page * 43) % 360;
  const s = 60 + (page % 20);
  const l = 45 + (page % 10);
  return [
    `hsl(${h}, ${s}%, ${l}%)`,
    `hsl(${(h + 30) % 360}, ${s}%, ${l - 10}%)`,
    `hsl(${(h + 180) % 360}, ${s - 10}%, 90%)`,
    '#111827',
    '#FFFFFF'
  ];
};

export function GenericPrototype({ draftId, sample }: { draftId?: string; sample: any }) {
  const [s, set, error] = useSampleState(sample.id as SampleId, draftId, {
    page: 0,
    zoom: 100,
    device: 'desktop',
    aiSeed: 0,
    editMode: false
  });

  const [notice, msg] = useState("");
  const [inspecting, setInspecting] = useState(true);

  useAgentConnection();
  const seed = (parseInt(sample.id.split('-')[1]) || 1) + (s.aiSeed || 0);
  const active = Math.max(0, Math.min(sample.photos.length - 1, s.page));
  const currentPhoto = sample.photos[active];
  
  const colors = useMemo(() => generateColors(seed, active), [seed, active]);
  const components = useMemo(() => {
    const list = ["Top Navigation", "Hero Banner", "Data Table", "Sidebar Menu", "Action Modal", "Footer", "Metric Cards", "User Profile"];
    const start = (seed + active) % 4;
    return list.slice(start, start + 4);
  }, [seed, active]);

  const jump = (i: number) => set(prev => ({ ...prev, page: i }));
  const changeZoom = (val: number) => set(prev => ({ ...prev, zoom: Math.max(25, Math.min(200, val)) }));

  const copyProto = () => {
    try { copySample(sample.id as SampleId, s); } 
    catch { msg("保存失败，请检查存储。"); }
  };

  return (
    <main className="sample-view proto-view">
      <SampleTop
        type={`高保真原型 · ${sample.photos.length} 屏`}
        title={sample.title}
        draftId={draftId}
        onCopy={copyProto}
      >
        <div className="proto-top-actions">
          <button className={s.device === 'desktop' ? 'active' : ''} onClick={() => set(p => ({...p, device: 'desktop'}))}>Desktop</button>
          <button className={s.device === 'mobile' ? 'active' : ''} onClick={() => set(p => ({...p, device: 'mobile'}))}>Mobile</button>
          <div className="divider"></div>
          <button className={inspecting ? 'active primary' : 'primary'} onClick={() => setInspecting(!inspecting)}>
            {inspecting ? '关闭审查' : '审查 (Inspect)'}
          </button>
        </div>
      </SampleTop>
      <Notice text={error || notice} />

      <div className="proto-workspace">
        {/* Left: Artboards Tree */}
        <aside className="proto-sidebar-left">
          <div className="proto-panel-header">
            <h3>画板 (Artboards)</h3>
            <span className="count">{sample.photos.length}</span>
          </div>
          <nav className="proto-layers">
            {sample.photos.map((p: Photo, i: number) => (
              <button 
                key={i} 
                className={`layer-item ${active === i ? 'active' : ''}`}
                onClick={() => jump(i)}
              >
                <div className="layer-icon">#</div>
                <div className="layer-name">{p.label.split(' - ')[0]} ${String(i + 1).padStart(2, '0')}</div>
              </button>
            ))}
          </nav>
        </aside>

        {/* Center: Interactive Canvas */}
        <section className="proto-canvas-area">
          <div className="canvas-wrapper">
            <div className="canvas-scaler" style={{ transform: `scale(${s.zoom / 100})` }}>
              
              {s.device === 'desktop' ? (
                <div className="mockup-mac">
                  <div className="mac-header">
                    <div className="mac-dots">
                      <span style={{background: '#ff5f56'}}></span>
                      <span style={{background: '#ffbd2e'}}></span>
                      <span style={{background: '#27c93f'}}></span>
                    </div>
                    <div className="mac-url">demo.designbuddy.app/proto</div>
                  </div>
                  <div className="mac-body">
                    {s.editMode && <div style={{ position: 'absolute', inset: 0, border: '4px dashed #4f46e5', zIndex: 100, pointerEvents: 'none', background: 'rgba(79, 70, 229, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ background: '#4f46e5', color: '#fff', padding: '8px 16px', borderRadius: '20px', fontWeight: 'bold' }}>MCP Node Element Target Mode</span></div>}
                    <FakeUIRenderer seed={seed} page={active} device="desktop" colors={colors} />
                  </div>
                </div>
              ) : (
                <div className="mockup-iphone">
                  <div className="iphone-notch"></div>
                  <div className="iphone-body">
                    <FakeUIRenderer seed={seed} page={active} device="mobile" colors={colors} />
                  </div>
                  <div className="iphone-home"></div>
                </div>
              )}

            </div>
          </div>
          
          {/* Zoom Controls */}
          <div className="proto-zoom-ctrl">
            <button onClick={() => changeZoom(s.zoom - 10)}>-</button>
            <span onClick={() => changeZoom(100)}>{s.zoom}%</span>
            <button onClick={() => changeZoom(s.zoom + 10)}>+</button>
          </div>
        </section>

        {/* Right: Inspect / Handoff Panel */}
        {inspecting && (
          <aside className="proto-sidebar-right">
            <div className="proto-panel-header">
              <h3>交付规范 (Inspect)</h3>
            </div>
            <div className="inspect-content">
              
              <div className="inspect-block">
                <h4>属性 Properties</h4>
                <div className="prop-grid">
                  <div className="prop-item"><span>W</span> {s.device === 'desktop' ? '1200' : '390'}px</div>
                  <div className="prop-item"><span>H</span> {s.device === 'desktop' ? '800' : '844'}px</div>
                  <div className="prop-item"><span>X</span> 0</div>
                  <div className="prop-item"><span>Y</span> 0</div>
                </div>
              </div>

              <div className="inspect-block">
                <h4>颜色 Tokens (Colors)</h4>
                <div className="color-list">
                  {colors.map((c, idx) => (
                    <div className="color-item" key={idx}>
                      <div className="color-patch" style={{ background: c, border: c === '#FFFFFF' ? '1px solid #e5e7eb' : 'none' }}></div>
                      <span className="color-hex">{c.startsWith('hsl') ? c : c.toUpperCase()}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="inspect-block">
                <h4>排版 Typography</h4>
                <div className="typo-item">
                  <div className="typo-family">Inter / SemiBold</div>
                  <div className="typo-css">24px · 140% Line Height</div>
                </div>
                <div className="typo-item">
                  <div className="typo-family">Inter / Regular</div>
                  <div className="typo-css">15px · 160% Line Height</div>
                </div>
              </div>

              <div className="inspect-block">
                <h4>页面组件 Components</h4>
                <div className="comp-tags">
                  {components.map((c, idx) => (
                    <span key={idx} className="comp-tag">❖ {c}</span>
                  ))}
                </div>
              </div>

                            <div className="inspect-export">
                <button style={{ background: '#4f46e5', color: '#fff', borderColor: '#4f46e5' }} onClick={copyProto}>使用此案例 (Clone)</button>
                <button onClick={() => {
                  set(p => ({ ...p, aiSeed: (p.aiSeed || 0) + 1 }));
                  fetch('http://' + window.location.hostname + ':4124/state', { method: 'POST', body: JSON.stringify({ action: 'remix', seed: s.aiSeed }) }).catch(()=>{});
                }}>生成相似原型 (AI Remix)</button>
                <button onClick={() => set(p => ({ ...p, editMode: !p.editMode }))}>{s.editMode ? "退出设计模式" : "进入设计模式 (Edit)"}</button>
                <button onClick={() => alert("OS MCP Daemon received Export Command! Check console.")}>导出到代码 / Figma (Export)</button>
              </div>

            </div>
          </aside>
        )}
      </div>

      <style>{`
        .proto-view {
          display: flex;
          flex-direction: column;
          height: 100vh;
        }
        .proto-top-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .proto-top-actions .divider {
          width: 1px;
          height: 24px;
          background: #e5e7eb;
          margin: 0 8px;
        }
        .proto-top-actions button {
          padding: 6px 12px;
          background: #f3f4f6;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          color: #4b5563;
          cursor: pointer;
        }
        .proto-top-actions button.active {
          background: #eef2ff;
          color: #4f46e5;
        }
        .proto-top-actions button.primary {
          background: #111827;
          color: #fff;
        }
        .proto-top-actions button.primary.active {
          background: #4f46e5;
        }
        
        .proto-workspace {
          flex: 1;
          display: flex;
          overflow: hidden;
          background: #f3f4f6; /* Figma-like canvas bg */
        }
        
        /* Left Sidebar */
        .proto-sidebar-left {
          width: 240px;
          background: #fff;
          border-right: 1px solid #e5e7eb;
          display: flex;
          flex-direction: column;
          z-index: 10;
        }
        .proto-panel-header {
          padding: 16px;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .proto-panel-header h3 {
          margin: 0;
          font-size: 13px;
          font-weight: 700;
          color: #111827;
        }
        .proto-panel-header .count {
          font-size: 12px;
          color: #9ca3af;
          font-weight: 600;
        }
        .proto-layers {
          flex: 1;
          overflow-y: auto;
          padding: 8px 0;
        }
        .layer-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 16px;
          background: transparent;
          border: none;
          cursor: pointer;
          text-align: left;
        }
        .layer-item:hover { background: #f9fafb; }
        .layer-item.active { background: #eef2ff; }
        .layer-icon {
          font-size: 14px;
          color: #9ca3af;
          font-family: monospace;
          font-weight: bold;
        }
        .layer-item.active .layer-icon { color: #4f46e5; }
        .layer-name {
          font-size: 13px;
          color: #374151;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .layer-item.active .layer-name { color: #4f46e5; font-weight: 600; }
        
        /* Center Canvas */
        .proto-canvas-area {
          flex: 1;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: auto;
        }
        .canvas-wrapper {
          padding: 60px;
          min-width: 100%;
          min-height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .canvas-scaler {
          transform-origin: center center;
          transition: transform 0.2s cubic-bezier(0.165, 0.84, 0.44, 1);
        }
        
        /* Device Chrome */
        .mockup-mac {
          width: 1200px;
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.05);
          overflow: hidden;
        }
        .mac-header {
          height: 44px;
          background: #f1f3f5;
          display: flex;
          align-items: center;
          padding: 0 16px;
          border-bottom: 1px solid #e5e7eb;
          position: relative;
        }
        .mac-dots {
          display: flex;
          gap: 8px;
        }
        .mac-dots span {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          display: inline-block;
        }
        .mac-url {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          background: #fff;
          padding: 4px 120px;
          border-radius: 6px;
          font-size: 12px;
          color: #9ca3af;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }
        .mac-body {
          width: 100%;
          aspect-ratio: 3/2; /* matching 1200x800 */
          background: #fff;
          overflow: hidden;
          position: relative;
        }
        .mac-body img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        
        .mockup-iphone {
          width: 390px;
          height: 844px;
          background: #fff;
          border: 14px solid #111;
          border-radius: 48px;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25), inset 0 0 0 2px #333;
          position: relative;
          overflow: hidden;
        }
        .iphone-notch {
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 140px;
          height: 28px;
          background: #111;
          border-bottom-left-radius: 16px;
          border-bottom-right-radius: 16px;
          z-index: 10;
        }
        .iphone-body {
          width: 100%;
          height: 100%;
        }
        .iphone-body img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .iphone-home {
          position: absolute;
          bottom: 12px;
          left: 50%;
          transform: translateX(-50%);
          width: 120px;
          height: 5px;
          background: rgba(0,0,0,0.3);
          border-radius: 4px;
          z-index: 10;
        }
        
        .proto-zoom-ctrl {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          background: #fff;
          padding: 6px;
          border-radius: 8px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
          display: flex;
          align-items: center;
          gap: 4px;
          z-index: 20;
        }
        .proto-zoom-ctrl button {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          border-radius: 6px;
          font-size: 16px;
          cursor: pointer;
          color: #4b5563;
        }
        .proto-zoom-ctrl button:hover { background: #f3f4f6; }
        .proto-zoom-ctrl span {
          width: 48px;
          text-align: center;
          font-size: 13px;
          font-weight: 600;
          color: #111827;
          cursor: pointer;
        }
        .proto-zoom-ctrl span:hover { color: #4f46e5; }
        
        /* Right Sidebar (Inspect) */
        .proto-sidebar-right {
          width: 280px;
          background: #fff;
          border-left: 1px solid #e5e7eb;
          display: flex;
          flex-direction: column;
          z-index: 10;
        }
        .inspect-content {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
        }
        .inspect-block {
          margin-bottom: 24px;
        }
        .inspect-block h4 {
          margin: 0 0 12px 0;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #6b7280;
          font-weight: 600;
        }
        .prop-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .prop-item {
          font-size: 13px;
          color: #111827;
          font-weight: 500;
          display: flex;
          align-items: center;
        }
        .prop-item span {
          color: #9ca3af;
          margin-right: 8px;
          width: 12px;
        }
        
        .color-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .color-item {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .color-patch {
          width: 24px;
          height: 24px;
          border-radius: 4px;
        }
        .color-hex {
          font-size: 13px;
          font-family: monospace;
          color: #374151;
        }
        
        .typo-item {
          margin-bottom: 12px;
          background: #f9fafb;
          padding: 10px;
          border-radius: 6px;
        }
        .typo-family { font-size: 13px; font-weight: 600; color: #111827; margin-bottom: 4px; }
        .typo-css { font-size: 12px; color: #6b7280; }
        
        .comp-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .comp-tag {
          padding: 4px 8px;
          background: #eef2ff;
          color: #4f46e5;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
        }
        
        .inspect-export {
          margin-top: 32px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          border-top: 1px solid #e5e7eb;
          padding-top: 24px;
        }
        .inspect-export button {
          padding: 10px;
          background: #fff;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          color: #374151;
          cursor: pointer;
        }
        .inspect-export button:hover {
          border-color: #4f46e5;
          color: #4f46e5;
        }
      `}</style>
    </main>
  );
}
