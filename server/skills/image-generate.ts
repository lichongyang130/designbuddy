import { strToU8 } from "fflate";

/**
 * Image model adapter for `image.generate`.
 *
 * It calls a real OpenAI-compatible image endpoint (`/images/generations` for
 * text-to-image, `/images/edits` for an uploaded image). The endpoint and the
 * model are configured on the server; the key is only read from the server
 * environment and is never written to code, logs or artifacts.
 *
 * Without a configured endpoint the skill stays unavailable in the catalogue.
 * There is no mock, no placeholder image and no local "fake" model.
 */
export type ImageInput = {
  filename: string;
  bytes: Uint8Array;
  parameters?: Record<string, string>;
};

export type ImageResult = {
  summary: string;
  outputs: { name: string; mime: string; bytes: Uint8Array }[];
};

const ALLOWED_SIZES = new Set([
  "256x256",
  "512x512",
  "1024x1024",
  "1024x1536",
  "1536x1024",
  "1792x1024",
  "1024x1792",
]);

export type ImageEndpoint = { baseUrl: string; model: string; key: string };

export function imageEndpoint(): ImageEndpoint | null {
  const key = process.env.IMAGE_API_KEY || process.env.OPENAI_API_KEY;
  if (!key) return null;
  const baseUrl = (
    process.env.IMAGE_BASE_URL ||
    process.env.AI_BASE_URL ||
    "https://api.openai.com/v1"
  ).replace(/\/+$/, "");
  const model = process.env.IMAGE_MODEL || "gpt-image-1";
  return { baseUrl, model, key };
}

function readPrompt(input: ImageInput): { prompt: string; inline: boolean } {
  const isJson = /\.json$/i.test(input.filename);
  if (isJson) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(new TextDecoder().decode(input.bytes));
    } catch {
      throw new Error("生成配置不是有效 JSON。");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("生成配置必须是 JSON 对象。");
    const config = parsed as Record<string, unknown>;
    if (typeof config.prompt !== "string" || !config.prompt.trim()) throw new Error("生成配置缺少 prompt。");
    if (config.prompt.length > 4000) throw new Error("prompt 超过 4000 字限制。");
    return { prompt: config.prompt.trim(), inline: false };
  }
  const prompt = (input.parameters?.prompt || "").trim();
  if (!prompt) throw new Error("请填写 prompt（要生成或修改的图像描述）。");
  if (prompt.length > 4000) throw new Error("prompt 超过 4000 字限制。");
  return { prompt, inline: true };
}

/** Editing an uploaded image needs a multipart `/images/edits` channel, which this adapter does not open. */
function rejectImageEdit(filename: string): never {
  throw new Error(
    `图像编辑通道未启用：${filename} 是图片文件，而当前适配器只支持文本生成图像（/images/generations）。不会用替代结果冒充编辑结果。`,
  );
}

export async function generateImage(input: ImageInput, event: (message: string) => void): Promise<ImageResult> {
  const endpoint = imageEndpoint();
  if (!endpoint) throw new Error("服务端未配置图像模型通道（IMAGE_API_KEY / IMAGE_BASE_URL / IMAGE_MODEL）。不会生成替代图片。");
  const { prompt } = readPrompt(input);
  const size = (input.parameters?.size || "1024x1024").trim();
  if (!ALLOWED_SIZES.has(size)) throw new Error(`不支持的尺寸 ${size}。允许：${[...ALLOWED_SIZES].join("、")}。`);
  const count = Math.min(4, Math.max(1, Number(input.parameters?.count || "1") || 1));
  if (/\.(png|jpe?g|webp)$/i.test(input.filename)) rejectImageEdit(input.filename);

  event(`正在向图像模型通道发送 1 条提示词（尺寸 ${size}，数量 ${count}）。`);
  const response = await fetch(`${endpoint.baseUrl}/images/generations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${endpoint.key}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ model: endpoint.model, prompt, size, n: count, response_format: "b64_json" }),
    signal: AbortSignal.timeout(120000),
  }).catch(error => {
    throw new Error(`图像模型请求失败：${error instanceof Error ? error.message : String(error)}`);
  });
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 400);
    throw new Error(`图像模型返回 HTTP ${response.status}：${detail || "没有返回详情"}`);
  }
  const body = (await response.json()) as { data?: { b64_json?: string; url?: string }[] };
  const images = body.data || [];
  if (!images.length) throw new Error("图像模型没有返回图片数据。");
  const outputs: ImageResult["outputs"] = [];
  const total = images.reduce((sum, item) => sum + (item.b64_json ? Math.ceil((item.b64_json.length * 3) / 4) : 0), 0);
  if (total > 8_000_000) throw new Error("生成图片总大小超过 8 MB 限制。");
  for (const [index, item] of images.entries()) {
    if (!item.b64_json) throw new Error("图像模型只返回了 URL，暂不支持下载外部图片链接；请改用返回内联图片的通道。");
    const bytes = new Uint8Array(Buffer.from(item.b64_json, "base64"));
    if (!bytes.length) throw new Error("图像模型返回了空图片。");
    outputs.push({ name: `generated-${index + 1}.png`, mime: "image/png", bytes });
  }
  const report = {
    tool: "image.generate",
    model: endpoint.model,
    endpointHost: new URL(endpoint.baseUrl).host,
    prompt,
    size,
    count: outputs.length,
    generatedAt: new Date().toISOString(),
    policy:
      "图片由服务端配置的第三方图像模型实际生成；模型输出不是版权、商标或事实保证，商用前须人工复核。",
  };
  outputs.push({ name: "image-generation-report.json", mime: "application/json", bytes: strToU8(JSON.stringify(report, null, 2)) });
  return {
    summary: `图像模型实际生成 ${outputs.length - 1} 张图片（模型 ${endpoint.model}，尺寸 ${size}）。输出为模型结果，未做版权或质量保证。`,
    outputs,
  };
}
