export type ConnectorAuthStatus = "disconnected" | "pending" | "connected" | "error";

export interface Connector {
  id: string;
  name: string;
  description: string;
  provider: "google" | "microsoft" | "notion" | "github" | "custom";
  iconUrl?: string;
  authStatus: ConnectorAuthStatus;
  scopes: string[];
  connectedAt?: string;
}

export interface OAuthStartResponse {
  authorizationUrl: string;
  state: string;
}
