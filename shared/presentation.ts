import type { PresentationVisualStyle } from "./presentationDesign";
/** First commercial-generation milestone. Not the P2 arbitrary-page editor. */
export const presentationLimits = {
  files: 5,
  fileBytes: 2_000_000,
  totalBytes: 10_000_000,
  envelopeBytes: 13_600_000,
  sourceCharacters: 40_000,
  slides: 25,
} as const;
export type PresentationBrief = {
  goal: string;
  audience: string;
  scenario: "business-report" | "pitch-deck" | "data-analysis";
  theme: "consulting" | "corporate" | "technology";
  slideCount: number;
  layoutStyle?: "classic" | "adaptive";
  visualStyle?: PresentationVisualStyle;
  logoAssetId?: string;
  narrativeMode?: "directed";
};
export type PresentationRequest = {
  schemaVersion: 1;
  brief: PresentationBrief;
  files: { name: string; base64: string }[];
  assets?: PresentationAssetInput[];
};
export type PresentationBlock = {
  id: string;
  sourceId: string;
  locator: string;
  text: string;
};
export type PresentationDataset = {
  id: string;
  sourceId: string;
  sheet: string;
  headers: string[];
  rows: { row: number; values: string[] }[];
};
export type PresentationSources = {
  inputHash: string;
  files: { id: string; name: string; sha256: string; bytes: number }[];
  blocks: PresentationBlock[];
  datasets: PresentationDataset[];
  warnings: string[];
  assets?: PresentationAsset[];
};
export type PresentationCheckpoint = {
  kind: "presentation";
  schemaVersion: 1;
  inputHash: string;
  plannerModel?: string;
  usage?: unknown[];
} & (
  | { stage: "planned"; spec: unknown }
  | { stage: "directed"; direction: unknown; writerAttempts?: number }
);

/** Raster assets are separate from factual document parsing; no OCR or remote fetch is implicit. */
export type PresentationAssetInput = {
  id: string;
  name: string;
  base64: string;
  role: "logo" | "screenshot" | "illustration" | "photo";
  usage: "decorative" | "evidence";
  alt: string;
  source: string;
  license: string;
  permissionConfirmed: true;
};
export type PresentationAsset = Omit<PresentationAssetInput, "base64"> & {
  originalSHA256: string;
  sha256: string;
  width: number;
  height: number;
  mimeType: "image/png";
  /** Runtime-only normalized raster; never included in model prompts/provenance JSON. */
  data: string;
};
