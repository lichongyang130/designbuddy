/**
 * Deck themes: the visual layer of a presentation, kept separate from its content.
 *
 * A theme is plain data. It never changes `slides[]`, never carries executable
 * code, and never fetches anything. The same object drives three places:
 *
 *   - the gallery preview        (themeToCssVariables → real DOM)
 *   - the editor                 (CSS variables on the deck root)
 *   - the PPTX export            (per-slide colours + ppt/theme/theme1.xml)
 *
 * If those three ever disagree, the tests in apps/web/tests/deck-theme.test.mjs
 * fail instead of shipping a deck whose export does not match its preview.
 */

export type DeckPalette = {
  background: string;
  surface: string;
  text: string;
  muted: string;
  primary: string;
  accent: string;
  border: string;
  /** Text colour used on top of `primary` (cover pages, filled buttons). */
  onPrimary: string;
  success: string;
  warning: string;
  danger: string;
};

export type DeckTypography = {
  headingFont: string;
  bodyFont: string;
  /** Heading sizes in px, largest first. */
  scale: number[];
  lineHeight: number;
  letterSpacing: number;
  /** CSS font-weight for headings; 650 keeps the deck's original tracking-optical bold. */
  headingWeight: number;
  headingTransform: "none" | "uppercase";
};

export type DeckShape = {
  /** Corner radius in px applied to cards, images and filled blocks. */
  radius: number;
  stroke: number;
  shadow: "none" | "soft" | "raised";
  /** Inner padding of the slide content area, in % of slide width. */
  padding: number;
};

export type DeckLayout = {
  density: "compact" | "default" | "airy";
  cover: "full-bleed" | "split" | "centered" | "minimal";
  eyebrow: "mono" | "caps" | "pill";
  accentBar: boolean;
  divider: "line" | "space" | "none";
};

export type DeckImagery = {
  style: "photo" | "illustration" | "abstract" | "none";
  /** 0–1: how much the cover image is darkened under the title. */
  overlay: number;
  keywords: string[];
};

export type DeckTheme = {
  id: string;
  name: string;
  kind: "preset" | "derived" | "custom" | "imported";
  tags: string[];
  /** Set when the theme was derived from a design system or an imported file. */
  source?: { systemId?: string; filename?: string };
  palette: DeckPalette;
  typography: DeckTypography;
  shape: DeckShape;
  layout: DeckLayout;
  imagery: DeckImagery;
  logo?: { assetId?: string; placement: "cover" | "header" | "footer"; maxHeight: number };
  charts: { palette: string[]; grid: boolean };
  /** Only applied to HTML/PDF export. Never sent to PPTX. */
  customCss?: string;
};

export type ThemeWarning = { field: string; message: string; ratio?: number };

export type ThemeValidation =
  | { ok: true; theme: DeckTheme; warnings: ThemeWarning[] }
  | { ok: false; errors: string[] };

/** Fonts a theme may name. Anything else would be a promise the export cannot keep. */
export const THEME_FONTS = [
  "Microsoft YaHei",
  "PingFang SC",
  "Noto Sans SC",
  "Source Han Sans SC",
  "Inter",
  "Arial",
  "Helvetica Neue",
  "Georgia",
  "Times New Roman",
  "Songti SC",
  "Noto Serif SC",
  "Source Han Serif SC",
  "Menlo",
  "JetBrains Mono",
  "ui-monospace",
] as const;

export const THEME_LIMITS = {
  maxCustomCss: 4096,
  maxName: 40,
  maxTags: 6,
  maxChartsColors: 8,
  minChartsColors: 3,
} as const;

const HEX = /^#[0-9a-fA-F]{6}$/;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX.test(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function number(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value) ? clamp(value, min, max) : fallback;
}

/** sRGB relative luminance, WCAG 2.1. */
export function relativeLuminance(hex: string): number {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255);
  const [r, g, b] = channels.map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio between two hex colours, 1–21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Blend `hex` towards black by `amount` (0–1). Used for cover pages on light primaries. */
