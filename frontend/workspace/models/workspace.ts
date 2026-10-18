export type EntityId = string;

export interface Expert {
  id: EntityId;
  name: string;
  description: string;
  skills: string[];
  capabilities: string[];
  status: "draft" | "active";
  createdAt: string;
}

export interface Skill {
  id: EntityId;
  name: string;
  description: string;
  category: string;
  status: "draft" | "published";
  createdAt: string;
}

export type ConnectorStatus = "disconnected" | "pending" | "connected" | "error";

export interface Connector {
  id: EntityId;
  name: string;
  description: string;
  provider: "google" | "microsoft" | "notion" | "github" | "custom";
  status: ConnectorStatus;
  scopes: string[];
  connectedAt?: string;
  /** Public configuration only; never store keys or authorization tokens here. */
  endpoint?: string;
  transport?: "streamable-http" | "sse";
}

export interface ApiError {
  message: string;
  status?: number;
}
