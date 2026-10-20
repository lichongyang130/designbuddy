import { useState, useMemo, useEffect, useRef } from "react";
import { HomeIcon, type HomeIconName } from "../components/HomeIcon";
import { navigateTo } from "../../../../frontend/workspace/workspaceRoutes";
import { WorkBuddySidebar } from "../components/WorkBuddySidebar";
import { listProjects } from "../../../../frontend/workspace/projectStore";
import { samples } from "./samples/shared";
import "./inspiration-enhanced.css";

import TemplateCard, { type Template } from "./TemplateCard";

// --- Mock API Layer ---
async function fetchTemplatesApi(): Promise<Template[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(
        samples.map((s, i) => ({
          id: s.id,
          title: s.title,
          description: s.description,
          category: s.category,
          tags: [s.category, "DesignBuddy", "推荐"], // default tags
          author: "DesignBuddy",
          authorAvatar: "D",
          uses: Math.floor(Math.random() * 10000) + 500,
          favorites: Math.floor(Math.random() * 2000) + 100,
          rating: parseFloat((Math.random() * 1 + 4).toFixed(1)), // 4.0 to 5.0
          isFeatured: i % 7 === 0,
          isHot: i % 5 === 0,
          isNew: i % 8 === 0,
          preview: s.photos && s.photos.length > 0 ? s.photos[0].url : "gradient-1",
          format: s.format,
        }))
      );
    }, 600); // simulated network delay
  });
}
// ----------------------

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
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    fetchTemplatesApi().then((data) => {
      if (mounted) {
        setTemplates(data);
        setIsLoading(false);
      }
    });
    return () => { mounted = false; };
  }, []);

  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("designbuddy.favorites");
      if (stored) {
        return new Set(JSON.parse(stored));
      }
    } catch (e) {
      console.warn("Failed to read favorites from localStorage");
    }
    return new Set();
  });

  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem("designbuddy.favorites", JSON.stringify([...favorites]));
    } catch (e) {
      console.warn("Failed to save favorites to localStorage");
    }
  }, [favorites]);

  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => {
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
  }, [selectedCategory, selectedTags, searchQuery, showFavoritesOnly, favorites, templates]);

  const featuredTemplates = templates.filter((t) => t.isFeatured);
  const hotTemplates = templates.filter((t) => t.isHot);

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
              <span className="inspiration-stat-value">{templates.length}+</span>
              <span className="inspiration-stat-label">精品模版</span>
            </div>
            <div className="inspiration-stat">
              <span className="inspiration-stat-value">
                {formatNumber(templates.reduce((sum, t) => sum + t.uses, 0))}
              </span>
              <span className="inspiration-stat-label">使用次数</span>
            </div>
            <div className="inspiration-stat">
              <span className="inspiration-stat-value">4.8</span>
              <span className="inspiration-stat-label">平均评分</span>
            </div>
          </div>
          <button 
            className="inspiration-upload-btn" 
            onClick={() => setShowUploadModal(true)}
            style={{
              position: 'absolute',
              top: '60px',
              right: '40px',
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.4)',
              color: '#fff',
              padding: '10px 20px',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              gap: '8px',
              alignItems: 'center'
            }}
          >
            <HomeIcon name="installed" size={16} /> 上传模版
          </button>
        </section>

        <div className="inspiration-content">
          {isLoading ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>
              加载模版中...
            </div>
          ) : (
            <>
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
                    onUse={() => navigateTo(`/inspiration/${template.id}/detail`)}
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
          {filteredTemplates.length > 0 && (
            <div className="inspiration-grid">
              {filteredTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  isFavorite={favorites.has(template.id)}
                  onToggleFavorite={toggleFavorite}
                  onUse={() => navigateTo(`/inspiration/${template.id.split('-')[0]}/detail`)}
                  formatNumber={formatNumber}
                />
              ))}
            </div>
          )}

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
            </>
          )}
        </div>
      </main>

      {showUploadModal && (
        <div className="upload-modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="upload-modal-content" style={{
            background: 'white', padding: '32px', borderRadius: '16px',
            width: '100%', maxWidth: '500px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <h2 style={{marginTop: 0, marginBottom: '24px'}}>上传新模版</h2>
            <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
              <label>
                <span style={{display: 'block', marginBottom: '8px', fontWeight: 600}}>模版名称</span>
                <input type="text" placeholder="输入模版名称" style={{width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc'}} />
              </label>
              <label>
                <span style={{display: 'block', marginBottom: '8px', fontWeight: 600}}>模版分类</span>
                <select style={{width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc'}}>
                  <option>原型</option>
                  <option>幻灯片</option>
                  <option>文档</option>
                  <option>网页</option>
                  <option>图片</option>
                </select>
              </label>
              <label>
                <span style={{display: 'block', marginBottom: '8px', fontWeight: 600}}>模版文件 (.zip)</span>
                <input type="file" accept=".zip" style={{width: '100%', padding: '10px', borderRadius: '6px', border: '1px dashed #ccc'}} />
              </label>
            </div>
            <div style={{display: 'flex', gap: '16px', marginTop: '32px', justifyContent: 'flex-end'}}>
              <button 
                onClick={() => setShowUploadModal(false)}
                style={{padding: '10px 20px', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600, color: '#6b7280'}}
              >
                取消
              </button>
              <button 
                onClick={() => {
                  alert("上传功能已准备就绪，待后端 API 接入即可生效！");
                  setShowUploadModal(false);
                }}
                style={{padding: '10px 20px', background: '#667eea', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600}}
              >
                提交上传
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
