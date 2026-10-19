import sharp from "sharp";
import { createHash } from "node:crypto";
import type {
  PresentationAsset,
  PresentationAssetInput,
  PresentationSources,
} from "../../../shared/presentation";
const hash = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max: number, label: string) => {
  if (
    typeof v !== "string" ||
    !v.trim() ||
    v.length > max ||
    /[\x00-\x1f\x7f]/.test(v)
  )
    throw Error(`${label}缺失、过长或包含控制字符。`);
  return v.trim();
};
export function parsePresentationAssets(
  value: unknown,
  documentBytes: number,
): PresentationAssetInput[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 5)
    throw Error("最多5份视觉素材。");
  const ids = new Set<string>(),
    names = new Set<string>();
  let total = documentBytes;
  return value.map((v) => {
    if (
      !record(v) ||
      Object.keys(v).some(
        (k) =>
          ![
            "id",
            "name",
            "base64",
            "role",
            "usage",
            "alt",
            "source",
            "license",
            "permissionConfirmed",
          ].includes(k),
      )
    )
      throw Error("素材只接受声明字段，不允许路径、远程抓取或脚本。");
    const id = str(v.id, 40, "素材ID"),
      name = str(v.name, 120, "素材名");
    if (
      !/^asset-[a-z0-9][a-z0-9-]{0,30}$/.test(id) ||
      ids.has(id) ||
      /[\\/]/.test(name) ||
      !/\.(png|jpe?g|webp)$/i.test(name) ||
      names.has(name.toLowerCase())
    )
      throw Error("素材ID/文件名非法或重复；只支持PNG/JPEG/WebP。");
    ids.add(id);
    names.add(name.toLowerCase());
    if (
      !["logo", "screenshot", "illustration", "photo"].includes(
        String(v.role),
      ) ||
      !["decorative", "evidence"].includes(String(v.usage)) ||
      v.permissionConfirmed !== true
    )
      throw Error("素材须明确角色、用途及本次使用权限。");
    if (v.role === "screenshot" && v.usage !== "evidence")
      throw Error("截图必须作为证据素材，不允许裁切掩盖内容。");
    if (v.role === "logo" && v.usage !== "decorative")
      throw Error("Logo只作为品牌标识，不是业务事实证据。");
    if (
      typeof v.base64 !== "string" ||
      v.base64.length > 2_666_668 ||
      v.base64.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(v.base64)
    )
      throw Error("素材编码无效或超过2MB。");
    const bytes = Buffer.from(v.base64, "base64");
    if (
      !bytes.length ||
      bytes.length > 2_000_000 ||
      bytes.toString("base64") !== v.base64
    )
      throw Error("素材为空、编码无效或超过2MB。");
    total += bytes.length;
    if (total > 10_000_000) throw Error("来源材料与素材合计不能超过10MB。");
    return {
      id,
      name,
      base64: v.base64,
      role: v.role as PresentationAssetInput["role"],
      usage: v.usage as PresentationAssetInput["usage"],
      alt: str(v.alt, 120, "素材说明"),
      source: str(v.source, 240, "素材来源"),
      license: str(v.license, 200, "素材使用许可"),
      permissionConfirmed: true,
    };
  });
}
export async function normalizePresentationAssets(
  inputs: PresentationAssetInput[],
): Promise<PresentationAsset[]> {
  const result: PresentationAsset[] = [];
  let total = 0;
  for (const input of inputs) {
    const bytes = Buffer.from(input.base64, "base64");
    const magic = bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      ? "png"
      : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        ? "jpeg"
        : bytes.toString("ascii", 0, 4) === "RIFF" &&
            bytes.toString("ascii", 8, 12) === "WEBP"
          ? "webp"
          : null;
    if (magic === "png") {
      let p = 8;
      while (p + 12 <= bytes.length) {
        const n = bytes.readUInt32BE(p),
          kind = bytes.toString("ascii", p + 4, p + 8);
        if (kind === "acTL") throw Error("不接受APNG动画素材。");
        if (n > bytes.length - p - 12) break;
        p += n + 12;
      }
    }
    if (
      magic === "webp" &&
      bytes.toString("ascii", 12, 16) === "VP8X" &&
      bytes[20] & 2
    )
      throw Error("不接受WebP动画素材。");
    if (!magic)
      throw Error("素材魔数不是允许的栅格格式；SVG/HTML/伪装图片不会解码。");
    try {
      const image = sharp(bytes, {
          limitInputPixels: 8_000_000,
          failOn: "warning",
        }),
        meta = await image.metadata();
      if (
        meta.format !== magic ||
        !meta.width ||
        !meta.height ||
        meta.width * meta.height > 8_000_000 ||
        (meta.pages || 1) > 1
      )
        throw Error("图片格式、像素或动画不受支持");
      const oriented = image.rotate();
      if (input.usage === "decorative")
        oriented.resize({
          width: 2200,
          height: 2200,
          fit: "inside",
          withoutEnlargement: true,
        });
      const normalized = await oriented
        .png({ compressionLevel: 9 })
        .toBuffer({ resolveWithObject: true });
      if (normalized.data.length > 4_000_000) throw Error("规范化图片超过4MB");
      total += normalized.data.length;
      if (total > 8_000_000) throw Error("规范化图片总量超过8MB");
      const { base64: _, ...metadata } = input;
      result.push({
        ...metadata,
        originalSHA256: hash(bytes),
        sha256: hash(normalized.data),
        width: normalized.info.width,
        height: normalized.info.height,
        mimeType: "image/png",
        data: normalized.data.toString("base64"),
      });
    } catch {
      throw Error(
        `素材 ${input.id} 解码、像素或规范化预算校验失败；不使用占位图替代。`,
      );
    }
  }
  return result;
}
export function assetMetadata(asset: PresentationAsset) {
  const { data: _, ...rest } = asset;
  return rest;
}
export function publicPresentationSources(sources: PresentationSources) {
  return {
    ...sources,
    ...(sources.assets ? { assets: sources.assets.map(assetMetadata) } : {}),
  };
}
