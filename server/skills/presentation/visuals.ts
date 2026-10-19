import type { Colors } from "../pptx-deck";
import type {
  PresentationBrief,
  PresentationSources,
  PresentationAsset,
} from "../../../shared/presentation";
import type {
  PresentationDesign,
  PresentationVisualStyle,
} from "../../../shared/presentationDesign";
import { presentationVisualEngineVersion } from "../../../shared/presentationDesign";
import type { PresentationSpec } from "./spec";
import { assetMetadata } from "./assets";
export type VisualBuildOptions = {
  style: PresentationVisualStyle;
  assets: PresentationAsset[];
  logoAssetId?: string;
};
export const visualPalettes: Record<PresentationVisualStyle, Colors> = {
  consulting: {
    primary: "#244C42",
    background: "#F4F1E9",
    surface: "#FFFFFF",
    text: "#172C26",
    muted: "#52685D",
    accent: "#A54525",
  },
  "technology-launch": {
    primary: "#79E6D0",
    background: "#101827",
    surface: "#1B2940",
    text: "#EFF5FF",
    muted: "#B3C4DB",
    accent: "#FDBB82",
  },
  "brand-editorial": {
    primary: "#843D2B",
    background: "#FFF6EA",
    surface: "#FFFFFF",
    text: "#35241E",
    muted: "#73594D",
    accent: "#9A4829",
  },
};
export function planPresentationVisuals(
  spec: PresentationSpec,
  brief: PresentationBrief,
  sources: PresentationSources,
) {
  const assets = sources.assets || [];
  if (!brief.visualStyle && !assets.length) {
    if (spec.slides.some((s) => s.design?.visual))
      throw Error("没有实际素材，不能用占位图冒充图文输出。");
    return undefined;
  }
  if (spec.schemaVersion !== 2) throw Error("图文策划需要显式自适应文稿。");
  const style = brief.visualStyle || "consulting";
  const logo = assets.find((a) => a.id === brief.logoAssetId);
  if (brief.logoAssetId && (!logo || logo.role !== "logo"))
    throw Error("Logo必须绑定本次已授权的logo素材。");
  const designs = spec.slides.map((s) => {
    const d: PresentationDesign = { ...s.design! };
    if (!s.sourceRefs.some((id) => !assets.some((a) => a.id === id)))
      throw Error(
        "素材元数据不是正文事实证据；每页仍需可核对的文字/数据来源，图片内容请另附文字材料。",
      );
    if (!d.visual && s.content.type === "cover" && brief.visualStyle) {
      const hero = assets.find(
        (a) => a.usage === "decorative" && a.role !== "logo",
      );
      if (hero) {
        d.layout = "visual-cover";
        d.visual = { assetId: hero.id, fit: "cover" };
      }
    }
    if (d.visual) {
      const a = assets.find((a) => a.id === d.visual!.assetId);
      if (!a || a.role === "logo")
        throw Error(`页面${s.id}缺少已授权的内容图片；Logo只能作为品牌标识。`);
      if (
        a.usage === "evidence" &&
        (d.visual.fit !== "contain" || !s.sourceRefs.includes(a.id))
      )
        throw Error(
          "证据图/截图必须完整显示并列入本页来源，不能裁切或当作气氛图。",
        );
      if (d.layout === "auto")
        d.layout =
          s.content.type === "cover"
            ? "visual-cover"
            : a.usage === "evidence"
              ? "screenshot-evidence"
              : "visual-story";
    }
    if (
      ["visual-cover", "visual-story", "screenshot-evidence"].includes(
        d.layout,
      ) &&
      !d.visual
    )
      throw Error("图文布局必须有真实图片，不能假装已配图。");
    if (
      d.layout === "screenshot-evidence" &&
      assets.find((a) => a.id === d.visual?.assetId)?.usage !== "evidence"
    )
      throw Error("截图证据布局需要明确证据用途的图片。");
    return d;
  });
  return {
    engineVersion: presentationVisualEngineVersion,
    palette: visualPalettes[style],
    method:
      "deterministic rules from declared purpose, content type and asset metadata; not autonomous image understanding",
    style,
    logoAssetId: logo?.id,
    designs,
    pages: spec.slides.map((s, i) => ({
      slideId: s.id,
      layout: designs[i].layout,
      nature: designs[i].nature,
      primaryMessage: s.content.title,
      image: designs[i].visual
        ? {
            ...designs[i].visual,
            usage: assets.find((a) => a.id === designs[i].visual!.assetId)!
              .usage,
          }
        : null,
      composition:
        style === "consulting"
          ? "克制留白，结论左/图右"
          : style === "technology-launch"
            ? "深色舞台，大图右侧，内容隔离"
            : "杂志式左图右文，章节与留白",
    })),
    assets: assets.map(assetMetadata),
    unusedAssetIds: assets
      .filter(
        (a) =>
          a.id !== logo?.id && !designs.some((d) => d.visual?.assetId === a.id),
      )
      .map((a) => a.id),
  };
}
