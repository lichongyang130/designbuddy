import { useState } from "react";

const STORAGE_KEY = "designbuddy.ai-provider.v1";
const providers = [
  ["openai", "OpenAI"], ["openrouter", "OpenRouter"], ["deepseek", "DeepSeek"],
  ["groq", "Groq"], ["mistral", "Mistral"], ["google", "Google Gemini"],
] as const;

function readSettings(): { provider: string; apiKey: string } {
  try {
    const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}");
    return { provider: typeof value.provider === "string" ? value.provider : "server", apiKey: typeof value.apiKey === "string" ? value.apiKey : "" };
  } catch { return { provider: "server", apiKey: "" }; }
}

export function getAIProviderCredentials(): { provider?: string; apiKey?: string } {
  const { provider, apiKey } = readSettings();
  return provider !== "server" && apiKey.trim() ? { provider, apiKey: apiKey.trim() } : {};
}

export function AIProviderSettings() {
  const [settings, setSettings] = useState(readSettings);
  function update(next: typeof settings) {
    setSettings(next);
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* Session storage may be disabled. */ }
  }
  return <details className="db-ai-provider-settings"><summary>AI Provider · {settings.provider === "server" ? "服务器配置" : providers.find(([id]) => id === settings.provider)?.[1] ?? settings.provider}</summary><div><label>服务商<select value={settings.provider} onChange={(event) => update({ ...settings, provider: event.target.value })}><option value="server">使用服务器默认配置</option>{providers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><label>API Key<input type="password" autoComplete="off" spellCheck={false} value={settings.apiKey} onChange={(event) => update({ ...settings, apiKey: event.target.value })} placeholder="留空时使用服务器配置"/></label><small>密钥仅保存在当前浏览器会话，并随生成请求发送；不会写入项目文件或数据库。服务地址由服务端固定，避免任意 URL 请求。</small></div></details>;
}
