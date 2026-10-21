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

import type {
  ConnectorAuthType,
  ConnectorProvider,
  ConnectorStatus,
  ConnectorTransport,
} from "../../../shared/connector-catalog";

export type { ConnectorAuthType, ConnectorProvider, ConnectorStatus, ConnectorTransport };

/**
 * The browser view of one connector: status metadata only. Credentials are
 * typed into the configuration form, sent to the server once, and never come
 * back - the server answers with a masked hint at most.
 */
export interface Connector {
  id: EntityId;
  name: string;
  description: string;
  provider: ConnectorProvider;
  status: ConnectorStatus;
  scopes: string[];
  connectedAt?: string;
  /** Public configuration only; never store keys or authorization tokens here. */
  endpoint?: string;
  transport?: ConnectorTransport;
  /** The connection methods this connector really supports. */
  authTypes?: ConnectorAuthType[];
  authType?: ConnectorAuthType;
  /** True once the server holds a credential or a complete configuration. */
  configured?: boolean;
  custom?: boolean;
  /** A masked tail such as `…7f3a`, never the credential itself. */
  credentialHint?: string;
  lastError?: string;
  lastCheckedAt?: number;
  note?: string;
  docsUrl?: string;
}

export interface ApiError {
  message: string;
  status?: number;
}
