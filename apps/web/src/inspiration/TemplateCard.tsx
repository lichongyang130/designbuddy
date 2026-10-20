import { type MouseEvent } from "react";

export interface Template {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  author: string;
  authorAvatar: string;
  uses: number;
  favorites: number;
  rating: number;
  isFeatured?: boolean;
  isHot?: boolean;
  isNew?: boolean;
  preview: string;
  format: string;
}

export default function TemplateCard({
  template,
  isFavorite,
  onToggleFavorite,
  onUse,
  formatNumber,
}: {
  template: Template;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onUse: () => void;
  formatNumber: (num: number) => string;
}) {
  const gradients: Record<string, string> = {
    "gradient-1": "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    "gradient-2": "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    "gradient-3": "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    "gradient-4": "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
    "gradient-5": "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
    "gradient-6": "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
  };

  const isGradient = template.preview.startsWith("gradient");

  return (
    <article className="inspiration-card">
      <div
        className="inspiration-card-preview"
        style={isGradient ? { background: gradients[template.preview] } : {}}
        onClick={onUse}
      >
        {!isGradient && (
          <img 
            src={template.preview} 
            alt={`${template.title} 预览`} 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            loading="lazy" 
          />
        )}
        <button
          className={`inspiration-card-favorite ${isFavorite ? "is-favorite" : ""}`}
          onClick={(e: MouseEvent<HTMLButtonElement>) => {
            e.stopPropagation();
            onToggleFavorite(template.id);
          }}
        >
          {isFavorite ? "❤️" : "🤍"}
        </button>
        {template.isHot && <div className="inspiration-card-badge">🔥 热门</div>}
        {template.isNew && !template.isHot && (
          <div className="inspiration-card-badge">✨ 新品</div>
        )}
      </div>
      <div className="inspiration-card-body">
        <h3 className="inspiration-card-title">{template.title}</h3>
        <p className="inspiration-card-description">{template.description}</p>
        <div className="inspiration-card-meta">
          <div className="inspiration-card-author">
            <div className="inspiration-card-avatar">{template.authorAvatar}</div>
            <span className="inspiration-card-author-name">{template.author}</span>
          </div>
          <div className="inspiration-card-stats">
            <span className="inspiration-card-stat">
              👁️ {formatNumber(template.uses)}
            </span>
            <span className="inspiration-card-stat">
              ❤️ {formatNumber(template.favorites)}
            </span>
            <span className="inspiration-card-stat">⭐ {template.rating}</span>
          </div>
        </div>
        <button className="inspiration-use-btn" onClick={onUse}>
          查看详情
        </button>
      </div>
    </article>
  );
}
