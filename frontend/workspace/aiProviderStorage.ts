const STORAGE_KEY = "designbuddy.ai-provider.v1";

type StoredProviderSettings = {
  provider: string;
  apiKey: string;
  modelKeys: Record<string, string>;
};

function readStored(): StoredProviderSettings {
  try {
    const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}");
    const modelKeys = value && typeof value.modelKeys === "object" && !Array.isArray(value.modelKeys)
      ? Object.fromEntries(Object.entries(value.modelKeys).filter(([id, key]) =>
          typeof id === "string" && id.length <= 128 && typeof key === "string" && key.length <= 512,
        )) as Record<string, string>
      : {};
    return {
      provider: typeof value.provider === "string" ? value.provider : "server",
      apiKey: typeof value.apiKey === "string" ? value.apiKey : "",
      modelKeys,
    };
  } catch {
    return { provider: "server", apiKey: "", modelKeys: {} };
  }
}

function writeStored(next: StoredProviderSettings): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function readAIProviderSettings(): { provider: string; apiKey: string } {
  const value = readStored();
  return { provider: value.provider, apiKey: value.apiKey };
}

export function writeAIProviderSettings(next: { provider: string; apiKey: string }): void {
  const current = readStored();
  writeStored({ ...current, ...next });
}

export function readCustomModelApiKey(modelId: string): string {
  return readStored().modelKeys[modelId] || "";
}

export function writeCustomModelApiKey(modelId: string, apiKey: string): void {
  const current = readStored();
  const modelKeys = { ...current.modelKeys };
  if (apiKey) modelKeys[modelId] = apiKey;
  else delete modelKeys[modelId];
  writeStored({ ...current, modelKeys });
}

export function removeCustomModelApiKey(modelId: string): void {
  writeCustomModelApiKey(modelId, "");
}
