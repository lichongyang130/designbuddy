import type {
  ConnectorAuthType,
  ConnectorProvider,
  ConnectorStatus,
  ConnectorTransport,
} from "../../../../shared/connector-catalog";

export type { ConnectorAuthType, ConnectorProvider, ConnectorStatus, ConnectorTransport };

/**
 * The browser view of one connector.
 *
 * This is status metadata only. Credentials stay on the server: the browser
 * sends them once and receives back nothing but a masked hint.
 */
export interface Connector {
  id: string;
  name: string;
  description: string;
  /** The vendor family, used for grouping and for the OAuth redirect check. */
  provider: ConnectorProvider;
  status: ConnectorStatus;
  scopes: string[];
  connectedAt?: string;
  /** Public configuration only; never a key or a token. */
  endpoint?: string;
  transport?: ConnectorTransport;
  /** The connection methods the connector really supports. */
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

export interface OAuthStartResponse {
  authorizationUrl: string;
  state: string;
}
