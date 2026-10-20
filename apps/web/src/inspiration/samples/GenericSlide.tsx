import { useEffect, useRef, useState, useMemo } from "react";
import { SampleTop, Notice, copySample, download, useSampleState, type SampleId, type Photo } from "./shared";
import "./samples.css";

const BUSINESS_TOPICS = [
  "2026 年度战略规划与前瞻",
  "Q3 市场洞察与核心业绩回顾",
  "商业化变现与增长漏斗分析",
  "下一代产品架构与技术壁垒",
  "全球化生态布局与合伙人计划",
  "敏捷开发与自动化交付标准",
  "品牌视觉升级与用户心智建设"
];

const BUSINESS_BULLETS = [
  ["营收同比增长 142%", "核心活跃用户突破 400W", "下沉市场渗透率达 35%"],
  ["自研多模态 AI 引擎全面上线", "毫秒级实时计算节点覆盖亚太", "全链路自动化运维降本增效"],
  ["构建以用户价值为核心的护城河", "模块化组件提升 300% 交付效率", "企业级客户留存率稳定在 98%"],
  ["数据合规与隐私保护机制升级", "多端体验一致性达标率 99.9%", "开放 API 接口日均调用破亿"]
];

function generateSlideData(seed: number, pageIndex: number, photo: Photo) {
  const isCover = pageIndex === 0;
  const isStatement = pageIndex % 5 === 0 && pageIndex !== 0;
  const isFull = pageIndex % 7 === 0 && pageIndex !== 0;
  
  let layout = 'split';
  if (isCover) layout = 'cover';
  else if (isStatement) layout = 'statement';
  else if (isFull) layout = 'full';

  const tIndex = (seed + pageIndex * 3) % BUSINESS_TOPICS.length;
  const bIndex = (seed + pageIndex * 7) % BUSINESS_BULLETS.length;

  return {
    layout,
    title: isCover ? `${BUSINESS_TOPICS[tIndex].split('与')[0]}\nBUSINESS UPDATE` : BUSINESS_TOPICS[tIndex],
    subtitle: isCover ? "CONFIDENTIAL & PROPRIETARY · DESIGNBUDDY STUDIO" : BUSINESS_BULLETS[bIndex].join('\n'),
    photoUrl: photo.url,
  };
}

