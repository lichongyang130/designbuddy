import { useId, type ReactNode } from "react";
import energy from "../../assets/scenes/energy.webp";
import hotel from "../../assets/scenes/hotel.webp";
import suite from "../../assets/scenes/suite.webp";
import interior from "../../assets/scenes/interior.webp";
import botanical from "../../assets/scenes/botanical.webp";
import brand from "../../assets/scenes/brand.webp";
import headphones from "../../assets/scenes/headphones.webp";
import campaign from "../../assets/scenes/campaign.webp";
export const art = {
  energy,
  hotel,
  suite,
  interior,
  botanical,
  brand,
  headphones,
  campaign,
};
export type DemoProps = { interactive: boolean };
export function Field({
  label,
  value,
  onChange,
  type = "text",
  min,
  max,
  multiline = false,
}: {
  label: string;
  value: string | number;
  onChange(value: string): void;
  type?: string;
  min?: number;
  max?: number;
  multiline?: boolean;
}) {
  const id = useId();
  return (
    <div className="pd-field">
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          maxLength={4000}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
        />
      ) : (
        <input
          id={id}
          type={type}
          min={min}
          max={max}
          value={value}
          maxLength={120}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
export function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
  options: [string, string][];
}) {
  const id = useId();
  return (
    <div className="pd-field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, text]) => (
          <option value={v} key={v}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}
export function Badge({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`pd-badge ${tone}`}>{children}</span>;
}
export function Avatar({ name, index = 0 }: { name: string; index?: number }) {
  return (
    <span className={`pd-avatar avatar-${index % 4}`} title={name}>
      {name.slice(0, 1)}
    </span>
  );
}
export function Toolbar({
  brand,
  title,
  children,
}: {
  brand: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="pd-toolbar">
      <div>
        <b>{brand}</b>
        <span>/</span>
        <strong>{title}</strong>
      </div>
      <div className="pd-toolbar-actions">{children}</div>
    </header>
  );
}
export function Sparkline({
  values,
  color = "#598a78",
}: {
  values: number[];
  color?: string;
}) {
  const max = Math.max(1, ...values),
    min = Math.min(0, ...values);
  const points = values
    .map(
      (v, i) =>
        `${(i * 180) / Math.max(1, values.length - 1)},${47 - ((v - min) / Math.max(1, max - min)) * 40}`,
    )
    .join(" ");
  return (
    <svg viewBox="0 0 180 50" className="pd-spark" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export function TrendChart({
  values = [42, 60, 54, 87, 74, 99, 95, 125, 110, 148, 136, 178],
  label = "月度收入趋势",
  axisLabels,
}: {
  values?: number[];
  label?: string;
  axisLabels?: string[];
}) {
  const max = Math.max(1, ...values);
  const points = values
    .map(
      (v, i) =>
        `${42 + (i * 460) / Math.max(1, values.length - 1)},${177 - (v / max) * 140}`,
    )
    .join(" ");
  return (
    <svg
      viewBox="0 0 530 210"
      role="img"
      aria-label={label}
      className="pd-trend"
    >
      {[37, 82, 127, 177].map((y, i) => (
        <g key={y}>
          <line
            x1="42"
            x2="502"
            y1={y}
            y2={y}
            stroke="#e9eeeb"
            strokeDasharray="4 5"
          />
          <text x="5" y={y + 4} fontSize="9" fill="#98a59f">
            {Math.round((max * (3 - i)) / 3)}
          </text>
        </g>
      ))}
      <polygon points={`42,177 ${points} 502,177`} fill="#80b4a11a" />
      <polyline
        points={points}
        fill="none"
        stroke="#598a78"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {Array.from({ length: Math.min(6, values.length) }, (_, i) => {
        const index = Math.round(
          (i * Math.max(0, values.length - 1)) /
            Math.max(1, Math.min(6, values.length) - 1),
        );
        return (
          <text
            x={42 + (index * 460) / Math.max(1, values.length - 1)}
            y="200"
            fontSize="9"
            fill="#96a19a"
            textAnchor={
              i === 0
                ? "start"
                : i === Math.min(6, values.length) - 1
                  ? "end"
                  : "middle"
            }
            key={index}
          >
            {axisLabels?.[index] || `${index + 1} 月`}
          </text>
        );
      })}
    </svg>
  );
}
export function downloadText(
  name: string,
  text: string,
  type = "text/plain;charset=utf-8",
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function csvCell(value: unknown) {
  let text = String(value);
  if (/^[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export const money = (n: number) =>
  `¥${n.toLocaleString("zh-CN", { maximumFractionDigits: 0 })}`;
export function numberInput(value: string, max = 1000000) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : 0;
}
