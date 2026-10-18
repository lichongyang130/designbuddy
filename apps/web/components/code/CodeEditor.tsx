import { useState } from 'react';

export interface CodeEditorProps {
  value?: string;
  language?: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
}

export default function CodeEditor({ value = '', language = 'typescript', readOnly = false, onChange }: CodeEditorProps) {
  const [internalValue, setInternalValue] = useState(value);
  const controlled = onChange !== undefined;
  const currentValue = controlled ? value : internalValue;

  function update(next: string) {
    if (!controlled) setInternalValue(next);
    onChange?.(next);
  }

  return (
    <section className="code-editor" aria-label="代码编辑器">
      <div className="code-editor__toolbar">
        <label htmlFor="code-editor-language">语言</label>
        <span id="code-editor-language">{language}</span>
        <span>{readOnly ? '只读' : '可编辑'}</span>
        <span>{currentValue.split('\n').length} 行</span>
      </div>
      <textarea
        className="code-editor__input"
        aria-label={`${language} 源码`}
        value={currentValue}
        onChange={(event) => update(event.target.value)}
        readOnly={readOnly}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
      />
    </section>
  );
}
