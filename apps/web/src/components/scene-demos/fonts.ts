import manifest from "../../assets/fonts/manifest.json";
import license from "../../assets/fonts/OFL.txt?raw";
const urls = import.meta.glob<string>("../../assets/fonts/*.woff2", {
  eager: true,
  query: "?url",
  import: "default",
});
export const fontLicense = license;
const cache = new Map<string, Promise<string>>();
/** Embed only the Unicode subsets used by the artwork, so SVG/PNG text survives offline. */
export async function embeddedFontStyle(text: string): Promise<string> {
  const points = [...new Set([...text].map((c) => c.codePointAt(0)!))];
  const selected = manifest.filter((entry) =>
    entry.ranges.split(",").some((range) => {
      const [lo, hi] = range
        .trim()
        .slice(2)
        .split("-")
        .map((n) => parseInt(n, 16));
      return points.some((p) => p >= lo && p <= (hi ?? lo));
    }),
  );
  const blocks = await Promise.all(
    selected.map(async (entry) => {
      let promise = cache.get(entry.file);
      if (!promise) {
        promise = (async () => {
          const response = await fetch(
            urls[`../../assets/fonts/${entry.file}`],
          );
          if (!response.ok) throw new Error("导出字体读取失败，请重试。");
          const bytes = new Uint8Array(await response.arrayBuffer());
          let binary = "";
          for (let i = 0; i < bytes.length; i += 8192)
            binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
          return btoa(binary);
        })();
        cache.set(entry.file, promise);
        promise.catch(() => cache.delete(entry.file));
      }
      return `@font-face{font-family:'Noto Sans SC';font-style:normal;font-weight:400;src:url(data:font/woff2;base64,${await promise}) format('woff2');unicode-range:${entry.ranges}}`;
    }),
  );
  return `<metadata>${license.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</metadata><style>${blocks.join("\n")}</style>`;
}
