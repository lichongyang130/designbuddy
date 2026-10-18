import type { CSSProperties } from "react";

export type PreviewDevice = "desktop" | "tablet" | "mobile";

export interface DeviceFrameProps {
  url?: string;
  device: PreviewDevice;
  refreshKey?: number;
  title?: string;
}

const WIDTHS: Record<PreviewDevice, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "390px"
};

export default function DeviceFrame({
  url,
  device,
  refreshKey = 0,
  title = "Generated application preview"
}: DeviceFrameProps) {
  const style: CSSProperties = {
    width: WIDTHS[device],
    maxWidth: "100%"
  };

  if (!url) {
    return (
      <div className="preview-empty" role="status">
        <div className="preview-empty-icon" aria-hidden="true">▱</div>
        <h3>预览画布已就绪</h3>
        <p>启动预览后，生成的应用会显示在这里。</p>
      </div>
    );
  }

  return (
    <div className={`preview-device preview-device--${device}`} style={style}>
      <div className="preview-device-chrome" aria-hidden="true">
        <span />
        <span />
        <span />
        <small>{new URL(url).host}</small>
      </div>
      <iframe
        key={refreshKey}
        className="preview-iframe"
        src={url}
        title={title}
        loading="lazy"
        referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-forms allow-downloads"
      />
    </div>
  );
}
