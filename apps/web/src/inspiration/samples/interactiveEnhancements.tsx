/**
 * 模版交互增强组件
 * 为所有模版添加高级交互功能
 */

import { useState, useEffect, useCallback } from 'react';
import { download } from './shared';

interface InteractiveEnhancementProps {
  templateId: string;
  templateTitle: string;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  state: any;
  onStateChange: (state: any) => void;
}

/**
 * 键盘快捷键 Hook
 */
export function useKeyboardShortcuts(
  currentPage: number,
  totalPages: number,
  onPageChange: (page: number) => void
) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 左右箭头键导航
      if (e.key === 'ArrowLeft' && currentPage > 0) {
        e.preventDefault();
        onPageChange(currentPage - 1);
      } else if (e.key === 'ArrowRight' && currentPage < totalPages - 1) {
        e.preventDefault();
        onPageChange(currentPage + 1);
      }
      // Home/End 键跳到首尾
      else if (e.key === 'Home') {
        e.preventDefault();
        onPageChange(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        onPageChange(totalPages - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages, onPageChange]);
}

/**
 * 页面过渡动画 Hook
 */
export function usePageTransition(currentPage: number) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [direction, setDirection] = useState<'left' | 'right'>('right');

  useEffect(() => {
    setIsTransitioning(true);
    const timer = setTimeout(() => setIsTransitioning(false), 300);
    return () => clearTimeout(timer);
  }, [currentPage]);

  return { isTransitioning, direction, setDirection };
}

/**
 * 数据导出功能
 */
export function useExportData(templateId: string, state: any) {
  const exportAsJSON = useCallback(() => {
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    download(blob, `${templateId}-data.json`);
  }, [templateId, state]);

  const exportAsCSV = useCallback(() => {
    if (!state || typeof state !== 'object') return;
    
    const rows = Object.entries(state).map(([key, value]) => {
      const val = typeof value === 'object' ? JSON.stringify(value) : String(value);
      return `${key},${val}`;
    });
    
    const csv = ['Key,Value', ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    download(blob, `${templateId}-data.csv`);
  }, [templateId, state]);

  const exportAsMarkdown = useCallback(() => {
    if (!state || typeof state !== 'object') return;
    
    const lines = [
      `# ${templateId} 数据导出`,
      '',
      '## 状态数据',
      '',
      ...Object.entries(state).map(([key, value]) => {
        const val = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
        return `### ${key}\n\n${val}\n`;
      }),
    ];
    
    const md = lines.join('\n');
    const blob = new Blob([md], { type: 'text/markdown' });
    download(blob, `${templateId}-data.md`);
  }, [templateId, state]);

  return { exportAsJSON, exportAsCSV, exportAsMarkdown };
}

/**
 * 数据导入功能
 */
export function useImportData(onStateChange: (state: any) => void) {
  const importFromJSON = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const text = await file.text();
      try {
        const data = JSON.parse(text);
        onStateChange(data);
        alert('数据导入成功！');
      } catch (err) {
        alert('导入失败：无效的 JSON 文件');
      }
    };
    
    input.click();
  }, [onStateChange]);

  return { importFromJSON };
}

/**
 * 分享功能
 */
