import { useState } from "react";
import DeviceFrame, { type PreviewDevice } from "./DeviceFrame";
import ErrorOverlay from "./ErrorOverlay";
import PreviewToolbar from "./PreviewToolbar";
import { usePreviewSession, type PreviewFile, type PreviewFramework } from "./usePreviewSession";

export interface PreviewPanelProps {
  projectId: string;
  files: PreviewFile[];
  framework?: PreviewFramework;
  apiBase?: string;
  initialSessionId?: string;
  className?: string;
}

export default function PreviewPanel({
  projectId,
  files,
  framework = "react-vite",
  apiBase,
  initialSessionId,
  className
}: PreviewPanelProps) {
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const preview = usePreviewSession({
    projectId,
    files,
    framework,
    ...(apiBase ? { apiBase } : {}),
    ...(initialSessionId ? { initialSessionId } : {})
  });

  const active = preview.status === "ready" || preview.status === "degraded";

  return (
    <section className={["preview-panel", className].filter(Boolean).join(" ")} aria-label="实时预览">
      <header className="preview-panel-header">
        <div>
          <p className="preview-eyebrow">DESIGNBUDDY / PREVIEW</p>
          <h2>实时预览</h2>
          <p className="preview-panel-subtitle">
            在桌面、平板和手机视口中检查生成的页面。
          </p>
        </div>
        {preview.session && (
          <div className="preview-session-meta">
            <span>版本 v{preview.session.version}</span>
            <span className="preview-session-id" title={preview.session.id}>
              {preview.session.id}
            </span>
          </div>
        )}
      </header>

      <PreviewToolbar
        status={preview.status}
        device={device}
        busy={preview.busy}
        hasFiles={files.length > 0}
        onDeviceChange={setDevice}
        onStart={() => { void preview.start(); }}
        onUpdate={() => { void preview.update(); }}
        onStop={() => { void preview.stop(); }}
        onRefresh={() => {
          preview.refresh();
          if (preview.session) void preview.checkHealth();
        }}
        onHealthCheck={() => { void preview.checkHealth(); }}
      />

      {preview.message && (
        <div className="preview-message" role="alert">
          <span>{preview.message}</span>
          <button type="button" aria-label="关闭消息" onClick={preview.clearMessage}>×</button>
        </div>
      )}

      {preview.lastEvent?.type === "files-updated" && (
        <div className="preview-live-indicator" role="status">
          <span aria-hidden="true" />
          已同步到版本 v{preview.lastEvent.version}
        </div>
      )}

      <div className="preview-canvas">
        {active && preview.session?.previewUrl ? (
          <DeviceFrame
            url={preview.session.previewUrl}
            device={device}
            refreshKey={preview.refreshKey}
            title={projectId + " 应用预览"}
          />
        ) : (
          <DeviceFrame device={device} refreshKey={preview.refreshKey} />
        )}
      </div>

      <ErrorOverlay errors={preview.errors} onDismiss={preview.dismissErrors} />

      <footer className="preview-panel-footer">
        <span>
          {files.length} 个源文件{preview.session ? ` · 项目 ${preview.session.projectId}` : ""}
        </span>
        {preview.session?.previewUrl && active && (
          <a href={preview.session.previewUrl} target="_blank" rel="noopener noreferrer">
            在新标签页打开 ↗
          </a>
        )}
      </footer>
    </section>
  );
}
