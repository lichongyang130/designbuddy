import type { CSSProperties } from "react";
import type { DeckTheme } from "../../../../shared/deckTheme";
import { themeStyle } from "../../../../shared/deckTheme";
import "./theme-preview.css";

export type ThemePreviewVariant = "cover" | "cards" | "chart";

type Props = {
  theme: DeckTheme;
  variant?: ThemePreviewVariant;
  /** Small text in the corner, e.g. the theme name. */
  label?: string;
  className?: string;
};

const SAMPLE = {
  eyebrow: "02 / VALUE PROPOSITION",
  coverTitle: "把体验，做在细节里。",
  cards: [
    { title: "通勤", body: "屏蔽环境噪声\n稳定聆听" },
    { title: "办公", body: "舒适佩戴\n快速切换设备" },
    { title: "出行", body: "清晰电量\n减少续航焦虑" },
  ],
  chart: [
    { label: "线上", value: 82 },
    { label: "门店", value: 64 },
    { label: "合作", value: 47 },
    { label: "企业", value: 93 },
    { label: "海外", value: 38 },
  ],
};

/**
 * A real 16:9 rendering of a deck theme — not a colour swatch.
 *
 * It is plain DOM driven by `themeToCssVariables`, the same variables the deck
 * editor and the PPTX export colours come from, so what the gallery shows is
 * what the deck becomes. No images, no canvas, no network.
 */
export function ThemePreview({ theme, variant = "cover", label, className = "" }: Props) {
  const style = themeStyle(theme) as CSSProperties;
  return (
    <div
      className={`theme-preview ${className}`.trim()}
      style={style}
      data-variant={variant}
      data-density={theme.layout.density}
      aria-hidden="true"
    >
      {variant === "cover" && (
        <div className={`tp-cover tp-cover-${theme.layout.cover}`}>
          {theme.layout.cover === "full-bleed" && theme.imagery.style !== "none" && <div className="tp-cover-wash" />}
          <div className="tp-cover-body">
            <span className="tp-eyebrow">{SAMPLE.eyebrow}</span>
            <h4>{SAMPLE.coverTitle}</h4>
            {theme.layout.accentBar && <i className="tp-accent-bar" />}
            <p className="tp-cover-sub">从产品价值到上市路径</p>
          </div>
        </div>
      )}

      {variant === "cards" && (
        <div className="tp-body">
          <span className="tp-eyebrow">03 / USER NEEDS</span>
          <h4 className="tp-body-title">用户需要的不是更多功能</h4>
          <div className="tp-cards">
            {SAMPLE.cards.map((card, index) => (
              <article key={card.title}>
                <b>{String(index + 1).padStart(2, "0")}</b>
                <strong>{card.title}</strong>
                <span>{card.body.split("\n").join(" ")}</span>
              </article>
            ))}
          </div>
        </div>
      )}

      {variant === "chart" && (
        <div className="tp-body">
          <span className="tp-eyebrow">05 / CHANNEL MIX</span>
          <h4 className="tp-body-title">各渠道贡献</h4>
          <div className="tp-chart">
            {SAMPLE.chart.map((bar, index) => (
              <div key={bar.label}>
                <i
                  style={{
                    height: `${bar.value}%`,
                    background: theme.charts.palette[index % theme.charts.palette.length],
                  }}
                />
                <span>{bar.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {label && <span className="tp-label">{label}</span>}
    </div>
  );
}