export function darken(hex: string, amount: number): string {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((offset) => Math.round(parseInt(value.slice(offset, offset + 2), 16) * (1 - amount)));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0").toUpperCase()).join("")}`;
}

export function mix(a: string, b: string, weight: number): string {
  const pa = a.replace("#", "");
  const pb = b.replace("#", "");
  const channels = [0, 2, 4].map((offset) => {
    const ca = parseInt(pa.slice(offset, offset + 2), 16);
    const cb = parseInt(pb.slice(offset, offset + 2), 16);
    return Math.round(ca * (1 - weight) + cb * weight);
  });
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0").toUpperCase()).join("")}`;
}

/** Pick black or white text for a filled colour, whichever reads better. */
export function readableOn(hex: string): string {
  return contrastRatio(hex, "#FFFFFF") >= contrastRatio(hex, "#000000") ? "#FFFFFF" : "#111111";
}

export const DEFAULT_DECK_THEME: DeckTheme = {
  id: "theme-ink-green",
  name: "墨绿经典",
  kind: "preset",
  tags: ["极简", "浅色", "提案"],
  palette: {
    background: "#F2F1EB",
    surface: "#FFFFFF",
    text: "#273E40",
    muted: "#63816F",
    primary: "#17292C",
    accent: "#B4663F",
    border: "#AEBFB0",
    onPrimary: "#F7F5EE",
    success: "#2F7D5A",
    warning: "#B7791F",
    danger: "#C0463B",
  },
  typography: {
    headingFont: "Microsoft YaHei",
    bodyFont: "Microsoft YaHei",
    scale: [40, 32, 24, 18, 14, 12],
    lineHeight: 1.8,
    letterSpacing: -0.03,
    headingWeight: 650,
    headingTransform: "none",
  },
  shape: { radius: 6, stroke: 1, shadow: "soft", padding: 5.2 },
  layout: { density: "default", cover: "split", eyebrow: "caps", accentBar: true, divider: "line" },
  imagery: { style: "photo", overlay: 0.35, keywords: ["minimal", "editorial"] },
  charts: { palette: ["#17292C", "#B4663F", "#769980", "#C9A227", "#8A9A94"], grid: true },
};

/**
 * Validate untrusted input (a saved custom theme, an API response, an import).
 *
 * Unknown or out-of-range values are clamped rather than rejected, because a
 * theme that lost its radius is still usable. Colours and fonts are the
 * exception: a wrong colour is not a theme, so those produce errors.
 */
