/**
 * Shared connector catalogue.
 *
 * This file is the single source of truth for the 22 built-in connectors: the
 * browser uses it to render the market and the configuration form, the server
 * uses it to build the real OAuth URLs, the real credential headers and the
 * real connectivity probes. Nothing here contains a secret - every credential
 * is typed in by the person who owns it and stored encrypted on the server.
 *
 * Placeholders such as `{{token}}` or `{{access_token}}` are substituted on the
 * server, at request time, from the encrypted credential record. They are never
 * sent to the browser.
 */

export type ConnectorAuthType = "oauth" | "api_key" | "webhook" | "mcp";
export type ConnectorStatus = "disconnected" | "pending" | "connected" | "error";
export type ConnectorTransport = "streamable-http" | "sse";

export type ConnectorProvider =
  | "google"
  | "microsoft"
  | "notion"
  | "github"
  | "linear"
  | "figma"
  | "canva"
  | "tencent"
  | "feishu"
  | "wecom"
  | "dingtalk"
  | "textin"
  | "tiktok"
  | "wps"
  | "edgeone"
  | "kling"
  | "futu"
  | "moomoo"
  | "laiye"
  | "xingcai"
  | "self-hosted"
  | "custom";

export const connectorProviders: ConnectorProvider[] = [
  "google",
  "microsoft",
  "notion",
  "github",
  "linear",
  "figma",
  "canva",
  "tencent",
  "feishu",
  "wecom",
  "dingtalk",
  "textin",
  "tiktok",
  "wps",
  "edgeone",
  "kling",
  "futu",
  "moomoo",
  "laiye",
  "xingcai",
  "self-hosted",
  "custom",
];

export const connectorStatuses: ConnectorStatus[] = ["disconnected", "pending", "connected", "error"];

/** A credential input. The value is only ever sent to the server, never stored in the browser. */
export type ConnectorField = {
  key: string;
  label: string;
  kind: "text" | "password" | "url" | "select";
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: string[];
  /** Show a masked tail (for example `…7f3a`) in the connection summary. */
  hintable?: boolean;
};

/** A real HTTP request used to prove that a credential works. */
export type ConnectorProbe = {
  /** `{{field}}` placeholders are substituted server side. An empty url means "use the configured endpoint". */
  url: string;
  method?: "GET" | "POST" | "HEAD";
  headers?: Record<string, string>;
  body?: string;
  /** Status codes that count as a working connection. Defaults to any 2xx. */
  acceptStatus?: number[];
  /** When set, a 2xx answer is only accepted when the body contains one of these markers. */
  acceptBodyAny?: string[];
};

export type ConnectorOAuthSpec = {
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientIdEnv: string;
  clientSecretEnv: string;
  /** Extra query parameters on the authorization URL (for example Google's offline access). */
  authorizationParams?: Record<string, string>;
  /** RFC 7636 PKCE. On by default for every provider that documents it. */
  pkce?: boolean;
  /** How the client credentials are presented at the token endpoint. */
  tokenAuth?: "body" | "basic";
  /** The real request that proves the issued token works. */
  probe: ConnectorProbe;
  /** Provider endpoint used to revoke the token when the person disconnects. */
  revokeUrl?: string;
  revokeMethod?: "POST" | "GET" | "DELETE";
};

export type ConnectorApiKeySpec = {
  label: string;
  fields: ConnectorField[];
  /** Header template applied when no dedicated probe is documented. */
  headers?: Record<string, string>;
  /** The documented verification request. When missing, the person supplies the endpoint. */
  probe?: ConnectorProbe;
  /** True when the person must supply the endpoint because the catalogue ships no fixed one. */
  requiresEndpoint?: boolean;
};

