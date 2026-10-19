import { presentationFonts } from "../fonts";
const widths = new Map<string, number>();
/** Exact bundled font advances; conservative estimate, NOT Office's shaping/wrapping engine. */
export function textLines(
  text: string,
  width: number,
  size: number,
  bold = false,
): number {
  const font = bold ? presentationFonts().boldFont : presentationFonts().font;
  let lines = 0;
  for (const paragraph of text.split("\n")) {
    lines++;
    let used = 0;
    for (const token of paragraph.match(
      /[A-Za-z0-9_@./:%+-]+|[^A-Za-z0-9_@./:%+-]/gu,
    ) || []) {
      const key = `${bold}:${token}`;
      let advance = widths.get(key);
      if (advance === undefined) {
        advance =
          font
            .layout(token)
            .positions.reduce((n: number, p: any) => n + p.xAdvance, 0) /
          font.unitsPerEm;
        if (widths.size < 12000) widths.set(key, advance);
      }
      const w = (advance * size) / 72;
      if (w > width + 0.005)
        throw Error(
          "存在无法在固定字号内排入的长词/数字；请调整表达或确认拆页，不会自动缩字。",
        );
      if (used + w > width && used > 0) {
        lines++;
        used = 0;
      }
      used += w;
    }
  }
  return Math.max(1, lines);
}
export const textHeight = (
  text: string,
  width: number,
  size: number,
  bold = false,
) => (textLines(text, width, size, bold) * size * 1.28) / 72 + 0.025;
