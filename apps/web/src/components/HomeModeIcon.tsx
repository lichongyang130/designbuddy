type Props = { mode: "office" | "code" | "design" };

/** Dedicated, optically balanced homepage mode icons; unrelated navigation icons stay unchanged. */
export function HomeModeIcon({ mode }: Props) {
  return (
    <svg
      className={`home-mode-icon home-mode-icon--${mode}`}
      width="26"
      height="26"
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {mode === "office" && <>
        <rect x="4" y="8" width="20" height="16" rx="4" fill="currentColor" fillOpacity=".12" stroke="none" />
        <path d="M9 8V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" />
        <rect x="3.5" y="8" width="21" height="16" rx="3.5" />
        <path d="M4 13.5c5 3 15 3 20 0" />
        <path d="M12 14.5h4V18h-4z" fill="white" />
      </>}
      {mode === "code" && <>
        <rect x="3" y="4" width="22" height="21" rx="4" fill="currentColor" fillOpacity=".10" stroke="none" />
        <rect x="3" y="4" width="22" height="21" rx="4" />
        <path d="M3 10h22" />
        <circle cx="7" cy="7" r=".75" fill="currentColor" stroke="none" />
        <circle cx="10" cy="7" r=".75" fill="currentColor" stroke="none" />
        <path d="m10 14-3 3 3 3m8-6 3 3-3 3m-3-7-2 8" />
      </>}
      {mode === "design" && <>
        <path d="m5 15 4-9 12 1 2 12-9 5-9-9Z" fill="currentColor" fillOpacity=".12" stroke="none" />
        <path d="m5 23 3-12L19 5l4 4-6 11-12 3Z" />
        <path d="m5 23 8-8" />
        <circle cx="14.5" cy="13.5" r="2.2" fill="white" />
        <path d="m16 7 5 5M7 4v4M5 6h4m15 13v5m-2.5-2.5h5" />
      </>}
    </svg>
  );
}
