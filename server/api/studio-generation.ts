import { requestAI } from "./ai";

export type StudioKind = "prototype" | "slides" | "image" | "video";
export interface StudioGenerationRequest {
  userId: string;
  kind: StudioKind;
  title: string;
  prompt: string;
  designContract?: string;
  model?: string;
  apiKey?: string;
  provider?: string;
}

function parseJson(content: string): unknown {
  let text = content.trim();
  if (text.startsWith("```")) text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(text); }
  catch { throw new Error("AI provider did not return valid JSON for the requested Studio artifact."); }
}

export async function generateStudioArtifact(input: StudioGenerationRequest): Promise<{ kind: StudioKind; artifact: Record<string, unknown>; model: string }> {
  const title = input.title.trim().slice(0, 120);
  const prompt = input.prompt.trim();
  if (!input.userId) throw new Error("An authenticated user is required to generate an artifact.");
  if (!prompt || prompt.length > 12_000) throw new Error("A prompt between 1 and 12,000 characters is required.");
  if (input.designContract && input.designContract.length > 24_000) throw new Error("The design contract is too long.");
  if (!(["prototype", "slides", "image", "video"] as string[]).includes(input.kind)) throw new Error("Unsupported Studio artifact type.");

  const formats: Record<StudioKind, string> = {
    prototype: '{"html":"complete standalone HTML document"}',
    slides: '{"slides":[{"title":"...","body":"...","bullets":["...","...","..."]}]} (4 to 8 slides)',
    image: '{"subtitle":"...","motif":[{"shape":"circle|rect","x":100,"y":100,"size":120}]} (4 to 16 abstract vector shapes; canvas is 1200x1200)',
    video: '{"scenes":[{"title":"...","caption":"..."}]} (5 timed scenes for a 10-second title animation)',
  };
  const result = await requestAI({
    userId: input.userId,
    apiKey: input.apiKey,
    provider: input.provider,
    model: input.model || process.env.AI_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini",
    systemPrompt: `You are a senior visual designer. Create high-quality ${input.kind} content from the brief and brand contract. Return only valid JSON matching this exact shape: ${formats[input.kind]}. Use concise Chinese content when the prompt is Chinese. Do not include markdown fences, external assets, tracking, or claims about unavailable backend features.`,
    prompt: [`Title: ${title}`, `Brief: ${prompt}`, input.designContract ? `DESIGN.md brand contract:\n${input.designContract}` : "No brand contract supplied.", "Generate a polished, specific first draft. JSON only."].join("\n\n"),
  });
  const parsed = parseJson(result.content);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("AI returned an invalid artifact.");
  const value = parsed as Record<string, unknown>;
  if (input.kind === "prototype") {
    if (typeof value.html !== "string" || !/<html[\s>]/i.test(value.html) || value.html.length > 500_000) throw new Error("AI returned an invalid HTML prototype.");
  } else if (input.kind === "slides") {
    if (!Array.isArray(value.slides) || value.slides.length < 4 || value.slides.length > 8 || value.slides.some((item) => !item || typeof item !== "object" || typeof (item as { title?: unknown }).title !== "string" || typeof (item as { body?: unknown }).body !== "string" || !Array.isArray((item as { bullets?: unknown }).bullets) || (item as { bullets: unknown[] }).bullets.length > 6 || (item as { bullets: unknown[] }).bullets.some((bullet) => typeof bullet !== "string"))) throw new Error("AI returned invalid slide content.");
  } else if (input.kind === "image") {
    if (typeof value.subtitle !== "string" || !value.subtitle.trim() || value.subtitle.length > 300) throw new Error("AI returned an invalid poster brief.");
    if (!Array.isArray(value.motif) || value.motif.length < 4 || value.motif.length > 16 || value.motif.some((shape) => !shape || typeof shape !== "object" || !["circle", "rect"].includes(String((shape as { shape?: unknown }).shape)) || !["x", "y", "size"].every((key) => Number.isFinite((shape as Record<string, unknown>)[key]) && Number((shape as Record<string, unknown>)[key]) >= 0 && Number((shape as Record<string, unknown>)[key]) <= 1200))) throw new Error("AI returned invalid vector poster shapes.");
  } else if (!Array.isArray(value.scenes) || value.scenes.length < 4 || value.scenes.length > 8 || value.scenes.some((item) => !item || typeof item !== "object" || typeof (item as { title?: unknown }).title !== "string" || typeof (item as { caption?: unknown }).caption !== "string")) {
    throw new Error("AI returned invalid video scenes.");
  }
  return { kind: input.kind, artifact: value, model: result.model };
}