export function GenericSlide({ draftId, sample }: { draftId?: string; sample: any }) {
  const seed = parseInt(sample.id.split('-')[1]) || 1;
  const initialSlides = useMemo(() => {
    const slides = [];
    for (let i = 0; i < sample.photos.length; i++) {
      slides.push(generateSlideData(seed, i, sample.photos[i]));
    }
    return slides;
  }, [seed, sample.photos]);

  const [s, set, error] = useSampleState(sample.id as SampleId, draftId, {
    page: 0,
    slides: initialSlides,
    presenting: false
  });

  const [notice, msg] = useState("");
  const [editing, edit] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const active = Math.max(0, Math.min(sample.photos.length - 1, s.page));
  const currentSlide = s.slides[active] || initialSlides[active];

  const updateCurrentSlide = (updates: any) => {
    set((prev) => {
      const nextSlides = [...(prev.slides || initialSlides)];
      nextSlides[active] = { ...nextSlides[active], ...updates };
      return { ...prev, slides: nextSlides };
    });
  };

  const jump = (i: number) => set(prev => ({ ...prev, page: i }));

  const togglePresent = () => {
    if (!s.presenting && containerRef.current) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    set(prev => ({ ...prev, presenting: !prev.presenting }));
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && s.presenting) {
        set(prev => ({ ...prev, presenting: false }));
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [s.presenting]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (s.presenting) {
        if (e.key === "ArrowRight" || e.key === "Space" || e.key === "Enter") {
          jump(Math.min(sample.photos.length - 1, active + 1));
        } else if (e.key === "ArrowLeft") {
          jump(Math.max(0, active - 1));
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [s.presenting, active, sample.photos.length]);

  const exportPPTX = async () => {
    msg("正在打包并生成带有高清配图的完整 PPTX，请稍候...");
    try {
      const { default: PptxGenJS } = await import("pptxgenjs");
      const pres = new PptxGenJS();
      pres.layout = "LAYOUT_16x9";
      
      // Default 16:9 in pptxgenjs is 10 x 5.625 inches
      const currentSlides = s.slides || initialSlides;
      for (const sl of currentSlides) {
        const slide = pres.addSlide();
        
        const fetchImageBase64 = async (url: string) => {
          try {
            const res = await fetch(url);
            const blob = await res.blob();
            return await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
          } catch (e) {
            return null;
          }
        };

        if (sl.layout === 'cover') {
          const b64 = await fetchImageBase64(sl.photoUrl);
          if (b64) slide.addImage({ data: b64, x: 0, y: 0, w: 10, h: 5.625, sizing: { type: 'cover', w: 10, h: 5.625 } });
          slide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 10, h: 5.625, fill: { color: "0F111A", transparency: 30 } });
          slide.addText(sl.title, { x: 1, y: 1.5, w: 8, h: 2, fontSize: 44, bold: true, color: "FFFFFF", breakLine: true });
          slide.addText(sl.subtitle, { x: 1, y: 4, w: 8, h: 1, fontSize: 18, color: "9CA3AF" });
        } else if (sl.layout === 'split') {
          slide.background = { color: "FFFFFF" };
          slide.addText(sl.title, { x: 0.5, y: 0.5, w: 4.5, h: 1, fontSize: 28, bold: true, color: "111827" });
          const bullets = sl.subtitle.split('\n').map((b: string) => ({ text: b, options: { bullet: true } }));
          slide.addText(bullets, { x: 0.5, y: 2, w: 4.5, h: 3, fontSize: 18, color: "4B5563" });
          const b64 = await fetchImageBase64(sl.photoUrl);
          if (b64) {
            slide.addImage({ data: b64, x: 5, y: 0, w: 5, h: 5.625, sizing: { type: 'cover', w: 5, h: 5.625 } });
          } else {
            slide.addText("[ Image Placeholder ]", { x: 5, y: 0, w: 5, h: 5.625, fill: { color: "F3F4F6" }, align: 'center', color: "9CA3AF" });
          }
        } else if (sl.layout === 'full') {
          const b64 = await fetchImageBase64(sl.photoUrl);
          if (b64) slide.addImage({ data: b64, x: 0, y: 0, w: 10, h: 5.625, sizing: { type: 'cover', w: 10, h: 5.625 } });
          slide.addShape(pres.ShapeType.rect, { x: 0, y: 4.625, w: 10, h: 1, fill: { color: "000000", transparency: 20 } });
          slide.addText(sl.title, { x: 0.5, y: 4.625, w: 9, h: 1, fontSize: 20, bold: true, color: "FFFFFF", align: 'left' });
        } else {
          // statement
          slide.background = { color: "F9FAFB" };
          slide.addText(sl.title, { x: 1, y: 2, w: 8, h: 1.5, fontSize: 36, bold: true, color: "111827", align: 'center' });
          slide.addShape(pres.ShapeType.rect, { x: 4.5, y: 4, w: 1, h: 0.1, fill: { color: "4F46E5" } });
        }
      }
      pres.writeFile({ fileName: `${sample.id}-presentation.pptx` });
      msg("PPTX 导出成功！文件包含高清图片与完整排版结构。");
    } catch (e) {
      console.error(e);
      msg("PPTX 导出失败，请检查网络。");
    }
  };

  return (
    <main className="sample-view slide-view">
      {!s.presenting && (
        <SampleTop
          type={`商业演示文稿 · 16:9 · ${sample.photos.length}页`}
          title={sample.title}
          draftId={draftId}
          onCopy={() => {
            try { copySample(sample.id as SampleId, s); } 
            catch { msg("保存失败，请检查存储。"); }
          }}
        >
          <button onClick={exportPPTX}>导出 PPTX</button>
          <button onClick={togglePresent} style={{ background: '#4f46e5', color: '#fff', border: 'none' }}>演示 (F5)</button>
        </SampleTop>
      )}
      <Notice text={error || notice} />

      <div className={`slide-workspace ${s.presenting ? 'presenting' : ''}`} ref={containerRef}>
        {!s.presenting && (
          <aside className="slide-sidebar">
            <div className="slide-sidebar-head">
              <h3>幻灯片 ({sample.photos.length})</h3>
              <button aria-pressed={editing} onClick={() => edit(!editing)}>
                {editing ? "完成排版" : "修改文案"}
              </button>
            </div>
            <div className="slide-thumbnails">
              {sample.photos.map((_: any, i: number) => (
                <button
                  key={i}
                  className={`slide-thumb-btn ${active === i ? "active" : ""}`}
                  onClick={() => jump(i)}
                >
                  <span className="slide-thumb-num">{i + 1}</span>
                  <div className="slide-thumb-preview">
                    {/* Miniature representation of the layout */}
                    <div className={`thumb-mock layout-${(s.slides[i] || initialSlides[i]).layout}`}></div>
                  </div>
                </button>
              ))}
            </div>
          </aside>
        )}

        <div className="slide-main">
          <div className="slide-stage-container">
            <div className={`slide-canvas layout-${currentSlide.layout}`}>
              {currentSlide.layout === 'cover' && (
                <>
                  <div className="slide-bg" style={{ backgroundImage: `url(${currentSlide.photoUrl})` }} />
                  <div className="slide-overlay" />
                  <div className="slide-content cover-content">
                    {editing ? (
                      <textarea className="edit-title dark-edit" value={currentSlide.title} onChange={e => updateCurrentSlide({title: e.target.value})} />
                    ) : (
                      <h1 style={{ whiteSpace: 'pre-line' }}>{currentSlide.title}</h1>
                    )}
                    {editing ? (
                      <input className="edit-subtitle dark-edit" value={currentSlide.subtitle} onChange={e => updateCurrentSlide({subtitle: e.target.value})} />
                    ) : (
                      <p>{currentSlide.subtitle}</p>
                    )}
                  </div>
                </>
              )}

              {currentSlide.layout === 'split' && (
                <>
                  <div className="slide-split-text">
                    {editing ? (
                      <textarea className="edit-title light-edit" value={currentSlide.title} onChange={e => updateCurrentSlide({title: e.target.value})} />
                    ) : (
                      <h2>{currentSlide.title}</h2>
                    )}
                    {editing ? (
                      <textarea className="edit-bullets light-edit" value={currentSlide.subtitle} onChange={e => updateCurrentSlide({subtitle: e.target.value})} />
                    ) : (
                      <ul>
                        {currentSlide.subtitle.split('\n').map((line: string, idx: number) => (
                          <li key={idx}>{line}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="slide-split-img">
                    <img src={currentSlide.photoUrl} alt="Slide Visual" />
                  </div>
                </>
              )}

              {currentSlide.layout === 'statement' && (
                <>
                  <div className="slide-content statement-content">
                    {editing ? (
                      <textarea className="edit-title light-edit" style={{ textAlign: 'center' }} value={currentSlide.title} onChange={e => updateCurrentSlide({title: e.target.value})} />
                    ) : (
                      <h2>{currentSlide.title}</h2>
                    )}
                    <div className="statement-deco"></div>
                  </div>
                </>
              )}

              {currentSlide.layout === 'full' && (
                <>
                  <div className="slide-bg" style={{ backgroundImage: `url(${currentSlide.photoUrl})` }} />
                  <div className="full-caption">
                    {editing ? (
                      <input className="edit-subtitle light-edit" value={currentSlide.title} onChange={e => updateCurrentSlide({title: e.target.value})} />
                    ) : (
                      <p>{currentSlide.title}</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          
          {!s.presenting && (
            <div className="slide-toolbar">
              <span className="toolbar-label">切换排版:</span>
              <div className="toolbar-group">
                {['cover', 'split', 'statement', 'full'].map(ly => (
                  <button 
                    key={ly} 
                    className={currentSlide.layout === ly ? 'active' : ''}
                    onClick={() => updateCurrentSlide({ layout: ly })}
                  >
                    {ly.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .slide-workspace {
          display: flex;
          height: calc(100vh - 60px);
          background: #e5e7eb;
          overflow: hidden;
        }
        .slide-workspace.presenting {
          height: 100vh;
          background: #000;
        }
        .slide-sidebar {
          width: 260px;
          background: #f9fafb;
          border-right: 1px solid #d1d5db;
          display: flex;
          flex-direction: column;
        }
        .slide-sidebar-head {
          padding: 20px;
          border-bottom: 1px solid #e5e7eb;
          background: #fff;
        }
        .slide-sidebar-head h3 {
          margin: 0 0 12px 0;
          font-size: 14px;
          font-weight: 700;
          color: #374151;
        }
        .slide-sidebar-head button {
          width: 100%;
          padding: 8px;
          background: #eef2ff;
          color: #4f46e5;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .slide-sidebar-head button[aria-pressed="true"] {
          background: #4f46e5;
          color: #fff;
        }
        .slide-thumbnails {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .slide-thumb-btn {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          background: transparent;
          border: none;
          cursor: pointer;
          text-align: left;
          padding: 0;
        }
        .slide-thumb-num {
          font-size: 12px;
          font-weight: 600;
          color: #9ca3af;
          width: 20px;
          padding-top: 4px;
        }
        .slide-thumb-btn.active .slide-thumb-num {
          color: #4f46e5;
        }
        .slide-thumb-preview {
          flex: 1;
          aspect-ratio: 16/9;
          background: #fff;
          border-radius: 6px;
          border: 2px solid transparent;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          overflow: hidden;
          transition: all 0.2s;
        }
        .slide-thumb-btn:hover .slide-thumb-preview {
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .slide-thumb-btn.active .slide-thumb-preview {
          border-color: #4f46e5;
        }
        .thumb-mock {
          width: 100%;
          height: 100%;
          background: #e5e7eb;
        }
        .thumb-mock.layout-cover { background: #111827; }
        .thumb-mock.layout-split { background: linear-gradient(90deg, #fff 50%, #d1d5db 50%); }
        .thumb-mock.layout-statement { background: #fff; border: 4px solid #fff; }
        
        .slide-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          position: relative;
        }
        .slide-stage-container {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px;
        }
        .slide-workspace.presenting .slide-stage-container {
          padding: 0;
        }
        .slide-canvas {
          background: #fff;
          width: 100%;
          max-width: 1120px;
          aspect-ratio: 16/9;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
          position: relative;
          overflow: hidden;
          display: flex;
        }
        .slide-workspace.presenting .slide-canvas {
          max-width: none;
          height: 100vh;
          width: auto;
          box-shadow: none;
        }
        
        /* Layouts */
        .slide-bg {
          position: absolute;
          inset: 0;
          background-size: cover;
          background-position: center;
          z-index: 1;
        }
        .slide-overlay {
          position: absolute;
          inset: 0;
          background: rgba(15, 17, 26, 0.7);
          z-index: 2;
        }
        .slide-content {
          position: relative;
          z-index: 3;
          padding: 60px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          width: 100%;
        }
        .cover-content h1 {
          font-size: 56px;
          color: #fff;
          margin: 0 0 24px 0;
          font-weight: 800;
          line-height: 1.1;
          letter-spacing: -0.02em;
        }
        .cover-content p {
          font-size: 18px;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 2px;
          margin: 0;
        }
        
        .layout-split {
          display: flex;
        }
        .slide-split-text {
          flex: 1;
          padding: 60px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          background: #fff;
          z-index: 2;
        }
        .slide-split-text h2 {
          font-size: 40px;
          color: #111827;
          margin: 0 0 40px 0;
          font-weight: 800;
          line-height: 1.2;
          letter-spacing: -0.02em;
        }
        .slide-split-text ul {
          padding-left: 24px;
          margin: 0;
          color: #4b5563;
          font-size: 24px;
          line-height: 2;
        }
        .slide-split-text li {
          margin-bottom: 16px;
        }
        .slide-split-img {
          flex: 1;
          position: relative;
        }
        .slide-split-img img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .layout-statement {
          background: #f9fafb;
          text-align: center;
          align-items: center;
        }
        .statement-content {
          align-items: center;
        }
        .statement-content h2 {
          font-size: 48px;
          color: #111827;
          line-height: 1.3;
          font-weight: 800;
          margin: 0;
          max-width: 80%;
        }
        .statement-deco {
          width: 60px;
          height: 6px;
          background: #4f46e5;
          margin-top: 40px;
        }
        
        .layout-full {
          background: #000;
        }
        .full-caption {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 30px 40px;
          background: linear-gradient(transparent, rgba(0,0,0,0.8));
          z-index: 3;
        }
        .full-caption p {
          color: #fff;
          font-size: 20px;
          margin: 0;
          font-weight: 500;
        }
        
        /* Editing Inputs */
        textarea, input {
          font-family: inherit;
          background: rgba(255,255,255,0.1);
          border: 1px dashed rgba(255,255,255,0.3);
          border-radius: 4px;
          padding: 8px;
          outline: none;
        }
        textarea:focus, input:focus {
          border-color: #4f46e5;
          background: rgba(255,255,255,0.2);
        }
        .dark-edit {
          color: #fff;
        }
        .light-edit {
          color: #111827;
          background: rgba(0,0,0,0.05);
          border-color: rgba(0,0,0,0.1);
        }
        .light-edit:focus {
          background: rgba(0,0,0,0.02);
        }
        .edit-title {
          font-size: 40px;
          font-weight: 800;
          width: 100%;
          min-height: 120px;
          margin-bottom: 20px;
          line-height: 1.2;
        }
        .cover-content .edit-title {
          font-size: 56px;
        }
        .edit-subtitle, .edit-bullets {
          width: 100%;
          font-size: 20px;
          line-height: 1.8;
        }
        .edit-bullets {
          min-height: 200px;
        }
        
        /* Toolbar */
        .slide-toolbar {
          height: 60px;
          background: #fff;
          border-top: 1px solid #d1d5db;
          display: flex;
          align-items: center;
          padding: 0 24px;
          gap: 16px;
        }
        .toolbar-label {
          font-size: 13px;
          font-weight: 600;
          color: #6b7280;
        }
        .toolbar-group {
          display: flex;
          gap: 8px;
          background: #f3f4f6;
          padding: 4px;
          border-radius: 8px;
        }
        .toolbar-group button {
          padding: 6px 16px;
          border: none;
          background: transparent;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          color: #4b5563;
          cursor: pointer;
        }
        .toolbar-group button.active {
          background: #fff;
          color: #111827;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
      `}</style>
    </main>
  );
}
