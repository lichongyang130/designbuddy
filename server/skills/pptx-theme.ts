import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
type Colors = { primary: string; background: string; surface: string; text: string; muted: string; accent: string };

function replaceThemeColor(themeXml: string, key: string, value: string): string {
  const pattern = new RegExp(`(<a:${key}\\b[^>]*>[\\s\\S]*?<(?:a:srgbClr|a:sysClr)\\b[^>]*?(?:val|lastClr)=\")[0-9a-f]{6}(\")`, 'i');
  if (!pattern.test(themeXml)) throw Error(`PPTX 主题缺少标准颜色槽 ${key}。`);
  return themeXml.replace(pattern, `$1${value.slice(1).toUpperCase()}$2`);
}
function replaceThemeFont(themeXml: string, group: 'majorFont' | 'minorFont', slot: 'latin' | 'ea', value: string): string {
  const pattern = new RegExp(`(<a:${group}\\b[\\s\\S]*?<a:${slot}\\b[^>]*typeface=\")[^\"]*(\")`);
  if (!pattern.test(themeXml)) throw Error(`PPTX 主题缺少标准字体槽 ${group}/${slot}。`);
  return themeXml.replace(pattern, `$1${value}$2`);
}

/** Replace PptxGenJS's generic Office palette with the validated user tokens. */
export function applyStructuredTheme(pptxBytes: Uint8Array, theme: Colors, headingFont: string, bodyFont: string): Uint8Array {
  const parts = unzipSync(pptxBytes);
  const themePath = 'ppt/theme/theme1.xml';
  if (!parts[themePath]) throw Error('生成的 PPTX 缺少标准 theme1.xml，未交付未标记设计令牌的文件。');
  let source = strFromU8(parts[themePath]);
  const colors: Record<string, string> = {
    dk1: theme.text, lt1: theme.background, dk2: theme.primary, lt2: theme.surface,
    accent1: theme.primary, accent2: theme.accent, accent3: theme.muted,
    accent4: theme.primary, accent5: theme.accent, accent6: theme.muted,
  };
  for (const [key, value] of Object.entries(colors)) source = replaceThemeColor(source, key, value);
  source = replaceThemeFont(source, 'majorFont', 'latin', headingFont);
  source = replaceThemeFont(source, 'majorFont', 'ea', headingFont);
  source = replaceThemeFont(source, 'minorFont', 'latin', bodyFont);
  source = replaceThemeFont(source, 'minorFont', 'ea', bodyFont);
  parts[themePath] = strToU8(source);
  return new Uint8Array(zipSync(parts, { level: 6 }));
}
