import { useMemo, useState } from "react";
import type { ProjectFile } from "./models/project";
import { LivePreview } from "./LivePreview";
import { buildPreviewDocument, hasPreviewablePage } from "./previewDocument";
import "./preview-side-panel.css";

export type PreviewSideDevice = "desktop" | "tablet" | "mobile";

export interface PreviewSidePanelProps {
  title?: string;
  subtitle?: string;
  files: ProjectFile[];
  /** Short label describing where the previewed files come from. */
  sourceLabel?: string;
  emptyTitle?: string;
  emptyHint?: string;
  onOpenInEditor?: () => void;
  openInEditorLabel?: string;
  onClose?: () => void;
  className?: string;
}

const DEVICES: Array<{ value: PreviewSideDevice; label: string; glyph: string }> = [
  { value: "desktop", label: "桌面", glyph: "▰" },
  { value: "tablet", label: "平板", glyph: "▯" },
  { value: "mobile", label: "手机", glyph: "▏" },
];

/**
 * Right-hand live preview panel.
 *
 * It renders the current project files in a sandboxed iframe, so it works without
 * a build step, a preview worker or any network access. Callers own the
 * visibility of the panel; this component only renders the preview surface.
 */
export function PreviewSidePanel({
  title = "实时预览",
  subtitle,
  files,
  sourceLabel,
  emptyTitle = "还没有可预览的网页",
  emptyHint = "这个任务还没有生成网页文件；生成后可以在这里直接查看效果。",
  onOpenInEditor,
  openInEditorLabel = "打开编辑器",
  onClose,
  className
}: PreviewSidePanelProps) {
  const [device, setDevice] = useState<PreviewSideDevice>("desktop");
  const [refreshKey, setRefreshKey] = useState(0);
  const previewable = hasPreviewablePage(files);
  const document = useMemo(() => buildPreviewDocument(files, false), [files]);

  return (
    <aside
      className={["preview-side-panel", className].filter(Boolean).join(" ")}
      aria-label="实时预览"
    >
      <header className="preview-side-header">
        <div>
          <p className="preview-side-eyebrow">DESIGNBUDDY / PREVIEW</p>
          <h2>{title}</h2>
          {subtitle && <p className="preview-side-subtitle">{subtitle}</p>}
        </div>
        {onClose && (
          <button type="button" className="preview-side-close" aria-label="关闭预览" onClick={onClose}>
            ×
          </button>
        )}
      </header>

      <div className="preview-side-toolbar" role="toolbar" aria-label="预览控制">
        <div className="preview-side-devices" role="group" aria-label="设备尺寸">
          {DEVICES.map((option) => (
            <button
              key={option.value}
              type="button"
              className={device === option.value ? "is-active" : ""}
              aria-pressed={device === option.value}
              title={option.label}
              onClick={() => setDevice(option.value)}
            >
              <span aria-hidden="true">{option.glyph}</span>
              <span className="preview-side-device-label">{option.label}</span>
            </button>
          ))}
        </div>
        <div className="preview-side-actions">
          <button type="button" onClick={() => setRefreshKey((value) => value + 1)} disabled={!previewable}>
            刷新
          </button>
          {onOpenInEditor && (
            <button type="button" onClick={onOpenInEditor}>
              {openInEditorLabel}
            </button>
          )}
        </div>
      </div>

      <div className="preview-side-canvas">
        {previewable ? (
          <div className={`preview-side-frame preview-side-frame-${device}`}>
            <LivePreview key={refreshKey} title={`${title} 画布`} srcDoc={document} />
          </div>
        ) : (
          <div className="preview-side-empty" role="status">
            <span className="preview-side-empty-icon" aria-hidden="true">▱</span>
            <strong>{emptyTitle}</strong>
            <p>{emptyHint}</p>
          </div>
        )}
      </div>

      <footer className="preview-side-footer">
        <span>沙盒预览 · 不会访问项目之外的本机文件</span>
        <span>
          {files.length} 个源文件
          {sourceLabel ? ` · ${sourceLabel}` : ""}
        </span>
      </footer>
    </aside>
  );
}
