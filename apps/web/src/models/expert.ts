export interface Expert {
  id: string;
  name: string;
  description: string;
  avatarUrl?: string;
  skills: string[];
  capabilities: ExpertCapability[];
  connectorIds: string[];
  visibility: "private" | "workspace" | "public";
  createdAt?: string;
  updatedAt?: string;
}

export interface ExpertCapability {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  config?: Record<string, unknown>;
}

export type CreateExpertInput = Omit<Expert, "id" | "createdAt" | "updatedAt">;
