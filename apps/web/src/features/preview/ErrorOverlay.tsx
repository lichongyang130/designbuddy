import type { PreviewRuntimeError } from "./usePreviewSession";

export interface ErrorOverlayProps {
  errors: PreviewRuntimeError[];
  onDismiss?: () => void;
}

export default function ErrorOverlay({ errors, onDismiss }: ErrorOverlayProps) {
  if (errors.length === 0) return null;

  return (
    <section className="preview-error-overlay" role="region" aria-label="预览运行错误">
      <div className="preview-error-heading">
        <div>
          <strong>预览运行错误</strong>
          <span>{errors.length} 条</span>
        </div>
        {onDismiss && (
          <button type="button" className="preview-text-button" onClick={onDismiss}>
            收起
          </button>
        )}
      </div>
      <ul className="preview-error-list">
        {errors.map((error) => (
          <li key={error.id} className="preview-error-item">
            <div className="preview-error-title">
              <strong>{error.name}</strong>
              {error.count > 1 && <span>重复 {error.count} 次</span>}
            </div>
            <p>{error.message}</p>
            {error.source && <code>{error.source}</code>}
            <time dateTime={new Date(error.timestamp).toISOString()}>
              {new Date(error.timestamp).toLocaleTimeString()}
            </time>
          </li>
        ))}
      </ul>
    </section>
  );
}