export function validateDeckTheme(input: unknown): ThemeValidation {
  const errors: string[] = [];
  const warnings: ThemeWarning[] = [];
  if (!input || typeof input !== "object") return { ok: false, errors: ["主题必须是一个对象。"] };
  const raw = input as Partial<DeckTheme>;

  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim().slice(0, 80) : "";
  if (!id) errors.push("缺少主题 id。");
  const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim().slice(0, THEME_LIMITS.maxName) : "";
  if (!name) errors.push("缺少主题名称。");

  const paletteInput = (raw.palette ?? {}) as Partial<DeckPalette>;
  const fallback = DEFAULT_DECK_THEME.palette;
  const palette = {} as DeckPalette;
  for (const key of Object.keys(fallback) as (keyof DeckPalette)[]) {
    const value = paletteInput[key];
    if (value === undefined) {
      palette[key] = fallback[key];
      continue;
    }
    if (!isHexColor(value)) {
      errors.push(`颜色 ${key} 必须是 6 位十六进制色值（如 #1D3A34）。`);
      palette[key] = fallback[key];
      continue;
    }
    palette[key] = value.toUpperCase();
  }

  const typographyInput = (raw.typography ?? {}) as Partial<DeckTypography>;
  const typography: DeckTypography = {
    headingFont: pickFont(typographyInput.headingFont, "headingFont", errors),
    bodyFont: pickFont(typographyInput.bodyFont, "bodyFont", errors),
    scale: Array.isArray(typographyInput.scale)
      ? typographyInput.scale.filter((n): n is number => typeof n === "number" && n > 0).slice(0, 8)
      : DEFAULT_DECK_THEME.typography.scale,
    lineHeight: number(typographyInput.lineHeight, DEFAULT_DECK_THEME.typography.lineHeight, 1.1, 2.2),
    letterSpacing: number(typographyInput.letterSpacing, 0, -0.05, 0.3),
    headingWeight: number(typographyInput.headingWeight, 600, 300, 900),
    headingTransform: typographyInput.headingTransform === "uppercase" ? "uppercase" : "none",
  };
  if (typography.scale.length === 0) typography.scale = DEFAULT_DECK_THEME.typography.scale;

  const shapeInput = (raw.shape ?? {}) as Partial<DeckShape>;
  const shape: DeckShape = {
    radius: number(shapeInput.radius, DEFAULT_DECK_THEME.shape.radius, 0, 40),
    stroke: number(shapeInput.stroke, DEFAULT_DECK_THEME.shape.stroke, 0, 4),
    shadow: shapeInput.shadow === "none" || shapeInput.shadow === "raised" ? shapeInput.shadow : "soft",
    padding: number(shapeInput.padding, DEFAULT_DECK_THEME.shape.padding, 3, 10),
  };

  const layoutInput = (raw.layout ?? {}) as Partial<DeckLayout>;
  const layout: DeckLayout = {
    density: layoutInput.density === "compact" || layoutInput.density === "airy" ? layoutInput.density : "default",
    cover: (["full-bleed", "split", "centered", "minimal"] as const).includes(layoutInput.cover as "split")
      ? (layoutInput.cover as DeckLayout["cover"])
      : "split",
    eyebrow: (["mono", "caps", "pill"] as const).includes(layoutInput.eyebrow as "caps")
      ? (layoutInput.eyebrow as DeckLayout["eyebrow"])
      : "caps",
    accentBar: typeof layoutInput.accentBar === "boolean" ? layoutInput.accentBar : true,
    divider: layoutInput.divider === "space" || layoutInput.divider === "none" ? layoutInput.divider : "line",
  };

  const imageryInput = (raw.imagery ?? {}) as Partial<DeckImagery>;
  const imagery: DeckImagery = {
    style: (["photo", "illustration", "abstract", "none"] as const).includes(imageryInput.style as "photo")
      ? (imageryInput.style as DeckImagery["style"])
      : "photo",
    overlay: number(imageryInput.overlay, DEFAULT_DECK_THEME.imagery.overlay, 0, 0.9),
    keywords: Array.isArray(imageryInput.keywords)
      ? imageryInput.keywords.filter((k): k is string => typeof k === "string").slice(0, 8).map((k) => k.slice(0, 24))
      : [],
  };

  const chartsInput = (raw.charts ?? {}) as { palette?: unknown; grid?: unknown };
  const chartColors = Array.isArray(chartsInput.palette)
    ? chartsInput.palette.filter(isHexColor).map((c) => c.toUpperCase()).slice(0, THEME_LIMITS.maxChartsColors)
    : [...DEFAULT_DECK_THEME.charts.palette];
  while (chartColors.length < THEME_LIMITS.minChartsColors) {
    chartColors.push(DEFAULT_DECK_THEME.charts.palette[chartColors.length % DEFAULT_DECK_THEME.charts.palette.length]);
  }
  if (Array.isArray(chartsInput.palette) && chartsInput.palette.filter(isHexColor).length < THEME_LIMITS.minChartsColors) {
    warnings.push({ field: "charts.palette", message: `图表配色至少需要 ${THEME_LIMITS.minChartsColors} 种颜色，已自动补齐。` });
  }

  const customCss = typeof raw.customCss === "string" ? raw.customCss.trim() : "";
  if (customCss.length > THEME_LIMITS.maxCustomCss) {
    errors.push(`自定义 CSS 不能超过 ${THEME_LIMITS.maxCustomCss} 字节。`);
  } else if (/@import|url\s*\(/i.test(customCss)) {
    errors.push("自定义 CSS 不能使用 @import 或 url()，避免加载外部资源。");
  }

  const tags = Array.isArray(raw.tags)
    ? raw.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0).slice(0, THEME_LIMITS.maxTags).map((tag) => tag.trim().slice(0, 12))
    : [];

  if (errors.length) return { ok: false, errors };

  const theme: DeckTheme = {
    id,
    name,
    kind: raw.kind === "derived" || raw.kind === "custom" || raw.kind === "imported" ? raw.kind : "preset",
    tags,
    ...(raw.source && typeof raw.source === "object" ? { source: raw.source } : {}),
    palette,
    typography,
    shape,
    layout,
    imagery,
    ...(raw.logo && typeof raw.logo === "object" ? { logo: raw.logo } : {}),
    charts: { palette: chartColors, grid: typeof chartsInput.grid === "boolean" ? chartsInput.grid : true },
    ...(customCss ? { customCss } : {}),
  };

  warnings.push(...accessibilityWarnings(theme));
  return { ok: true, theme, warnings };
}

