import ReactMarkdown from "react-markdown";
import { usePreferences } from "../../../../frontend/workspace/settingsStore";

/** Render assistant Markdown without raw HTML, executable URLs or remote image requests. */
export function TaskMarkdown({ content }: { content: string }) {
  const linkMode = usePreferences((state) => state.linkMode);
  return (
    <ReactMarkdown
      components={{
        a: ({ children, href }) => (
          <a
            href={href}
            target={
              linkMode === "same-tab" ||
              (linkMode === "smart" && isSameOrigin(href))
                ? "_self"
                : "_blank"
            }
            rel="noopener noreferrer"
          >
            {children}
          </a>
        ),
        img: ({ alt }) => <span>{alt ? `[图片：${alt}]` : "[图片]"}</span>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function isSameOrigin(href?: string) {
  if (!href) return false;
  try {
    return (
      new URL(href, window.location.href).origin === window.location.origin
    );
  } catch {
    return false;
  }
}
