import { useState, useMemo } from "react";
import { HomeIcon, type HomeIconName } from "../components/HomeIcon";
import { navigateTo } from "../../../../frontend/workspace/workspaceRoutes";
import { WorkBuddySidebar } from "../components/WorkBuddySidebar";
import { listProjects } from "../../../../frontend/workspace/projectStore";
import "./inspiration-enhanced.css";

interface Template {
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

const mockTemplates: Template[] = [
  {
    id: "business-presentation",
    title: "商务演示模版",
    description: "专业的商务演示PPT模版，适用于公司介绍、产品发布、商业计划等场景",
    category: "幻灯片",
    tags: ["商务", "演示", "PPT"],
    author: "DesignBuddy",
    authorAvatar: "D",
    uses: 12580,
    favorites: 3420,
    rating: 4.9,
    isFeatured: true,
    isHot: true,
    preview: "gradient-1",
    format: "PPTX",
  },
  {
    id: "data-analysis-report",
    title: "数据分析报告",
    description: "清晰的数据可视化报告模版，包含图表、表格和分析结论展示",
    category: "文档",
    tags: ["数据", "报告", "分析"],
    author: "DesignBuddy",
    authorAvatar: "D",
    uses: 8920,
    favorites: 2150,
    rating: 4.8,
    isFeatured: true,
    preview: "gradient-2",
    format: "DOCX",
  },
  {
    id: "marketing-landing",
    title: "营销落地页",
    description: "高转化率的营销落地页模版，适用于产品推广和活动营销",
    category: "网页",
    tags: ["营销", "落地页", "网页"],
    author: "DesignBuddy",
    authorAvatar: "D",
    uses: 15670,
    favorites: 4230,
    rating: 4.9,
    isFeatured: true,
    isHot: true,
    isNew: true,
    preview: "gradient-3",
    format: "HTML",
  },
  {
    id: "portfolio-website",
    title: "个人作品集",
    description: "现代化的个人作品集网站模版，展示你的项目和能力",
    category: "网页",
    tags: ["作品集", "个人", "网页"],
    author: "DesignBuddy",
    authorAvatar: "D",
    uses: 6780,
    favorites: 1890,
    rating: 4.7,
    preview: "gradient-4",
    format: "HTML",
  },
  {
    id: "project-proposal",
    title: "项目提案书",
    description: "专业的项目提案书模版，结构清晰，易于编辑",
    category: "文档",
    tags: ["提案", "项目", "文档"],
    author: "DesignBuddy",
    authorAvatar: "D",
    uses: 4520,
    favorites: 1230,
    rating: 4.6,
    preview: "gradient-5",
    format: "DOCX",
  },
  {
    id: "social-media-kit",
    title: "社交媒体素材包",
    description: "一套完整的社交媒体图片素材，包含多种尺寸和风格",
    category: "图片",
    tags: ["社交媒体", "图片", "素材"],
    author: "DesignBuddy",
    authorAvatar: "D",
    uses: 9870,
    favorites: 2670,
    rating: 4.8,
    isNew: true,
    preview: "gradient-6",
    format: "PNG/SVG",
  },
];

const categories: { label: string; icon?: HomeIconName }[] = [
  { label: "全部", icon: "grid" },
  { label: "幻灯片", icon: "slides" },
  { label: "文档", icon: "document" },
  { label: "网页", icon: "code" },
  { label: "图片", icon: "palette" },
];

const tags = ["商务", "演示", "数据", "营销", "作品集", "社交媒体", "报告", "项目"];

export default function EnhancedInspirationPage({ projectCount, workspaceCount, assetCount, go, setNotice }: {
  projectCount: number;
  workspaceCount: number;
  assetCount: number;
  go: (path: string) => void;
  setNotice: (text: string) => void;
}) {
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const filteredTemplates = useMemo(() => {
    return mockTemplates.filter((template) => {
      // Category filter
      if (selectedCategory !== "全部" && template.category !== selectedCategory) {
        return false;
      }

      // Tag filter
      if (selectedTags.length > 0 && !selectedTags.some((tag) => template.tags.includes(tag))) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          template.title.toLowerCase().includes(query) ||
          template.description.toLowerCase().includes(query) ||
          template.tags.some((tag) => tag.toLowerCase().includes(query))
        );
      }

      // Favorites filter
      if (showFavoritesOnly && !favorites.has(template.id)) {
        return false;
      }

      return true;
    });
  }, [selectedCategory, selectedTags, searchQuery, showFavoritesOnly, favorites]);

  const featuredTemplates = mockTemplates.filter((t) => t.isFeatured);
  const hotTemplates = mockTemplates.filter((t) => t.isHot);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const formatNumber = (num: number) => {
    if (num >= 10000) {
      return `${(num / 10000).toFixed(1)}w`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}k`;
    }
    return num.toString();
  };

  return (
    <div className="workbuddy-app">
      <WorkBuddySidebar
        active="templates"
        projectCount={projectCount}
        workspaceCount={workspaceCount}
        assetCount={assetCount}
        go={go}
        setNotice={setNotice}
      />

      <main className="inspiration-enhanced">
        {/* Hero Section */}
        <section className="inspiration-hero">
          <h1>探索精美模版</h1>
          <p>从商务演示到数据分析，从网页设计到社交媒体，找到适合你的完美模版</p>
          <div className="inspiration-stats">
            <div className="inspiration-stat">
              <span className="inspiration-stat-value">{mockTemplates.length}+</span>
              <span className="inspiration-stat-label">精品模版</span>
            </div>
            <div className="inspiration-stat">
              <span className="inspiration-stat-value">
                {formatNumber(mockTemplates.reduce((sum, t) => sum + t.uses, 0))}
              </span>
              <span className="inspiration-stat-label">使用次数</span>
            </div>
            <div className="inspiration-stat">
              <span className="inspiration-stat-value">4.8</span>
              <span className="inspiration-stat-label">平均评分</span>
            </div>
          </div>
        </section>

        <div className="inspiration-content">
          {/* Featured Templates */}
          {featuredTemplates.length > 0 && (
            <section className="inspiration-featured">
              <div className="inspiration-section-header">
                <h2>⭐ 精选推荐</h2>
                <button>
                  查看全部
                  <HomeIcon name="chevron" size={14} />
                </button>
              </div>
              <div className="inspiration-featured-grid">
                {featuredTemplates.slice(0, 3).map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    isFavorite={favorites.has(template.id)}
                    onToggleFavorite={toggleFavorite}
                    onUse={() => navigateTo("/")}
                    formatNumber={formatNumber}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Filters */}
          <div className="inspiration-filters">
            <div className="inspiration-filter-row">
              {categories.map(({ label, icon }) => (
                <button
                  key={label}
                  className={`inspiration-filter-chip ${selectedCategory === label ? "is-active" : ""}`}
                  onClick={() => setSelectedCategory(label)}
                >
                  {icon && <HomeIcon name={icon} size={14} />}
                  {label}
                </button>
              ))}
            </div>
            <div className="inspiration-filter-row">
              <div className="inspiration-search">
                <HomeIcon name="search" size={16} />
                <input
                  type="text"
                  placeholder="搜索模版、标签或关键词..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button
                className={`inspiration-filter-chip ${showFavoritesOnly ? "is-active" : ""}`}
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              >
                ❤️ 我的收藏
              </button>
            </div>
            <div className="inspiration-filter-row">
              {tags.map((tag) => (
                <button
                  key={tag}
                  className={`inspiration-filter-chip ${selectedTags.includes(tag) ? "is-active" : ""}`}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Template Grid */}
          <div className="inspiration-grid">
            {filteredTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                isFavorite={favorites.has(template.id)}
                onToggleFavorite={toggleFavorite}
                onUse={() => navigateTo("/")}
                formatNumber={formatNumber}
              />
            ))}
          </div>

          {filteredTemplates.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <HomeIcon name="search" size={64} />
              <h2 style={{ fontSize: "24px", color: "#374151", marginTop: "16px" }}>
                没有找到匹配的模版
              </h2>
              <p style={{ color: "#6b7280", marginTop: "8px" }}>
                尝试调整筛选条件或搜索其他关键词
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function TemplateCard({
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

  return (
    <article className="inspiration-card">
      <div
        className="inspiration-card-preview"
        style={{ background: gradients[template.preview] }}
        onClick={onUse}
      >
        <button
          className={`inspiration-card-favorite ${isFavorite ? "is-favorite" : ""}`}
          onClick={(e) => {
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
          使用此模版
        </button>
      </div>
    </article>
  );
}