function pickFont(value: unknown, field: string, errors: string[]): string {
  if (value === undefined) return DEFAULT_DECK_THEME.typography.headingFont;
  if (typeof value === "string" && (THEME_FONTS as readonly string[]).includes(value)) return value;
  errors.push(`字体 ${field} 不在可用列表中。可选：${THEME_FONTS.slice(0, 6).join("、")} 等 ${THEME_FONTS.length} 种。`);
  return DEFAULT_DECK_THEME.typography.headingFont;
}

/** Real ratios, not a claim that everything is accessible. */
export function accessibilityWarnings(theme: DeckTheme): ThemeWarning[] {
  const { background, text, muted, primary, onPrimary, accent, surface } = theme.palette;
  const warnings: ThemeWarning[] = [];
  const check = (field: string, fg: string, bg: string, label: string, min = 4.5) => {
    const ratio = contrastRatio(fg, bg);
    if (ratio + 0.005 < min) {
      warnings.push({ field, ratio: Math.round(ratio * 100) / 100, message: `${label}对比度 ${ratio.toFixed(1)}:1，低于 ${min}:1，建议加深或换色。` });
    }
  };
  check("palette.text", text, background, "正文");
  check("palette.muted", muted, background, "次要文字", 3);
  check("palette.text", text, surface, "表面上的正文");
  check("palette.onPrimary", onPrimary, primary, "主色上的文字");
  check("palette.accent", accent, background, "强调色", 3);
  return warnings;
}

/**
 * The CSS variables the editor, the gallery preview and the deck all read.
 * Keeping this in one place is what stops preview and export from drifting.
 */