export type ConnectorWebhookSignature = {
  algorithm: "hmac-sha256";
  encoding: "base64" | "hex";
  /** HMAC key template (for example `{{timestampMs}}\n{{secret}}`). */
  keyTemplate: string;
  /** HMAC message template. Providers that sign an empty message use "". */
  messageTemplate: string;
  bodyField?: string;
  queryField?: string;
  timestampBodyField?: string;
  timestampQueryField?: string;
  timestampUnit?: "s" | "ms";
};

export type ConnectorWebhookSpec = {
  /** JSON body template for the test delivery. Supports `{{timestamp}}` and credential fields. */
  bodyTemplate: string;
  signature?: ConnectorWebhookSignature;
  acceptStatus?: number[];
  acceptBodyAny?: string[];
  /** Extra query parameters that identify the bot (for example WeCom's `key`). */
  urlHint?: string;
};

export type ConnectorMcpSpec = {
  transports: ConnectorTransport[];
  defaultTransport: ConnectorTransport;
  /** Most MCP servers are personal and need a bearer token; some are open. */
  tokenField?: ConnectorField;
};

export type ConnectorDefinition = {
  id: string;
  name: string;
  description: string;
  provider: ConnectorProvider;
  /** The ways this connector can really be connected, in preference order. */
  authTypes: ConnectorAuthType[];
  oauth?: ConnectorOAuthSpec;
  apiKey?: ConnectorApiKeySpec;
  webhook?: ConnectorWebhookSpec;
  mcp?: ConnectorMcpSpec;
  /** Human readable note shown in the configuration screen. */
  note: string;
  docsUrl: string;
};

const MCP_TOKEN_FIELD: ConnectorField = {
  key: "token",
  label: "访问令牌（可选）",
  kind: "password",
  placeholder: "Bearer …",
  help: "若该 MCP 服务需要授权，填写令牌；服务端会以 Authorization: Bearer 头发送，不会回传给浏览器。",
  hintable: true,
};

const MCP_SPEC: ConnectorMcpSpec = {
  transports: ["streamable-http", "sse"],
  defaultTransport: "streamable-http",
  tokenField: MCP_TOKEN_FIELD,
};

/** A JSON body for the platforms whose webhook expects a plain text message. */
function textBody(text: string): string {
  return JSON.stringify({ msg_type: "text", content: { text } });
}

