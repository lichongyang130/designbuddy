export interface LivePreviewProps {
  title: string;
  src?: string;
  srcDoc?: string;
  className?: string;
}

export function LivePreview({ title, src, srcDoc, className = "" }: LivePreviewProps) {
  if (!src && !srcDoc) return <div className={`workspace-preview-empty ${className}`}>预览内容尚未生成。</div>;
  return <iframe className={className} title={title} sandbox="allow-scripts" referrerPolicy="no-referrer" src={src} srcDoc={srcDoc} />;
}