export function themeToCssVariables(theme: DeckTheme): Record<string, string> {
  const { palette, typography, shape, layout } = theme;
  const cover = coverColors(theme);
  const shadow =
    shape.shadow === "none" ? "none" : shape.shadow === "raised" ? "0 18px 40px rgba(16, 24, 40, 0.16)" : "0 7px 25px rgba(23, 47, 32, 0.09)";
  const densityGap = layout.density === "compact" ? "0.6" : layout.density === "airy" ? "1.35" : "1";
  return {
    "--ppt-bg": palette.background,
    "--ppt-surface": palette.surface,
    "--ppt-ink": palette.text,
    "--ppt-muted": palette.muted,
    "--ppt-primary": palette.primary,
    "--ppt-accent": palette.accent,
    "--ppt-border": palette.border,
    "--ppt-on-primary": palette.onPrimary,
    "--ppt-cover-bg": cover.background,
    "--ppt-cover-ink": cover.text,
    "--ppt-cover-muted": cover.muted,
    "--ppt-cover-faint": cover.faint,
    "--ppt-success": palette.success,
    "--ppt-warning": palette.warning,
    "--ppt-danger": palette.danger,
    "--ppt-heading-font": fontStack(typography.headingFont),
    "--ppt-body-font": fontStack(typography.bodyFont),
    "--ppt-line-height": String(typography.lineHeight),
    "--ppt-letter-spacing": `${typography.letterSpacing}em`,
    "--ppt-heading-weight": String(typography.headingWeight),
    "--ppt-heading-transform": typography.headingTransform === "uppercase" ? "uppercase" : "none",
    "--ppt-radius": `${shape.radius}px`,
    "--ppt-stroke": `${shape.stroke}px`,
    "--ppt-shadow": shadow,
    "--ppt-padding": `${shape.padding}%`,
    "--ppt-density": densityGap,
    "--ppt-faint": mix(palette.text, palette.background, 0.42),
    ...Object.fromEntries(theme.charts.palette.slice(0, 6).map((color, index) => [`--ppt-chart-${index + 1}`, color])),
    "--ppt-eyebrow-transform": layout.eyebrow === "mono" ? "none" : "uppercase",
  };
}

export function fontStack(font: string): string {
  const generic = /serif/i.test(font) && !/sans/i.test(font) ? "serif" : /mono/i.test(font) ? "monospace" : "sans-serif";
  return `"${font}", system-ui, ${generic}`;
}

/** Inline style object for React. */
export function themeStyle(theme: DeckTheme): Record<string, string> {
  return themeToCssVariables(theme);
}

/** A small stylesheet, used by HTML export where inline variables are not enough. */
export function themeCssText(theme: DeckTheme, selector = ":root"): string {
  const body = Object.entries(themeToCssVariables(theme))
    .map(([key, value]) => `  ${key}: ${value};`)
    .join("\n");
  return `${selector} {\n${body}\n}`;
}

/**
 * `ppt/theme/theme1.xml`.
 *
 * PptxGenJS writes its own Office-default theme; we replace that part of the
 * package so the deck's declared theme (what PowerPoint shows under
 * Design → Variants) matches the colours actually used on the slides.
 */
export function buildPptxThemeXml(theme: DeckTheme, name = "DesignBuddy"): string {
  const { palette, typography } = theme;
  const color = (hex: string) => `<a:srgbClr val="${escapeXml(hex.replace("#", "").toUpperCase())}"/>`;
  const scheme = (value: string) => `<a:srgbClr val="${escapeXml(value)}"/>`;
  const accent = [0, 1, 2, 3, 4, 5]
    .map((index) => `<a:accent${index + 1}>${scheme(theme.charts.palette[index % theme.charts.palette.length].replace("#", ""))}</a:accent${index + 1}>`)
    .join("");
  const heading = escapeXml(typography.headingFont);
  const body = escapeXml(typography.bodyFont);
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="' + escapeXml(name) + '">',
    "<a:themeElements>",
    `<a:clrScheme name="${escapeXml(name)}">`,
    `<a:dk1>${color(palette.text)}</a:dk1>`,
    `<a:lt1>${color(palette.background)}</a:lt1>`,
    `<a:dk2>${color(palette.primary)}</a:dk2>`,
    `<a:lt2>${color(palette.surface)}</a:lt2>`,
    accent,
    `<a:hlink>${color(palette.accent)}</a:hlink>`,
    `<a:folHlink>${color(palette.muted)}</a:folHlink>`,
    "</a:clrScheme>",
    `<a:fontScheme name="${escapeXml(name)}">`,
    `<a:majorFont><a:latin typeface="${heading}"/><a:ea typeface="${heading}"/><a:cs typeface=""/></a:majorFont>`,
    `<a:minorFont><a:latin typeface="${body}"/><a:ea typeface="${body}"/><a:cs typeface=""/></a:minorFont>`,
    "</a:fontScheme>",
    '<a:fmtScheme name="Office">',
    '<a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill>',
    '<a:solidFill><a:schemeClr val="phClr"><a:lumMod val="110000"/><a:satMod val="105000"/></a:schemeClr></a:solidFill>',
    '<a:solidFill><a:schemeClr val="phClr"><a:lumMod val="105000"/><a:satMod val="103000"/></a:schemeClr></a:solidFill></a:fillStyleLst>',
    '<a:lnStyleLst><a:ln w="6350" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>',
    '<a:ln w="12700" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>',
    '<a:ln w="19050" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>',
    '<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>',
    '<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>',
    "</a:fmtScheme>",
    "</a:themeElements>",
    "</a:theme>",
  ].join("");
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Cover pages use the primary colour; very light primaries get darkened so white text still reads. */
export function coverBackground(theme: DeckTheme): string {
  return contrastRatio(theme.palette.primary, theme.palette.onPrimary) >= 4.5
    ? theme.palette.primary
    : darken(theme.palette.primary, 0.35);
}