export const connectorDefinitions: ConnectorDefinition[] = [
  {
    id: "gmail",
    name: "Gmail 邮箱",
    description: "通过 WorkBuddy 本地 Google 授权搜索、阅读和整理邮件。",
    provider: "google",
    authTypes: ["oauth"],
    oauth: {
      authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
      clientIdEnv: "GOOGLE_CLIENT_ID",
      clientSecretEnv: "GOOGLE_CLIENT_SECRET",
      pkce: false,
      tokenAuth: "body",
      authorizationParams: { access_type: "offline", prompt: "consent" },
      probe: {
        url: "https://www.googleapis.com/gmail/v1/users/me/profile",
        headers: { Authorization: "Bearer {{access_token}}" },
      },
      revokeUrl: "https://oauth2.googleapis.com/revoke",
      revokeMethod: "POST",
    },
    note: "使用 Google OAuth 2.0 授权。服务端用拿到的令牌真实调用 Gmail API 校验后才能显示已连接。",
    docsUrl: "https://developers.google.com/gmail/api/guides",
  },
  {
    id: "canva",
    name: "Canva可画",
    description: "无缝调用 Canva可画的设计能力。一句话生成设计与视觉内容。",
    provider: "canva",
    authTypes: ["oauth", "mcp"],
    oauth: {
      authorizationUrl: "https://www.canva.com/api/oauth/authorize",
      tokenUrl: "https://api.canva.com/rest/v1/oauth/token",
      scopes: ["design:content:read", "design:content:write"],
      clientIdEnv: "CANVA_CLIENT_ID",
      clientSecretEnv: "CANVA_CLIENT_SECRET",
      pkce: true,
      tokenAuth: "body",
      probe: {
        url: "https://api.canva.com/rest/v1/users/me",
        headers: { Authorization: "Bearer {{access_token}}" },
      },
    },
    mcp: MCP_SPEC,
    note: "Canva Connect API 需要你在 Canva 开发者后台创建应用后配置 CANVA_CLIENT_ID / CANVA_CLIENT_SECRET。也可以直接连接自建的 Canva MCP 服务。",
    docsUrl: "https://www.canva.dev/docs/connect/",
  },
  {
    id: "github",
    name: "GitHub",
    description: "在 GitHub 上克隆、推送代码，查看和管理仓库、Issue 与 Pull Request。",
    provider: "github",
    authTypes: ["oauth", "api_key"],
    oauth: {
      authorizationUrl: "https://github.com/login/oauth/authorize",
      tokenUrl: "https://github.com/login/oauth/access_token",
      scopes: ["repo", "read:user"],
      clientIdEnv: "GITHUB_CLIENT_ID",
      clientSecretEnv: "GITHUB_CLIENT_SECRET",
      pkce: false,
      tokenAuth: "body",
      probe: {
        url: "https://api.github.com/user",
        headers: {
          Authorization: "Bearer {{access_token}}",
          Accept: "application/vnd.github+json",
          "User-Agent": "designbuddy",
        },
      },
      revokeUrl: "https://api.github.com/applications/{{client_id}}/token",
      revokeMethod: "DELETE",
    },
    apiKey: {
      label: "个人访问令牌（PAT）",
      fields: [
        {
          key: "token",
          label: "GitHub 访问令牌",
          kind: "password",
          placeholder: "github_pat_…",
          help: "fine-grained token 或 classic PAT，服务端只用于 Authorization 头。",
          required: true,
          hintable: true,
        },
      ],
      headers: {
        Authorization: "Bearer {{token}}",
        Accept: "application/vnd.github+json",
        "User-Agent": "designbuddy",
      },
      probe: {
        url: "https://api.github.com/user",
        headers: {
          Authorization: "Bearer {{token}}",
          Accept: "application/vnd.github+json",
          "User-Agent": "designbuddy",
        },
      },
    },
    note: "OAuth 使用服务端配置的 GitHub 应用；也可以直接粘贴个人访问令牌，服务端会真实请求 api.github.com 校验。",
    docsUrl: "https://docs.github.com/rest",
  },
  {
    id: "notion",
    name: "Notion",
    description: "创建、搜索和管理 Notion 工作区。用自然语言整理知识与项目资料。",
    provider: "notion",
    authTypes: ["oauth", "api_key"],
    oauth: {
      authorizationUrl: "https://api.notion.com/v1/oauth/authorize",
      tokenUrl: "https://api.notion.com/v1/oauth/token",
      scopes: [],
      clientIdEnv: "NOTION_CLIENT_ID",
      clientSecretEnv: "NOTION_CLIENT_SECRET",
      pkce: false,
      tokenAuth: "basic",
      authorizationParams: { owner: "user" },
      probe: {
        url: "https://api.notion.com/v1/users/me",
        headers: { Authorization: "Bearer {{access_token}}", "Notion-Version": "2022-06-28" },
      },
    },
    apiKey: {
      label: "内部集成令牌",
      fields: [
        {
          key: "token",
          label: "Notion 集成密钥",
          kind: "password",
          placeholder: "ntn_… / secret_…",
          help: "在 Notion 集成后台创建并授权给需要的页面。",
          required: true,
          hintable: true,
        },
      ],
      headers: { Authorization: "Bearer {{token}}", "Notion-Version": "2022-06-28" },
      probe: {
        url: "https://api.notion.com/v1/users/me",
        headers: { Authorization: "Bearer {{token}}", "Notion-Version": "2022-06-28" },
      },
    },
    note: "OAuth 走 Notion 公共集成；也可以粘贴内部集成密钥，服务端会真实请求 Notion API 校验。",
    docsUrl: "https://developers.notion.com/reference",
  },
  {
    id: "linear",
    name: "Linear",
    description: "管理 Linear 中的 Issues、项目、文档和发布计划。",
    provider: "linear",
    authTypes: ["oauth", "api_key"],
    oauth: {
      authorizationUrl: "https://linear.app/oauth/authorize",
      tokenUrl: "https://api.linear.app/oauth/token",
      scopes: ["read"],
      clientIdEnv: "LINEAR_CLIENT_ID",
      clientSecretEnv: "LINEAR_CLIENT_SECRET",
      pkce: false,
      tokenAuth: "body",
      authorizationParams: { actor: "user" },
      probe: {
        url: "https://api.linear.app/graphql",
        method: "POST",
        headers: { Authorization: "Bearer {{access_token}}", "Content-Type": "application/json" },
        body: JSON.stringify({ query: "{ viewer { id name email } }" }),
        acceptBodyAny: ['"viewer"'],
      },
    },
    apiKey: {
      label: "API 密钥",
      fields: [
        {
          key: "token",
          label: "Linear API 密钥",
          kind: "password",
          placeholder: "lin_api_…",
          required: true,
          hintable: true,
        },
      ],
      headers: { Authorization: "Bearer {{token}}", "Content-Type": "application/json" },
      probe: {
        url: "https://api.linear.app/graphql",
        method: "POST",
        headers: { Authorization: "Bearer {{token}}", "Content-Type": "application/json" },
        body: JSON.stringify({ query: "{ viewer { id name email } }" }),
        acceptBodyAny: ['"viewer"'],
      },
    },
    note: "OAuth 与 API 密钥都会真实请求 Linear GraphQL API（viewer 查询）后才标记为已连接。",
    docsUrl: "https://developers.linear.app/docs/graphql/working-with-the-graphql-api",
  },
  {
    id: "tencent-meeting",
    name: "腾讯会议",
    description: "通过命令行创建、查询和管理腾讯会议。安排会议并整理会议信息。",
    provider: "tencent",
    authTypes: ["mcp", "api_key"],
    mcp: MCP_SPEC,
    apiKey: {
      label: "开放平台凭据",
      fields: [
        { key: "secretId", label: "SecretId", kind: "password", required: true, hintable: true },
        { key: "secretKey", label: "SecretKey", kind: "password", required: true },
      ],
      headers: { "X-TC-Key": "{{secretId}}", "Content-Type": "application/json" },
      requiresEndpoint: true,
    },
    note: "腾讯会议以 MCP 服务或开放平台 REST 接口接入。填写真实服务地址后，服务端会发起真实握手/请求校验。",
    docsUrl: "https://cloud.tencent.com/document/product/1095",
  },
  {
    id: "feishu",
    name: "飞书",
    description: "通过命令行管理飞书/Lark 全产品能力：即时消息、文档与协同空间。",
    provider: "feishu",
    authTypes: ["webhook", "mcp", "api_key"],
    webhook: {
      bodyTemplate: textBody("DesignBuddy 连接器连通性测试 {{timestamp}}"),
      signature: {
        algorithm: "hmac-sha256",
        encoding: "base64",
        keyTemplate: "{{timestampSeconds}}\n{{secret}}",
        messageTemplate: "",
        timestampBodyField: "timestamp",
        bodyField: "sign",
        timestampUnit: "s",
      },
      acceptStatus: [200],
      acceptBodyAny: ['"code":0', '"StatusCode":0', '"errcode":0'],
    },
    mcp: MCP_SPEC,
    apiKey: {
      label: "应用凭据",
      fields: [
        { key: "appId", label: "App ID", kind: "text", required: true },
        { key: "appSecret", label: "App Secret", kind: "password", required: true, hintable: true },
      ],
      headers: { Authorization: "Bearer {{appSecret}}", "Content-Type": "application/json" },
      requiresEndpoint: true,
    },
    note: "自定义机器人 webhook 会真实发送一条带签名的测试消息（HMAC-SHA256），只有对方返回成功码才算连通。",
    docsUrl: "https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot",
  },
  {
    id: "wecom",
    name: "企业微信",
    description: "企业微信官方 CLI 套件，覆盖消息、邮件与企业协作。",
    provider: "wecom",
    authTypes: ["webhook", "mcp", "api_key"],
    webhook: {
      bodyTemplate: textBody("DesignBuddy 连接器连通性测试 {{timestamp}}"),
      acceptStatus: [200],
      acceptBodyAny: ['"errcode":0'],
      urlHint: "群机器人地址形如 https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=…",
    },
    mcp: MCP_SPEC,
    apiKey: {
      label: "应用凭据",
      fields: [
        { key: "corpId", label: "企业 ID（CorpID）", kind: "text", required: true },
        { key: "secret", label: "应用 Secret", kind: "password", required: true, hintable: true },
      ],
      headers: { "Content-Type": "application/json" },
      requiresEndpoint: true,
    },
    note: "群机器人 webhook 会真实推送一条测试消息；也可接入企业微信 MCP 服务或自建应用接口。",
    docsUrl: "https://developer.work.weixin.qq.com/document/path/91770",
  },
  {
    id: "dingtalk",
    name: "钉钉",
    description: "通过命令行管理钉钉全产品能力：AI 表格、文档与业务协同。",
    provider: "dingtalk",
    authTypes: ["webhook", "mcp", "api_key"],
    webhook: {
      bodyTemplate: textBody("DesignBuddy 连接器连通性测试 {{timestamp}}"),
      signature: {
        algorithm: "hmac-sha256",
        encoding: "base64",
        keyTemplate: "{{secret}}",
        messageTemplate: "{{timestampMs}}\n{{secret}}",
        timestampQueryField: "timestamp",
        queryField: "sign",
        timestampUnit: "ms",
      },
      acceptStatus: [200],
      acceptBodyAny: ['"errcode":0'],
    },
    mcp: MCP_SPEC,
    apiKey: {
      label: "应用凭据",
      fields: [
        { key: "appKey", label: "AppKey", kind: "text", required: true },
        { key: "appSecret", label: "AppSecret", kind: "password", required: true, hintable: true },
      ],
      headers: { "Content-Type": "application/json" },
      requiresEndpoint: true,
    },
    note: "自定义机器人加签模式：服务端按钉钉文档计算 HMAC-SHA256 签名并真实发送测试消息。",
    docsUrl: "https://open.dingtalk.com/document/robots/customize-robot-security-settings",
  },
  {
    id: "textin",
    name: "TextIn xParse·智能文档解析",
    description: "通过命令行将文件（PDF、图片、Word 等）解析为结构化内容。",
    provider: "textin",
    authTypes: ["api_key", "mcp"],
    apiKey: {
      label: "xParse 凭据",
      fields: [
        { key: "appId", label: "x-ti-app-id", kind: "text", required: true },
        { key: "secretCode", label: "x-ti-secret-code", kind: "password", required: true, hintable: true },
      ],
      headers: { "x-ti-app-id": "{{appId}}", "x-ti-secret-code": "{{secretCode}}" },
      requiresEndpoint: true,
    },
    mcp: MCP_SPEC,
    note: "填写你在 TextIn 控制台拿到的凭据与解析接口地址，服务端会用真实请求校验连通性。",
    docsUrl: "https://www.textin.com/",
  },
  {
    id: "tiktok",
    name: "TikTok for Business",
    description: "TikTok for Business MCP Server 是基于营销场景的业务连接器。",
    provider: "tiktok",
    authTypes: ["mcp", "api_key"],
    mcp: MCP_SPEC,
    apiKey: {
      label: "Marketing API 凭据",
      fields: [
        {
          key: "token",
          label: "Access Token",
          kind: "password",
          required: true,
          hintable: true,
        },
      ],
      headers: { "Access-Token": "{{token}}", "Content-Type": "application/json" },
      requiresEndpoint: true,
    },
    note: "以 MCP 服务接入营销能力；也可以直接填写 Marketing API 的访问令牌与接口地址。",
    docsUrl: "https://business-api.tiktok.com/portal/docs",
  },
  {
    id: "wps",
    name: "金山文档|WPS云文档",
    description: "金山文档官方 Skill，对话即操作——知识、文档与团队协作。",
    provider: "wps",
    authTypes: ["mcp", "api_key"],
    mcp: MCP_SPEC,
    apiKey: {
      label: "开放平台凭据",
      fields: [
        { key: "appId", label: "App ID", kind: "text", required: true },
        { key: "appSecret", label: "App Secret", kind: "password", required: true, hintable: true },
      ],
      headers: { "Content-Type": "application/json", "X-App-Id": "{{appId}}" },
      requiresEndpoint: true,
    },
    note: "接入 WPS 365 / 金山文档开放接口或官方 MCP 服务后，服务端用真实请求校验。",
    docsUrl: "https://solution.wps.cn/",
  },
  {
    id: "edgeone",
    name: "EdgeOne Makers",
    description: "将项目部署到 EdgeOne Makers 并返回线上预览地址。",
    provider: "edgeone",
    authTypes: ["mcp", "api_key"],
    mcp: MCP_SPEC,
    apiKey: {
      label: "API 令牌",
      fields: [
        { key: "token", label: "API Token", kind: "password", required: true, hintable: true },
      ],
      headers: { Authorization: "Bearer {{token}}", "Content-Type": "application/json" },
      requiresEndpoint: true,
    },
    note: "通过 EdgeOne MCP 服务或开放接口部署项目；连接前服务端会真实握手验证。",
    docsUrl: "https://edgeone.ai/products/pages",
  },
  {
    id: "kling",
    name: "可灵 AI",
    description: "一句话，让灵感从想法变成大片。可灵（Kling）图像与视频创作。",
    provider: "kling",
    authTypes: ["api_key", "mcp"],
    apiKey: {
      label: "API 密钥",
      fields: [
        { key: "accessKey", label: "AccessKey", kind: "text", required: true, hintable: true },
        { key: "secretKey", label: "SecretKey", kind: "password", required: true },
      ],
      headers: { Authorization: "Bearer {{accessKey}}", "Content-Type": "application/json" },
      requiresEndpoint: true,
    },
    mcp: MCP_SPEC,
    note: "填写可灵开放平台的密钥与接口地址，服务端会发起真实请求确认可用。",
    docsUrl: "https://app.klingai.com/global/dev/document-api",
  },
  {
    id: "futu",
    name: "富途牛牛",
    description: "富途牛牛是股票交易与行情数据连接器。整理金融市场信息。",
    provider: "futu",
    authTypes: ["mcp", "api_key"],
    mcp: MCP_SPEC,
    apiKey: {
      label: "OpenD 凭据",
      fields: [
        { key: "token", label: "访问令牌（可选）", kind: "password", hintable: true },
      ],
      headers: { "Content-Type": "application/json", Authorization: "Bearer {{token}}" },
      requiresEndpoint: true,
    },
    note: "富途通过本机 OpenD 或自建 MCP 服务接入，服务端只连接你填写的地址。",
    docsUrl: "https://openapi.futunn.com/",
  },
  {
    id: "moomoo",
    name: "Moomoo",
    description: "Moomoo is a stock trading and market data connector.",
    provider: "moomoo",
    authTypes: ["mcp", "api_key"],
    mcp: MCP_SPEC,
    apiKey: {
      label: "OpenD 凭据",
      fields: [
        { key: "token", label: "访问令牌（可选）", kind: "password", hintable: true },
      ],
      headers: { "Content-Type": "application/json", Authorization: "Bearer {{token}}" },
      requiresEndpoint: true,
    },
    note: "Moomoo connects through a local OpenD gateway or your own MCP server; the server only dials the address you enter.",
    docsUrl: "https://openapi.moomoo.com/",
  },
  {
    id: "laiye",
    name: "来也智能文档专家",
    description: "让 Agent 直接读懂并处理业务文档。对话式提取和整理内容。",
    provider: "laiye",
    authTypes: ["api_key", "mcp"],
    apiKey: {
      label: "平台凭据",
      fields: [
        { key: "appKey", label: "App Key", kind: "text", required: true },
        { key: "appSecret", label: "App Secret", kind: "password", required: true, hintable: true },
      ],
      headers: { "Content-Type": "application/json", "X-App-Key": "{{appKey}}" },
      requiresEndpoint: true,
    },
    mcp: MCP_SPEC,
    note: "填写来也开放平台的应用凭据与接口地址，服务端用真实请求校验。",
    docsUrl: "https://www.laiye.com/",
  },
  {
    id: "xingcai",
    name: "星财富AI",
    description: "从你关心的问题出发，获得更清晰的金融信息与研究线索。",
    provider: "xingcai",
    authTypes: ["api_key", "mcp"],
    apiKey: {
      label: "API 密钥",
      fields: [
        { key: "token", label: "API Key", kind: "password", required: true, hintable: true },
      ],
      headers: { Authorization: "Bearer {{token}}", "Content-Type": "application/json" },
      requiresEndpoint: true,
    },
    mcp: MCP_SPEC,
    note: "填写星财富开放接口的密钥与地址，服务端会真实请求校验后再标记已连接。",
    docsUrl: "https://www.xingcai.com/",
  },
  {
    id: "outlook",
    name: "Microsoft Outlook",
    description: "通过 Microsoft Graph 读取和管理 Outlook 邮件与日历。",
    provider: "microsoft",
    authTypes: ["oauth"],
    oauth: {
      authorizationUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      scopes: ["openid", "profile", "offline_access", "Mail.Read", "Calendars.Read"],
      clientIdEnv: "MICROSOFT_CLIENT_ID",
      clientSecretEnv: "MICROSOFT_CLIENT_SECRET",
      pkce: false,
      tokenAuth: "body",
      probe: {
        url: "https://graph.microsoft.com/v1.0/me",
        headers: { Authorization: "Bearer {{access_token}}" },
      },
    },
    note: "Microsoft 身份平台 OAuth 授权，服务端用 Graph /me 真实校验令牌。",
    docsUrl: "https://learn.microsoft.com/graph/api/user-get",
  },
  {
    id: "figma",
    name: "Figma",
    description: "连接设计文件与团队设计资产。",
    provider: "figma",
    authTypes: ["oauth", "api_key"],
    oauth: {
      authorizationUrl: "https://www.figma.com/oauth",
      tokenUrl: "https://www.figma.com/api/oauth/token",
      scopes: ["files:read"],
      clientIdEnv: "FIGMA_CLIENT_ID",
      clientSecretEnv: "FIGMA_CLIENT_SECRET",
      pkce: false,
      tokenAuth: "body",
      probe: {
        url: "https://api.figma.com/v1/me",
        headers: { Authorization: "Bearer {{access_token}}" },
      },
    },
    apiKey: {
      label: "个人访问令牌",
      fields: [
        {
          key: "token",
          label: "Figma Personal Access Token",
          kind: "password",
          required: true,
          hintable: true,
        },
      ],
      headers: { "X-Figma-Token": "{{token}}" },
      probe: { url: "https://api.figma.com/v1/me", headers: { "X-Figma-Token": "{{token}}" } },
    },
    note: "OAuth 或 Figma 个人访问令牌都会真实请求 api.figma.com/v1/me 校验。",
    docsUrl: "https://www.figma.com/developers/api",
  },
  {
    id: "database",
    name: "数据库",
    description: "为项目接入结构化数据源与查询工作流。",
    provider: "self-hosted",
    authTypes: ["mcp", "api_key"],
    mcp: MCP_SPEC,
    apiKey: {
      label: "数据源凭据",
      fields: [
        { key: "token", label: "访问令牌 / 密码", kind: "password", required: true, hintable: true },
      ],
      headers: { Authorization: "Bearer {{token}}", "Content-Type": "application/json" },
      requiresEndpoint: true,
    },
    note: "推荐使用 MCP 数据库服务（Postgres / MySQL / SQLite / BigQuery 等）接入；服务端会真实握手探测。",
    docsUrl: "https://modelcontextprotocol.io/",
  },
  {
    id: "cloud",
    name: "云服务",
    description: "连接部署、存储与运行环境。",
    provider: "self-hosted",
    authTypes: ["mcp", "api_key"],
    mcp: MCP_SPEC,
    apiKey: {
      label: "云 API 凭据",
      fields: [
        { key: "token", label: "Access Token", kind: "password", required: true, hintable: true },
      ],
      headers: { Authorization: "Bearer {{token}}", "Content-Type": "application/json" },
      requiresEndpoint: true,
    },
    note: "连接云厂商 MCP 服务或自建部署接口；连接前服务端会发起真实请求校验。",
    docsUrl: "https://modelcontextprotocol.io/",
  },
];

