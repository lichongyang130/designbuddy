import { useMemo, useState, useEffect } from "react";
import { navigateTo } from "../../../../frontend/workspace/workspaceRoutes";
import { samples, copySample, drafts } from "./samples/shared";
import { HomeIcon } from "../components/HomeIcon";
import "./template-detail.css";

export default function TemplateDetailPage({ sampleId }: { sampleId: string }) {
  const sample = samples.find(s => s.id === sampleId);
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("designbuddy.favorites");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [comments, setComments] = useState<{user: string; text: string; date: string}[]>(() => {
    try {
      const stored = localStorage.getItem(`designbuddy.comments.${sampleId}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [newComment, setNewComment] = useState("");

  const isFavorite = favorites.has(sampleId);

  useEffect(() => {
    try {
      localStorage.setItem("designbuddy.favorites", JSON.stringify([...favorites]));
    } catch {}
  }, [favorites]);

  useEffect(() => {
    try {
      localStorage.setItem(`designbuddy.comments.${sampleId}`, JSON.stringify(comments));
    } catch {}
  }, [comments, sampleId]);

  if (!sample) {
    return (
      <main className="template-detail-unavailable">
        <h1>模版不存在</h1>
        <button onClick={() => navigateTo("/inspiration")}>返回社区</button>
      </main>
    );
  }

  const handleToggleFavorite = () => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(sampleId)) next.delete(sampleId);
      else next.add(sampleId);
      return next;
    });
  };

  const handlePostComment = () => {
    if (!newComment.trim()) return;
    setComments([{
      user: "访客用户",
      text: newComment,
      date: new Date().toLocaleDateString("zh-CN")
    }, ...comments]);
    setNewComment("");
  };

  return (
    <div className="template-detail-page">
      <header className="template-detail-header">
        <button className="back-btn" onClick={() => navigateTo("/inspiration")}>
          <HomeIcon name="chevron" size={16} /> 返回社区
        </button>
      </header>

      <div className="template-detail-content">
        <div className="template-detail-hero">
          <div className="template-preview-large">
            {sample.photos && sample.photos.length > 0 ? (
              <img src={sample.photos[0].url} alt={sample.title} />
            ) : (
              <div className="placeholder-gradient" />
            )}
          </div>
          
          <div className="template-meta-card">
            <div className="template-meta-header">
              <span className="template-category-badge">{sample.category}</span>
              <button 
                className={`favorite-btn ${isFavorite ? 'active' : ''}`}
                onClick={handleToggleFavorite}
              >
                {isFavorite ? "❤️" : "🤍"}
              </button>
            </div>
            
            <h1>{sample.title}</h1>
            <p className="template-description">{sample.description}</p>
            
            <div className="template-stats">
              <div className="stat">
                <span className="stat-value">{sample.photos?.length || 0}</span>
                <span className="stat-label">预览图</span>
              </div>
              <div className="stat">
                <span className="stat-value">{sample.format}</span>
                <span className="stat-label">格式</span>
              </div>
            </div>

            <div className="template-actions">
              <button className="use-template-btn" onClick={() => navigateTo(`/inspiration/${sample.id}`)}>
                使用此模版
              </button>
              <button className="share-template-btn" onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                alert("链接已复制到剪贴板！");
              }}>
                分享模版
              </button>
            </div>
          </div>
        </div>

        <section className="template-gallery">
          <h2>预览图册</h2>
          <div className="gallery-grid">
            {sample.photos?.slice(1).map((photo, idx) => (
              <div key={idx} className="gallery-item">
                <img src={photo.url} alt={`${sample.title} 预览 ${idx + 1}`} loading="lazy" />
              </div>
            ))}
          </div>
        </section>

        <section className="template-comments">
          <h2>用户评价</h2>
          <div className="comment-input-area">
            <textarea 
              placeholder="分享你对这个模版的看法..."
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
            />
            <button onClick={handlePostComment}>发布评价</button>
          </div>
          
          <div className="comments-list">
            {comments.length === 0 ? (
              <p className="no-comments">暂无评价，成为第一个评价的人吧！</p>
            ) : (
              comments.map((c, i) => (
                <div key={i} className="comment-card">
                  <div className="comment-header">
                    <strong>{c.user}</strong>
                    <span>{c.date}</span>
                  </div>
                  <p>{c.text}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
