import { useEffect, useRef, type KeyboardEvent } from "react";
import { modelOptions as builtInModels } from "../../../../frontend/workspace/taskModels";
import { useModelOptions } from "../../../../frontend/workspace/settingsStore";
import { HomeIcon } from "./HomeIcon";
import "./home-model-menu.css";

/** Compact monochrome marks; SVG avoids platform-dependent musical/symbol glyphs. */
export function ModelGlyph({ id }: { id: string }) {
  return (
    <svg
      className="home-model-glyph"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {!builtInModels.some((option) => option.id === id) ? (
        <>
          <rect
            x="3"
            y="3"
            width="18"
            height="18"
            rx="4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M8 8h8v8H8z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </>
      ) : id === "" ? (
        <path
          fill="currentColor"
          d="M3 16h5v5H3zm5-5h5v10H8zm5-8h5v13h-5zm6 0h3v5h-3z"
        />
      ) : id.startsWith("glm") ? (
        <path
          fill="currentColor"
          d="M5 4h16l-2 4H9zm3 5h10L8 18h10l-2 3H1L12 9zm-4-5h4L6 8H2z"
        />
      ) : id.startsWith("hy") ? (
        <>
          <path
            fill="currentColor"
            d="M8 2c3 4-3 5-3 10 0 5 5 7 8 3-5 1-6-4-2-6 3-2 4-3 3-6 5 2 8 6 7 11-1 6-8 10-14 7C0 18 0 11 4 7c-1 4 1 5 2 4C5 8 10 6 8 2Z"
          />
          <circle cx="17" cy="8" r="1.5" fill="white" />
        </>
      ) : id === "space-bunny" ? (
        <>
          <circle
            cx="12"
            cy="12"
            r="9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M6 14c0-3 2-5 5-5L9 4l4 4 4-2-1 5c4 2 2 7-2 7H9l-3 2 1-4Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <circle cx="14" cy="13" r="1" fill="currentColor" />
        </>
      ) : (
        <>
          <path
            fill="currentColor"
            d="M2 9c3 2 4-2 7-2 5-1 7 4 10 4l3-4c1 5-1 8-4 9-2 6-11 5-13 0-3-1-4-3-3-7Z"
          />
          <path d="m12 7-2-4 5 4" fill="currentColor" />
          <circle cx="8" cy="12" r="1" fill="white" />
        </>
      )}
    </svg>
  );
}

const referencePricing =
  "截图中的倍率与优惠标签仅供界面参考，实际可用性和计费以服务商为准。";

type Props = {
  model: string;
  maxMode: boolean;
  thinkingMode: "balanced" | "extreme";
  onMaxChange(): void;
  onThinkingChange(mode: "balanced" | "extreme"): void;
  onSelect(id: string): void;
  onConfigure(): void;
};

export function HomeModelMenu({
  model,
  maxMode,
  thinkingMode,
  onMaxChange,
  onThinkingChange,
  onSelect,
  onConfigure,
}: Props) {
  const modelOptions = useModelOptions();
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    list.current
      ?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.focus({ preventScroll: true });
  }, []);

  function navigateModels(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const options = Array.from(
      list.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ||
        [],
    );
    const current = options.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? options.length - 1
          : event.key === "ArrowDown"
            ? (current + 1) % options.length
            : (current - 1 + options.length) % options.length;
    options[next]?.focus({ preventScroll: true });
    options[next]?.scrollIntoView({ block: "nearest" });
  }

  return (
    <div
      className="model-menu-popover home-model-menu"
      role="dialog"
      aria-label="选择大模型"
    >
      <div className="model-menu-max-row">
        <span className="model-menu-max-icon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
          >
            <path d="m12 2 3 3 4 1v4l3 3-3 3-1 4h-4l-3 2-3-3-4-1v-4l-2-3 3-3 1-4h4Z" />
            <path d="M8 16V8l4 6 4-6v8" />
          </svg>
        </span>
        <b>Max 模式</b>
        <button
          className={maxMode ? "model-toggle is-on" : "model-toggle"}
          type="button"
          role="switch"
          aria-checked={maxMode}
          aria-label="Max 模式"
          title="界面偏好；Max 模式参数暂未接入后端。"
          onClick={onMaxChange}
        >
          <i />
        </button>
      </div>
      <div className="home-model-menu-scroll">
        <div
          className="model-menu-reasoning"
          role="group"
          aria-label="推理模式"
        >
          <button
            type="button"
            aria-pressed={thinkingMode === "balanced"}
            title="界面偏好，暂不改变后端推理参数；倍率为截图参考。"
            onClick={() => onThinkingChange("balanced")}
          >
            <HomeIcon name="checkCircle" size={16} />
            <b>均衡</b>
            <small>0.65x</small>
          </button>
          <button
            type="button"
            aria-pressed={thinkingMode === "extreme"}
            title="界面偏好，暂不改变后端推理参数；倍率为截图参考。"
            onClick={() => onThinkingChange("extreme")}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              aria-hidden="true"
            >
              <path d="m6 3-4 7 10 11 10-11-4-7Zm-4 7h20M6 3l6 18 6-18M6 3l6 7 6-7" />
            </svg>
            <b>极致</b>
            <small>1.20x</small>
          </button>
        </div>
        <div
          ref={list}
          className="model-menu-list"
          role="listbox"
          aria-label="大模型"
          onKeyDown={navigateModels}
        >
          {modelOptions.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={model === option.id}
              key={option.name}
              className={
                model === option.id
                  ? "model-menu-option is-selected"
                  : "model-menu-option"
              }
              onClick={() => onSelect(option.id)}
            >
              <ModelGlyph id={option.id} />
              <b>{option.name}</b>
              {option.badge && (
                <i
                  className={`model-option-badge badge-${option.badgeTone}`}
                  title={referencePricing}
                >
                  {option.badgeTone === "warm" && (
                    <HomeIcon name="invite" size={11} />
                  )}
                  {option.badge}
                </i>
              )}
              <small title={referencePricing}>{option.cost}</small>
              <span className="model-option-check" aria-hidden="true">
                {model === option.id && <HomeIcon name="check" size={13} />}
              </span>
            </button>
          ))}
        </div>
      </div>
      <button
        className="model-custom-config"
        type="button"
        onClick={onConfigure}
      >
        <HomeIcon name="pencil" size={16} />
        配置自定义模型
      </button>
    </div>
  );
}
