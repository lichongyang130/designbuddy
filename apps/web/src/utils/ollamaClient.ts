let OLLAMA_URL = 'http://localhost:11434';
let OLLAMA_MODEL = 'qwen2.5'; // or llama3

export function setOllamaConfig(url: string, model: string) {
  OLLAMA_URL = url;
  OLLAMA_MODEL = model;
}

export function getOllamaConfig() {
  return { url: OLLAMA_URL, model: OLLAMA_MODEL };
}

export async function askOllama(prompt: string): Promise<string> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: prompt,
        stream: false
      })
    });
    if (!res.ok) throw new Error('Ollama connection failed');
    const data = await res.json();
    return data.response || '';
  } catch (err) {
    console.error("Ollama Error:", err);
    throw err;
  }
}

export async function rewriteTextBatch(texts: Record<string, string>, style: string = "更具吸引力的营销话术"): Promise<Record<string, string>> {
  const prompt = `你是一个资深文案专家。请将以下JSON格式中的文案润色为${style}。
注意：仅润色文案，绝对不要改变JSON的键名(keys)！仅输出合法的JSON对象，不要有任何其他解释文字或Markdown代码块标记。

输入JSON：
${JSON.stringify(texts, null, 2)}
`;
  try {
    let raw = await askOllama(prompt);
    // Cleanup potential markdown fences
    raw = raw.replace(/```json/g, '').replace(/```/g, '').trim();
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      raw = raw.slice(start, end + 1);
    }
    const result = JSON.parse(raw);
    return result;
  } catch (e) {
    console.error("Batch rewrite failed, falling back to mock", e);
    // Fallback if offline/failed: append ✨ like before
    const fallback: Record<string, string> = {};
    for (const k in texts) {
       fallback[k] = `✨ AI 润色：${texts[k]}`;
    }
    return fallback;
  }
}
