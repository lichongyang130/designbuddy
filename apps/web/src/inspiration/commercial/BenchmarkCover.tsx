import {
  benchmarkTemplates,
  type NewBenchmarkId,
} from "../../../../../shared/commercialTemplates";
import "./commercial.css";
export function BenchmarkCover({ id }: { id: NewBenchmarkId }) {
  const t = benchmarkTemplates.find((t) => t.id === id)!;
  return (
    <div
      className={`benchmark-cover cover-${id}`}
      style={{ "--bench-accent": t.accent } as React.CSSProperties}
      aria-hidden="true"
    >
      <small>{t.en}</small>
      <div className="benchmark-cover-art">
        {id === "pro-review" ? (
          <svg viewBox="0 0 300 150">
            <path d="M20 128H280M20 128V20" stroke="currentColor" fill="none" />
            {[60, 100, 85, 125, 115, 140].map((h, i) => (
              <rect
                key={i}
                x={38 + i * 38}
                y={150 - h}
                width="22"
                height={h - 22}
                fill="currentColor"
                opacity={0.3 + i * 0.1}
              />
            ))}
          </svg>
        ) : id === "pro-project" ? (
          <div className="cover-paper">
            <b>
              PROJECT
              <br />
              PLAYBOOK
            </b>
            <hr />
            <span>01 / SCOPE</span>
            <hr />
            <span>02 / DELIVERY</span>
            <hr />
            <span>03 / ACCEPTANCE</span>
          </div>
        ) : id === "pro-cues" ? (
          <svg viewBox="0 0 300 150">
            {Array.from({ length: 40 }, (_, i) => (
              <rect
                key={i}
                x={i * 7.5}
                y={75 - Math.sin(i * 0.6) ** 2 * 60}
                width="3"
                height={Math.sin(i * 0.6) ** 2 * 120 + 4}
                fill="currentColor"
              />
            ))}
          </svg>
        ) : id === "pro-cost" ? (
          <div className="cover-number">
            COST / VALUE<small>BUILD A BETTER ESTIMATE</small>
          </div>
        ) : id === "pro-tour" ? (
          <div className="cover-steps">
            {[1, 2, 3, 4, 5].map((i) => (
              <i key={i}>{String(i).padStart(2, "0")}</i>
            ))}
          </div>
        ) : (
          <svg viewBox="0 0 300 150">
            <ellipse cx="150" cy="60" rx="95" ry="28" fill="currentColor" />
            <path
              d="M76 64v72M224 64v72M150 85v55"
              stroke="currentColor"
              strokeWidth="8"
            />
            <circle
              cx="150"
              cy="75"
              r="70"
              fill="none"
              stroke="currentColor"
              opacity=".2"
            />
            {id === "pro-film" && <path d="M140 45l30 20-30 20z" fill="#fff" />}
          </svg>
        )}
      </div>
      <strong>{t.name.split(" · ")[0]}</strong>
      <span>{t.unit}</span>
    </div>
  );
}
