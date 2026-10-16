import { useLayoutEffect, useRef, type KeyboardEvent } from "react";

export interface PromptInputProps {
  value: string;
  onChange(value: string): void;
  onSubmit?(): void;
  placeholder?: string;
  rows?: number;
  ariaLabel?: string;
  /** Opt in only where the composer is allowed to grow with the whole draft. */
  autoResize?: boolean;
}

export function PromptInput({ value, onChange, onSubmit, placeholder, rows = 3, ariaLabel, autoResize = false }: PromptInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input || !autoResize) return;
    let active = true;
    let width = input.getBoundingClientRect().width;
    const resize = () => {
      if (!active) return;
      // Reset first so deleting text can shrink the input as well as grow it.
      input.style.height = "auto";
      const style = getComputedStyle(input);
      const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const border = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
      const height = input.scrollHeight + (style.boxSizing === "border-box" ? border : -padding);
      input.style.height = `${Math.ceil(height)}px`;
      input.scrollTop = 0;
    };
    resize();
    // Height changes are ours; observe only width changes to avoid a resize loop.
    const observer = new ResizeObserver(() => {
      const nextWidth = input.getBoundingClientRect().width;
      if (nextWidth !== width) { width = nextWidth; resize(); }
    });
    observer.observe(input);
    window.addEventListener("resize", resize);
    document.fonts?.addEventListener("loadingdone", resize);
    void document.fonts?.ready.then(() => { if (active) resize(); });
    return () => {
      active = false;
      observer.disconnect();
      window.removeEventListener("resize", resize);
      document.fonts?.removeEventListener("loadingdone", resize);
      input.style.removeProperty("height");
    };
  }, [value, rows, autoResize]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229 && onSubmit) {
      event.preventDefault();
      onSubmit();
    }
  };

  return (
    <textarea
      ref={inputRef}
      data-auto-resize={autoResize || undefined}
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      rows={rows}
      aria-label={ariaLabel}
    />
  );
}
