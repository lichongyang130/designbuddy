import { connectorDefinitions, type ConnectorAuthType, type ConnectorProvider } from "../../shared/connector-catalog";
import type { Connector } from "./models/workspace";
import gmail from "../../apps/web/src/assets/connectors/gmail.png";
import canva from "../../apps/web/src/assets/connectors/canva.png";
import github from "../../apps/web/src/assets/connectors/github.png";
import notion from "../../apps/web/src/assets/connectors/notion.png";
import linear from "../../apps/web/src/assets/connectors/linear.png";
import meeting from "../../apps/web/src/assets/connectors/tencent-meeting.png";
import feishu from "../../apps/web/src/assets/connectors/feishu.png";
import wecom from "../../apps/web/src/assets/connectors/wecom.png";
import dingtalk from "../../apps/web/src/assets/connectors/dingtalk.png";
import textin from "../../apps/web/src/assets/connectors/textin.png";
import tiktok from "../../apps/web/src/assets/connectors/tiktok.png";
import wps from "../../apps/web/src/assets/connectors/wps.png";
import edgeone from "../../apps/web/src/assets/connectors/edgeone.png";
import kling from "../../apps/web/src/assets/connectors/kling.png";
import futu from "../../apps/web/src/assets/connectors/futu.png";
import moomoo from "../../apps/web/src/assets/connectors/moomoo.png";
import laiye from "../../apps/web/src/assets/connectors/laiye.png";
import xingcai from "../../apps/web/src/assets/connectors/xingcai.png";
import outlook from "../../apps/web/src/assets/connectors/outlook.png";

export interface CatalogConnector {
  id: string;
  name: string;
  description: string;
  icon?: string;
  /** Only entries with a server side OAuth app expose the authorize action. */
  oauthProvider?: Connector["provider"];
  /** The connection methods the server can really verify for this connector. */
  authTypes: ConnectorAuthType[];
  provider: ConnectorProvider;
  note: string;
  docsUrl: string;
  custom?: boolean;
}

/** Branding only: names, descriptions and connection methods come from the shared catalogue. */
const icons: Record<string, string> = {
  gmail,
  canva,
  github,
  notion,
  linear,
  "tencent-meeting": meeting,
  feishu,
  wecom,
  dingtalk,
  textin,
  tiktok,
  wps,
  edgeone,
  kling,
  futu,
  moomoo,
  laiye,
  xingcai,
  outlook,
};

export const connectorCatalog: CatalogConnector[] = connectorDefinitions.map((definition) => ({
  id: definition.id,
  name: definition.name,
  description: definition.description,
  ...(icons[definition.id] ? { icon: icons[definition.id] } : {}),
  ...(definition.oauth ? { oauthProvider: definition.provider } : {}),
  authTypes: definition.authTypes,
  provider: definition.provider,
  note: definition.note,
  docsUrl: definition.docsUrl,
}));

export const connectorCatalogById = new Map(connectorCatalog.map((item) => [item.id, item]));

export function findCatalogConnector(id: string): CatalogConnector | undefined {
  return connectorCatalogById.get(id);
}

export const connectorAuthLabels: Record<ConnectorAuthType, string> = {
  oauth: "OAuth 授权",
  api_key: "API Key",
  webhook: "Webhook",
  mcp: "MCP 服务",
};
