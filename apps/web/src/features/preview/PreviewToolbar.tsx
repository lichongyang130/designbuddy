import type { PreviewDevice } from "./DeviceFrame";
import type { PreviewStatus } from "./usePreviewSession";

export interface PreviewToolbarProps {
  status: PreviewStatus;
  device: PreviewDevice;
  busy?: boolean;
  hasFiles?: boolean;
  onDeviceChange: (device: PreviewDevice) => void;
  onStart: () => void;
  onUpdate: () => void;
  onStop: () => void;
  onRefresh: () => void;
  onHealthCheck: () => void;
}

const DEVICE_OPTIONS: Array<{ value: PreviewDevice; label: string; icon: string }> = [
  { value: "desktop", label: "桌面", icon: "▰" },
  { value: "tablet", label: "平板", icon: "▯" },
  { value: "mobile", label: "手机", icon: "▯" }
];

const STATUS_LABELS: Record<PreviewStatus, string> = {
  idle: "未启动",
  starting: "启动中",
  ready: "运行正常",
  degraded: "运行异常",
  stopped: "已停止",
  failed: "启动失败"
};

export default function PreviewToolbar({
  status,
  device,
  busy = false,
  hasFiles = false,
  onDeviceChange,
  onStart,
  onUpdate,
  onStop,
  onRefresh,
  onHealthCheck
}: PreviewToolbarProps) {
  const active = status === "ready" || status === "degraded";

  return (
    <div className="preview-toolbar" role="toolbar" aria-label="预览控制">
      <div className="preview-toolbar-status">
        <span className={`preview-status-dot preview-status-dot--${status}`} aria-hidden="true" />
        <span>{STATUS_LABELS[status]}</span>
        {busy && <span className="preview-toolbar-progress">处理中…</span>}
      </div>

      <div className="preview-device-switch" role="group" aria-label="设备尺寸">
        {DEVICE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`preview-icon-button ${device === option.value ? "is-active" : ""}`}
            aria-pressed={device === option.value}
            title={option.label}
            onClick={() => onDeviceChange(option.value)}
          >
            <span aria-hidden="true">{option.icon}</span>
            <span className="preview-device-label">{option.label}</span>
          </button>
        ))}
      </div>

      <div className="preview-toolbar-actions">
        {active ? (
          <>
            <button type="button" className="preview-button preview-button--subtle" onClick={onHealthCheck} disabled={busy}>
              检查状态
            </button>
            <button type="button" className="preview-button preview-button--subtle" onClick={onRefresh} disabled={busy}>
              刷新
            </button>
            <button type="button" className="preview-button preview-button--primary" onClick={onUpdate} disabled={busy || !hasFiles}>
              更新预览
            </button>
            <button type="button" className="preview-button preview-button--danger" onClick={onStop} disabled={busy}>
              停止
            </button>
          </>
        ) : (
          <button type="button" className="preview-button preview-button--primary" onClick={onStart} disabled={busy || !hasFiles}>
            {status === "starting" ? "启动中…" : "启动预览"}
          </button>
        )}
      </div>
    </div>
  );
}