export function coverTextColor(theme: DeckTheme): string {
  return readableOn(coverBackground(theme));
}

export type CoverColors = {
  /** Fill of a cover page. */
  background: string;
  /** Title / headline colour on the cover. */
  text: string;
  /** Subtitle: legible but clearly secondary. */
  muted: string;
  /** Footer, page numbers. */
  faint: string;
};

/**
 * Everything a cover page needs, derived from the palette so preview and export
 * cannot disagree. The two quiet tints are the cover ink pulled towards the
 * theme's muted colour, which keeps them on-hue on dark covers and readable on
 * light ones.
 */
export function coverColors(theme: DeckTheme): CoverColors {
  const background = coverBackground(theme);
  const text = readableOn(background);
  const tint = theme.palette.muted;
  return {
    background,
    text,
    muted: mix(text, tint, 0.4),
    faint: mix(text, tint, 0.52),
  };
}

/**
 * The palette a PPTX writer needs, as bare RGB hex (`F2F1EB`, no `#`), which is
 * the only form PptxGenJS accepts.
 *
 * Both the exporter and the tests read colours from here, so "the download
 * looks like the preview" is one shared definition rather than two guesses.
 */
export type PptxPalette = {
  background: string;
  ink: string;
  muted: string;
  faint: string;
  border: string;
  accent: string;
  coverBg: string;
  coverInk: string;
  coverMuted: string;
  coverFaint: string;
  chart: string[];
};

export function pptxPalette(theme: DeckTheme): PptxPalette {
  const cover = coverColors(theme);
  const hex = (color: string) => color.replace("#", "").toUpperCase();
  return {
    background: hex(theme.palette.background),
    ink: hex(theme.palette.text),
    muted: hex(theme.palette.muted),
    faint: hex(mix(theme.palette.text, theme.palette.background, 0.42)),
    border: hex(theme.palette.border),
    accent: hex(theme.palette.accent),
    coverBg: hex(cover.background),
    coverInk: hex(cover.text),
    coverMuted: hex(cover.muted),
    coverFaint: hex(cover.faint),
    chart: theme.charts.palette.map(hex),
  };
}

/** The subset of `design-systems/catalog.json` a deck theme can be built from. */
export type DesignSystemLike = {
  id?: string;
  name?: string;
  primary?: string;
  tokens?: {
    color?: Partial<Record<"primary" | "background" | "surface" | "text" | "muted" | "border" | "success" | "warning" | "danger" | "accent" | "onPrimary", string>>;
    typography?: { display?: string; body?: string };
  };
};