export const connectorDefinitionById = new Map(connectorDefinitions.map((item) => [item.id, item]));

export function findConnectorDefinition(id: string): ConnectorDefinition | undefined {
  return connectorDefinitionById.get(id);
}

export function isConnectorProvider(value: unknown): value is ConnectorProvider {
  return typeof value === "string" && (connectorProviders as string[]).includes(value);
}

/** The auth types a definition really supports, always non-empty. */
export function authTypesOf(definition: ConnectorDefinition | undefined): ConnectorAuthType[] {
  if (!definition) return ["mcp"];
  return definition.authTypes.length ? definition.authTypes : ["mcp"];
}

export const connectorAuthTypes: ConnectorAuthType[] = ["oauth", "api_key", "webhook", "mcp"];

export const connectorAuthLabels: Record<ConnectorAuthType, string> = {
  oauth: "OAuth 授权",
  api_key: "API Key",
  webhook: "Webhook",
  mcp: "MCP 服务",
};

/** Which fields the browser must collect for one auth type. */
export function fieldsForAuthType(definition: ConnectorDefinition, authType: ConnectorAuthType): ConnectorField[] {
  if (authType === "api_key") return definition.apiKey?.fields ?? [];
  if (authType === "webhook") {
    const sign = definition.webhook?.signature;
    return [
      {
        key: "endpoint",
        label: "Webhook 地址",
        kind: "url",
        required: true,
        placeholder: definition.webhook?.urlHint || "https://…",
        help: definition.webhook?.urlHint,
      },
      ...(sign
        ? [
            {
              key: "secret",
              label: "签名密钥",
              kind: "password" as const,
              required: true,
              hintable: true,
              help: "仅用于计算 HMAC 签名，服务端加密保存，浏览器不会留存。",
            },
          ]
        : []),
    ];
  }
  if (authType === "mcp") {
    return [
      { key: "endpoint", label: "服务地址", kind: "url", required: true, placeholder: "https://your-server.example/mcp" },
      {
        key: "transport",
        label: "传输协议",
        kind: "select" as const,
        options: definition.mcp?.transports ?? ["streamable-http", "sse"],
      },
      ...(definition.mcp?.tokenField ? [{ ...definition.mcp.tokenField }] : []),
    ];
  }
  return [];
}

/** True when the auth type needs a URL from the person configuring it. */
export function authTypeNeedsEndpoint(authType: ConnectorAuthType): boolean {
  return authType === "webhook" || authType === "mcp";
}
