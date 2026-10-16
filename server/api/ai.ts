export interface AIRequest {
  model?: string;
  prompt: string;
  systemPrompt?: string;
  userId: string;
  apiKey?: string;
  provider?: string;
}

export interface AIResponse {
  content: string;
  model: string;
}

interface OpenAIChatResponse {
  model?: string;
  choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
  error?: { message?: string };
}

export const AI_PROVIDER_ENDPOINTS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  deepseek: "https://api.deepseek.com/v1",
  groq: "https://api.groq.com/openai/v1",
  mistral: "https://api.mistral.ai/v1",
  google: "https://generativelanguage.googleapis.com/v1beta/openai",
};
export const AI_PROVIDER_MODELS: Record<string, string> = {
  openai: "gpt-4o-mini", openrouter: "openai/gpt-4o-mini", deepseek: "deepseek-chat",
  groq: "llama-3.3-70b-versatile", mistral: "mistral-small-latest", google: "gemini-2.5-flash",
};

/**
 * OpenAI-compatible provider adapter.
 * Configure AI_API_KEY (or OPENAI_API_KEY), AI_BASE_URL and AI_MODEL on the server.
 * No secret is exposed to the browser, and failures are returned instead of fake AI output.
 */
export async function requestAI(input: AIRequest): Promise<AIResponse> {
  if (!input.userId.trim()) throw new Error("An authenticated user is required.");
  if (!input.prompt.trim()) throw new Error("Prompt is required.");

  if (input.apiKey && (input.apiKey.length > 512 || !input.provider || !AI_PROVIDER_ENDPOINTS[input.provider])) throw new Error("Choose a supported provider and provide a valid API key.");
  const apiKey = input.apiKey || process.env.AI_API_KEY || process.env.OPENAI_API_KEY || "";
  if (!apiKey) throw new Error("AI provider is not configured. Set AI_API_KEY or OPENAI_API_KEY on the server.");

  const baseUrl = (input.apiKey ? AI_PROVIDER_ENDPOINTS[input.provider!] : process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = input.model || (input.apiKey ? AI_PROVIDER_MODELS[input.provider!] : process.env.AI_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const response = await fetch(baseUrl + "/chat/completions", {
      method: "POST",
      redirect: "error",
      signal: controller.signal,
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [
          ...(input.systemPrompt ? [{ role: "system", content: input.systemPrompt }] : []),
          { role: "user", content: input.prompt },
        ],
      }),
    });

    const raw = await response.text();
    let payload: OpenAIChatResponse;
    try {
      payload = JSON.parse(raw) as OpenAIChatResponse;
    } catch {
      throw new Error("AI provider returned an invalid JSON response.");
    }

    if (!response.ok) {
      throw new Error(payload.error?.message || "AI provider request failed with HTTP " + response.status + ".");
    }

    const message = payload.choices?.[0]?.message?.content;
    const content = typeof message === "string"
      ? message
      : Array.isArray(message)
        ? message.map((part) => part.text || "").join("\n")
        : "";
    if (!content.trim()) throw new Error("AI provider returned an empty response.");
    return { content, model: payload.model || model };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("AI provider request timed out after 60 seconds.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
