/**
 * 通用模版占位组件
 * 用于尚未实现完整原型的模版
 */

import { useSampleState, SampleTop, copySample, Notice, Credits, type Photo } from './shared';
import filmUrl from "../../assets/media/lakeside-film.mp4";
import audioUrl from "../../assets/media/soft-signals.wav";

interface GenericTemplateState {
  page: number;
  favorites: number[];
  notes: string;
}

const defaultState: GenericTemplateState = {
  page: 0,
  favorites: [],
  notes: '',
};

interface GenericTemplateProps {
  templateId: string;
  category?: string;
  templateTitle: string;
  templateDescription: string;
  photos: Photo[];
  draftId?: string;
}

export default function GenericTemplate({
  templateId,
  category,
  templateTitle,
  templateDescription,
  photos,
  draftId,
}: GenericTemplateProps) {
  const [state, setState, error] = useSampleState(
    templateId as any,
    draftId,
    defaultState
  );

  const patch = (updates: Partial<GenericTemplateState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  const toggleFavorite = () => {
    const newFavorites = state.favorites.includes(state.page)
      ? state.favorites.filter((p) => p !== state.page)
      : [...state.favorites, state.page];
    patch({ favorites: newFavorites });
  };

  return (
    <div className="generic-template">
      <SampleTop
        type={templateId}
        title={templateTitle}
        draftId={draftId}
        onCopy={() => copySample(templateId as any, state)}
      >
        <button onClick={toggleFavorite}>
          {state.favorites.includes(state.page) ? '★ 已收藏' : '☆ 收藏'}
        </button>
      </SampleTop>

      {error && <Notice text={error} />}

      <div className="generic-template-hero">
        <h2>{templateTitle}</h2>
        <p>{templateDescription}</p>
      </div>

      <div className="generic-template-content">
        {category === "视频" && (
          <div className="generic-template-media">
            <video src={filmUrl} controls playsInline style={{ width: '100%', borderRadius: '12px', background: '#000' }} />
          </div>
        )}
        {category === "音频" && (
          <div className="generic-template-media" style={{ padding: '20px', background: '#f3f4f6', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <audio src={audioUrl} controls style={{ width: '80%' }} />
          </div>
        )}

        <div className="generic-template-preview">
          {photos[state.page] && (
            <img
              src={photos[state.page].url}
              alt={photos[state.page].label}
              className="generic-template-image"
            />
          )}
        </div>

        <div className="generic-template-controls">
          <button
            onClick={() => patch({ page: Math.max(0, state.page - 1) })}
            disabled={state.page === 0}
          >
            ← 上一页
          </button>
          <span>
            {state.page + 1} / {photos.length}
          </span>
          <button
            onClick={() => patch({ page: Math.min(photos.length - 1, state.page + 1) })}
            disabled={state.page === photos.length - 1}
          >
            下一页 →
          </button>
        </div>

        <div className="generic-template-info">
          <h3>{photos[state.page]?.label}</h3>
          <p className="generic-template-credit">
            {photos[state.page]?.credit} · {photos[state.page]?.license}
          </p>
        </div>

        <div className="generic-template-notes">
          <label>
            我的笔记：
            <textarea
              value={state.notes}
              onChange={(e) => patch({ notes: e.target.value })}
              placeholder="在这里记录你的想法..."
              rows={4}
            />
          </label>
        </div>

        <div className="generic-template-thumbnails">
          {photos.map((photo, index) => (
            <button
              key={index}
              onClick={() => patch({ page: index })}
              className={`thumbnail ${index === state.page ? 'active' : ''}`}
            >
              <img src={photo.url} alt={photo.label} />
              <span>{index + 1}</span>
            </button>
          ))}
        </div>
      </div>

      <Credits photos={photos} />

      <style>{`
        .generic-template {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }

        .generic-template-hero {
          text-align: center;
          padding: 40px 20px;
          background: linear-gradient(135deg, #0f111a 0%, #1e1b4b 100%);
          box-shadow: 0 20px 40px -10px rgba(0,0,0,0.3);
          color: white;
          border-radius: 16px;
          margin-bottom: 32px;
        }

        .generic-template-hero h2 {
          font-weight: 800;
          letter-spacing: -0.02em;
          font-size: 32px;
          margin: 0 0 12px 0;
        }

        .generic-template-hero p {
          color: #9ca3af;
          font-size: 16px;
          opacity: 0.9;
          margin: 0;
        }

        .generic-template-content {
          display: grid;
          gap: 24px;
        }

        .generic-template-preview {
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .generic-template-image {
          width: 100%;
          height: auto;
          display: block;
        }

        .generic-template-controls {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 24px;
          padding: 16px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .generic-template-controls button {
          padding: 10px 20px;
          border: 1px solid #e5e7eb;
          background: white;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.3s cubic-bezier(0.165, 0.84, 0.44, 1);
        }

        .generic-template-controls button:hover:not(:disabled) {
          background: #f9fafb;
          border-color: #667eea;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102,126,234,0.15);
        }

        .generic-template-controls button:active:not(:disabled) {
          transform: translateY(0);
        }

        .generic-template-controls button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .generic-template-info {
          border-left: 4px solid #4f46e5;
          padding: 20px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .generic-template-info h3 {
          margin: 0 0 8px 0;
          font-size: 20px;
          color: #1a1a1a;
        }

        .generic-template-credit {
          margin: 0;
          font-size: 14px;
          color: #6b7280;
        }

        .generic-template-notes {
          padding: 20px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .generic-template-notes label {
          display: block;
          font-weight: 600;
          margin-bottom: 8px;
          color: #374151;
        }

        .generic-template-notes textarea {
          width: 100%;
          padding: 12px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-family: inherit;
          font-size: 14px;
          resize: vertical;
        }

        .generic-template-thumbnails {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 12px;
        }

        .thumbnail {
          aspect-ratio: 4/3;
          position: relative;
          border: 2px solid transparent;
          border-radius: 8px;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.165, 0.84, 0.44, 1);
          background: white;
          padding: 0;
        }

        .thumbnail:hover {
          border-color: #667eea;
          transform: translateY(-4px);
          box-shadow: 0 6px 16px rgba(102, 126, 234, 0.2);
        }

        .thumbnail.active {
          border-color: #667eea;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
          transform: translateY(-2px);
        }

        .thumbnail img {
          height: 100%;
          object-fit: cover;
          width: 100%;
          height: 80px;
          object-fit: cover;
          display: block;
        }

        .thumbnail span {
          display: block;
          padding: 6px;
          text-align: center;
          font-size: 12px;
          font-weight: 600;
          color: #374151;
        }

        @media (max-width: 768px) {
          .generic-template-hero h2 {
            font-size: 24px;
          }

          .generic-template-thumbnails {
            grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
          }

          .thumbnail img {
            height: 60px;
          }
        }
      `}</style>
    </div>
  );
}