export function useShare(templateId: string, templateTitle: string) {
  const shareUrl = useCallback(async () => {
    const url = `${window.location.origin}/inspiration/${templateId}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: templateTitle,
          text: `查看这个精彩的模版：${templateTitle}`,
          url: url,
        });
      } catch (err) {
        // 用户取消分享
      }
    } else {
      // 回退到复制链接
      await navigator.clipboard.writeText(url);
      alert('链接已复制到剪贴板！');
    }
  }, [templateId, templateTitle]);

  return { shareUrl };
}

/**
 * 打印功能
 */
export function usePrint() {
  const printPage = useCallback(() => {
    window.print();
  }, []);

  return { printPage };
}

/**
 * 全屏查看功能
 */
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return { isFullscreen, toggleFullscreen };
}

/**
 * 页面书签功能
 */
export function useBookmarks(templateId: string, totalPages: number) {
  const [bookmarks, setBookmarks] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem(`bookmarks-${templateId}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const toggleBookmark = useCallback((page: number) => {
    setBookmarks((prev) => {
      const next = prev.includes(page)
        ? prev.filter((p) => p !== page)
        : [...prev, page];
      
      localStorage.setItem(`bookmarks-${templateId}`, JSON.stringify(next));
      return next;
    });
  }, [templateId]);

  const isBookmarked = useCallback((page: number) => {
    return bookmarks.includes(page);
  }, [bookmarks]);

  return { bookmarks, toggleBookmark, isBookmarked };
}

/**
 * 页面笔记功能
 */
export function usePageNotes(templateId: string) {
  const [notes, setNotes] = useState<Record<number, string>>(() => {
    try {
      const saved = localStorage.getItem(`notes-${templateId}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const setNote = useCallback((page: number, note: string) => {
    setNotes((prev) => {
      const next = { ...prev, [page]: note };
      localStorage.setItem(`notes-${templateId}`, JSON.stringify(next));
      return next;
    });
  }, [templateId]);

  const getNote = useCallback((page: number) => {
    return notes[page] || '';
  }, [notes]);

  return { notes, setNote, getNote };
}

/**
 * 交互式工具栏组件
 */
export function InteractiveToolbar({
  templateId,
  templateTitle,
  currentPage,
  totalPages,
  state,
  onStateChange,
}: Omit<InteractiveEnhancementProps, 'onPageChange'>) {
  const { exportAsJSON, exportAsCSV, exportAsMarkdown } = useExportData(templateId, state);
  const { importFromJSON } = useImportData(onStateChange);
  const { shareUrl } = useShare(templateId, templateTitle);
  const { printPage } = usePrint();
  const { isFullscreen, toggleFullscreen } = useFullscreen();
  const { bookmarks, toggleBookmark, isBookmarked } = useBookmarks(templateId, totalPages);
  const { notes, setNote, getNote } = usePageNotes(templateId);
  const [showNotes, setShowNotes] = useState(false);
  const [currentNote, setCurrentNote] = useState(getNote(currentPage));

  useEffect(() => {
    setCurrentNote(getNote(currentPage));
  }, [currentPage, getNote]);

  const handleNoteSave = () => {
    setNote(currentPage, currentNote);
    setShowNotes(false);
  };

  return (
    <div className="interactive-toolbar">
      <div className="toolbar-section">
        <button
          onClick={() => toggleBookmark(currentPage)}
          title={isBookmarked(currentPage) ? '移除书签' : '添加书签'}
          className={isBookmarked(currentPage) ? 'active' : ''}
        >
          🔖 {isBookmarked(currentPage) ? '已书签' : '书签'}
        </button>
        <button onClick={() => setShowNotes(!showNotes)} title="页面笔记">
          📝 笔记
        </button>
        <button onClick={printPage} title="打印页面">
          🖨️ 打印
        </button>
        <button onClick={toggleFullscreen} title="全屏查看">
          {isFullscreen ? '🗗 退出全屏' : '🗖 全屏'}
        </button>
      </div>

      <div className="toolbar-section">
        <div className="toolbar-dropdown">
          <button>📤 导出</button>
          <div className="dropdown-menu">
            <button onClick={exportAsJSON}>导出为 JSON</button>
            <button onClick={exportAsCSV}>导出为 CSV</button>
            <button onClick={exportAsMarkdown}>导出为 Markdown</button>
          </div>
        </div>
        <button onClick={importFromJSON} title="导入数据">
          📥 导入
        </button>
        <button onClick={shareUrl} title="分享模版">
          🔗 分享
        </button>
      </div>

      {bookmarks.length > 0 && (
        <div className="toolbar-section">
          <span className="toolbar-label">书签：</span>
          {bookmarks.map((page) => (
            <button
              key={page}
              onClick={() => {/* 跳转到书签页面 */}}
              className="bookmark-chip"
            >
              {page + 1}
            </button>
          ))}
        </div>
      )}

      {showNotes && (
        <div className="notes-panel">
          <h3>页面 {currentPage + 1} 笔记</h3>
          <textarea
            value={currentNote}
            onChange={(e) => setCurrentNote(e.target.value)}
            placeholder="在这里添加你的笔记..."
            rows={5}
          />
          <div className="notes-actions">
            <button onClick={handleNoteSave}>保存</button>
            <button onClick={() => setShowNotes(false)}>取消</button>
          </div>
        </div>
      )}

      <style>{`
        .interactive-toolbar {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
          padding: 12px 16px;
          display: flex;
          gap: 12px;
          align-items: center;
          z-index: 1000;
          max-width: 90vw;
          flex-wrap: wrap;
        }

        .toolbar-section {
          display: flex;
          gap: 8px;
          align-items: center;
          padding: 0 8px;
          border-right: 1px solid #e5e7eb;
        }

        .toolbar-section:last-child {
          border-right: none;
        }

        .toolbar-label {
          font-size: 12px;
          color: #6b7280;
          font-weight: 600;
        }

        .interactive-toolbar button {
          padding: 8px 12px;
          border: 1px solid #e5e7eb;
          background: white;
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .interactive-toolbar button:hover {
          background: #f9fafb;
          border-color: #d1d5db;
        }

        .interactive-toolbar button.active {
          background: #667eea;
          color: white;
          border-color: #667eea;
        }

        .bookmark-chip {
          padding: 4px 10px;
          font-size: 12px;
          background: #fef3c7;
          border-color: #fbbf24;
        }

        .toolbar-dropdown {
          position: relative;
        }

        .dropdown-menu {
          display: none;
          position: absolute;
          bottom: 100%;
          left: 0;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          padding: 4px;
          min-width: 160px;
          margin-bottom: 8px;
        }

        .toolbar-dropdown:hover .dropdown-menu {
          display: block;
        }

        .dropdown-menu button {
          width: 100%;
          text-align: left;
          border: none;
          background: transparent;
          padding: 8px 12px;
        }

        .dropdown-menu button:hover {
          background: #f3f4f6;
        }

        .notes-panel {
          position: fixed;
          bottom: 80px;
          left: 50%;
          transform: translateX(-50%);
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
          padding: 20px;
          width: 400px;
          max-width: 90vw;
          z-index: 1001;
        }

        .notes-panel h3 {
          margin: 0 0 12px 0;
          font-size: 16px;
        }

        .notes-panel textarea {
          width: 100%;
          padding: 12px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-family: inherit;
          font-size: 14px;
          resize: vertical;
        }

        .notes-actions {
          display: flex;
          gap: 8px;
          margin-top: 12px;
          justify-content: flex-end;
        }

        .notes-actions button {
          padding: 8px 16px;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          background: white;
          cursor: pointer;
        }

        .notes-actions button:first-child {
          background: #667eea;
          color: white;
          border-color: #667eea;
        }

        @media (max-width: 768px) {
          .interactive-toolbar {
            bottom: 10px;
            padding: 8px 12px;
            font-size: 12px;
          }

          .interactive-toolbar button {
            padding: 6px 10px;
            font-size: 12px;
          }
        }

        @media print {
          .interactive-toolbar {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
