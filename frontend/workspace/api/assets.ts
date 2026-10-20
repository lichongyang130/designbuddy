import { apiFetch, readJSON } from "../../../apps/web/src/api/client";

/** Who may see a stored file. */
export type AssetVisibility = "private" | "workspace" | "public";

export type Asset = {
  id: string;
  ownerId: string;
  name: string;
  mime: string;
  size: number;
  sha256: string;
  createdAt: number;
  visibility: AssetVisibility;
  /** The text the server parsed out of the file, empty for binary files. */
  excerpt: string;
  /** True when the server really read the content as text. */
  extracted: boolean;
};

export type AssetEvent = {
  id: number;
  assetId: string;
  ownerId: string;
  action: "asset.upload" | "asset.visibility" | "asset.delete";
  createdAt: number;
};

export const VISIBILITY_LABELS: Record<AssetVisibility, string> = {
  private: "仅自己可见",
  workspace: "工作空间可见",
  public: "已公开",
};

export function assetVisibilityLabel(visibility: AssetVisibility): string {
  return VISIBILITY_LABELS[visibility] ?? "未知范围";
}

export function formatAssetSize(size: number): string {
  if (size < 1000) return `${size} B`;
  if (size < 1000_000) return `${(size / 1000).toFixed(1)} KB`;
  return `${(size / 1000_000).toFixed(1)} MB`;
}

/** The files the server lets this account see. */
export async function listAssets(): Promise<Asset[]> {
  const body = await readJSON<{ assets?: Asset[] }>(
    await apiFetch("/assets", { headers: { Accept: "application/json" } }),
  );
  return Array.isArray(body.assets) ? body.assets : [];
}

/**
 * Upload a file into the server library. The server stores the bytes, records
 * a fingerprint and parses text files, so the browser does not have to.
 */
export async function uploadAsset(file: File, visibility: AssetVisibility = "private"): Promise<Asset> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < buffer.length; index += chunk) {
    binary += String.fromCharCode(...buffer.subarray(index, index + chunk));
  }
  const body = await readJSON<{ asset: Asset }>(
    await apiFetch("/assets", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        name: file.name,
        mime: file.type || "application/octet-stream",
        dataBase64: btoa(binary),
        visibility,
      }),
    }),
  );
  return body.asset;
}

/** Change who may see a file. Only the owner may do this. */
export async function setAssetVisibility(id: string, visibility: AssetVisibility): Promise<Asset> {
  const body = await readJSON<{ asset: Asset }>(
    await apiFetch(`/assets/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ visibility }),
    }),
  );
  return body.asset;
}

/** Delete a file and its stored bytes. Only the owner may do this. */
export async function deleteAsset(id: string): Promise<void> {
  await readJSON<{ ok: boolean }>(
    await apiFetch(`/assets/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
    }),
  );
}

/** The text the server parsed out of a file. */
export async function fetchAssetText(id: string): Promise<string> {
  const body = await readJSON<{ text: string }>(
    await apiFetch(`/assets/${encodeURIComponent(id)}/content`, { headers: { Accept: "application/json" } }),
  );
  return typeof body.text === "string" ? body.text : "";
}

/** The raw bytes of a file (images etc) as base64 data URL helper. */
export async function fetchAssetRaw(id: string): Promise<{ mime: string; dataBase64: string; name: string }> {
  const body = await readJSON<{ mime: string; dataBase64: string; name: string }>(
    await apiFetch(`/assets/${encodeURIComponent(id)}/raw`, { headers: { Accept: "application/json" } }),
  );
  return { mime: body.mime || "application/octet-stream", dataBase64: body.dataBase64 || "", name: body.name || id };
}

export function assetToDataUrl(mime: string, base64: string): string {
  return `data:${mime};base64,${base64}`;
}

/** The change history of one file. */
export async function listAssetEvents(id: string): Promise<AssetEvent[]> {
  const body = await readJSON<{ events?: AssetEvent[] }>(
    await apiFetch(`/assets/${encodeURIComponent(id)}/events`, { headers: { Accept: "application/json" } }),
  );
  return Array.isArray(body.events) ? body.events : [];
}
