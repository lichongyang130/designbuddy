import { useState } from "react";
import { usePreferences } from "./settingsStore";
import { translate } from "./i18n";
import {
  readAIProviderSettings,
  readCustomModelApiKey,
  writeAIProviderSettings,
} from "./aiProviderStorage";

const providers = [
  ["openai", "OpenAI"], ["openrouter", "OpenRouter"], ["deepseek", "DeepSeek"],
  ["groq", "Groq"], ["mistral", "Mistral"], ["google", "Google Gemini"],
] as const;

type ProviderCredentials = {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  options?: { maxTokens?: number };
};

export function getAIProviderCredentials(modelId?: string): ProviderCredentials {
  const model = modelId
    ? usePreferences.getState().models.find((item) => item.modelId === modelId)
    : undefined;
  const modelApiKey = model ? readCustomModelApiKey(model.modelId).trim() : "";
  const options = model?.outputTokens ? { options: { maxTokens: model.outputTokens } } : {};

  if (model && modelApiKey) {
    return {
      provider: model.provider || "custom",
      apiKey: modelApiKey,
      ...(model.provider === "custom" && model.baseUrl ? { baseUrl: model.baseUrl } : {}),
      ...options,
    };
  }

  const settings = readAIProviderSettings();
  return {
    ...(settings.provider !== "server" && settings.apiKey.trim()
      ? { provider: settings.provider, apiKey: settings.apiKey.trim() }
      : {}),
    ...options,
  };
}

export function AIProviderSettings() {
  const locale = usePreferences((state) => state.locale);
  const t = (key: string) => translate(locale, key);
  const [settings, setSettings] = useState(readAIProviderSettings);
  const [storageError, setStorageError] = useState("");
  function update(next: typeof settings) {
    try {
      writeAIProviderSettings(next);
      setSettings(next);
      setStorageError("");
    } catch {
      setStorageError(t("ai.storageError"));
    }
  }
  return <details className="db-ai-provider-settings"><summary>AI Provider · {settings.provider === "server" ? t("ai.server") : providers.find(([id]) => id === settings.provider)?.[1] ?? settings.provider}</summary><div><label>{t("ai.provider")}<select value={settings.provider} onChange={(event) => update({ ...settings, provider: event.target.value })}><option value="server">{t("ai.useServer")}</option>{providers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><label>API Key<input type="password" autoComplete="off" spellCheck={false} value={settings.apiKey} onChange={(event) => update({ ...settings, apiKey: event.target.value })} placeholder={t("ai.apiKey.ph")}/></label><small>{t("ai.note")}</small>{storageError && <small className="settings-error" role="alert">{storageError}</small>}</div></details>;
}
