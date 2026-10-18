import type { ChangeEvent } from "react";

export interface CodePreviewProps {
  path: string;
  language: string;
  code: string;
  onChange?(value: string): void;
}

export function CodePreview({ path, language, code, onChange }: CodePreviewProps) {
  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => onChange?.(event.currentTarget.value);
  return (
    <>
      <div className="db-code-file-header"><span>{path}</span><span>{language}</span></div>
      {onChange ? <textarea value={code} onChange={handleChange} spellCheck={false} autoCapitalize="off" autoComplete="off" autoCorrect="off" aria-label={`${path} 源码`} /> : <pre className="workspace-code-readonly"><code>{code}</code></pre>}
    </>
  );
}