/**
 * Build a deck theme from one of the 180 design systems, so Studio's exported
 * PPTX declares the palette it actually draws with instead of a fixed one.
 *
 * Everything is validated: a design system with a bad hex or an exotic font
 * still yields a usable theme rather than a broken file.
 */
export function themeFromDesignSystem(system: DesignSystemLike | undefined, fallback: DeckTheme = DEFAULT_DECK_THEME): DeckTheme {
  const color = system?.tokens?.color ?? {};
  const primary = pickColor(color.primary ?? system?.primary, fallback.palette.primary);
  const background = pickColor(color.background, fallback.palette.background);
  const text = pickColor(color.text, fallback.palette.text);
  const result = validateDeckTheme({
    ...fallback,
    id: `ds-${system?.id || "custom"}`,
    name: system?.name || fallback.name,
    kind: "derived",
    tags: ["设计系统"],
    palette: {
      background,
      surface: pickColor(color.surface, background),
      text,
      muted: pickColor(color.muted, fallback.palette.muted),
      primary,
      accent: pickColor(color.accent ?? color.primary ?? system?.primary, fallback.palette.accent),
      border: pickColor(color.border, fallback.palette.border),
      onPrimary: pickColor(color.onPrimary, readableOn(primary)),
      success: pickColor(color.success, fallback.palette.success),
      warning: pickColor(color.warning, fallback.palette.warning),
      danger: pickColor(color.danger, fallback.palette.danger),
    },
    typography: {
      ...fallback.typography,
      headingFont: pickFontFromStack(system?.tokens?.typography?.display) ?? fallback.typography.headingFont,
      bodyFont: pickFontFromStack(system?.tokens?.typography?.body) ?? fallback.typography.bodyFont,
    },
    charts: {
      palette: [
        primary,
        pickColor(color.success, fallback.palette.success),
        pickColor(color.warning, fallback.palette.warning),
        pickColor(color.danger, fallback.palette.danger),
        pickColor(color.muted, fallback.palette.muted),
      ],
      grid: fallback.charts.grid,
    },
  });
  return result.ok ? result.theme : fallback;
}

function pickColor(value: string | undefined, fallback: string): string {
  return isHexColor(value) ? value.toUpperCase() : fallback;
}

/** `"Inter, system-ui, sans-serif"` → `"Inter"`, but only if we ship that family. */
function pickFontFromStack(stack: string | undefined): string | undefined {
  if (!stack) return undefined;
  const first = stack.split(",")[0]?.trim().replace(/^["']|["']$/g, "");
  return first && (THEME_FONTS as readonly string[]).includes(first) ? first : undefined;
}

export type ThemeOverrides = Partial<Omit<DeckTheme, "palette" | "typography" | "shape" | "layout" | "imagery" | "charts">> & {
  id: string;
  name: string;
  palette?: Partial<DeckPalette>;
  typography?: Partial<DeckTypography>;
  shape?: Partial<DeckShape>;
  layout?: Partial<DeckLayout>;
  imagery?: Partial<DeckImagery>;
  charts?: Partial<DeckTheme["charts"]>;
};

/** A theme with a new id, for "duplicate" / "save as copy". */
export function cloneTheme(theme: DeckTheme, overrides: ThemeOverrides): DeckTheme {
  return {
    ...theme,
    ...overrides,
    palette: { ...theme.palette, ...(overrides.palette ?? {}) },
    typography: { ...theme.typography, ...(overrides.typography ?? {}) },
    shape: { ...theme.shape, ...(overrides.shape ?? {}) },
    layout: { ...theme.layout, ...(overrides.layout ?? {}) },
    imagery: { ...theme.imagery, ...(overrides.imagery ?? {}) },
    charts: { ...theme.charts, ...(overrides.charts ?? {}) },
  };
}

/** Themes created by the user carry this prefix, so preset and custom ids never collide. */
export const CUSTOM_THEME_PREFIX = "custom-";

export function newThemeId(): string {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `${CUSTOM_THEME_PREFIX}${random}`;
}
