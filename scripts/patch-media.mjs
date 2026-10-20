import fs from 'fs';
const file = 'apps/web/src/inspiration/samples/MediaExamples.tsx';
let content = fs.readFileSync(file, 'utf-8');

// Patch Shell
content = content.replace(
  'function Shell({',
  `function Shell({
  id,
  draftId,
  state,
  error,
  children,
  actions,
  titleOverride,
  typeOverride,
  provenanceOverride,
}: {
  id: string;
  draftId?: string;
  state: unknown;
  error: string;
  children: ReactNode;
  actions?: ReactNode;
  titleOverride?: string;
  typeOverride?: string;
  provenanceOverride?: ReactNode;
}) {
  const [notice, setNotice] = useState("");
  const titleStr = titleOverride || (titles as any)[id] || "Untitled";
  const typeStr = typeOverride || (types as any)[id] || "Template";
  const cssClass = id.startsWith('vid') ? 'film' : id.startsWith('aud') ? 'sound' : id;
  return (
    <main className={\`media-work media-\${cssClass}\`}>
      <SampleTop
        type={typeStr}
        title={titleStr}
        draftId={draftId}
        onCopy={() => {
          try {
            copySample(id as SampleId, state);
          } catch {
            setNotice("副本保存失败，请先下载作品并检查浏览器存储。");
          }
        }}
      >
        {actions}
      </SampleTop>
      <Notice text={error || notice} />
      {children}
      <footer className="media-provenance">
        <strong>关于这个样板</strong>
        {provenanceOverride ? provenanceOverride : id === "film" || id.startsWith("vid") ? (
          <p>
            由 AI 概念摄影剪辑为真实
            MP4，无声，不是实地拍摄。字幕可以编辑，下载原片不会改变原片画面。
          </p>
        ) : id === "sound" || id.startsWith("aud") ? (
          <p>
            原创程序合成音序，无人声、无外部采样。节奏、明亮度与音量会改变实际音频；不连接音乐或语音生成服务。
          </p>
        ) : id === "hyperframes" ? (
          <p>
            此栏目展示可独立运行的 HTML / CSS 动效分镜，不声称已集成某个第三方
            HyperFrames 引擎。导出为动画网页，不是视频文件。
          </p>
        ) : id === "live" ? (
          <p>
            输入即时驱动本地计算。这是报价草案，不是实时市场价格，也不会创建合同、支付或发送报价。
          </p>
        ) : (
          <p>
            实际使用原生 WebGL
            绘制几何体，不是三维效果截图。未连接商业建模服务；不支持 WebGL
            的设备会显示明确提示。
          </p>
        )}
        <small>
          参数默认在当前浏览器自动保存；可用顶部按钮手动备份到服务器。无自动播放或外部发布。请在清理网站数据前保留备份。
        </small>
      </footer>
    </main>
  );
}

// Ignore original Shell definition
function OldShell_Ignored(`
);

// We need to properly replace `function Shell` up to `return` or just use regex. Let's do it safely.
