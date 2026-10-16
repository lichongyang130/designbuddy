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
  /** Only entries with an existing provider adapter expose OAuth. */
  oauthProvider?: Connector["provider"];
  custom?: boolean;
  endpoint?: string;
  transport?: Connector["transport"];
}

// Reference catalog descriptions are illustrative, not claims of available integrations.
export const connectorCatalog: CatalogConnector[] = [
  { id: "gmail", name: "Gmail 邮箱", description: "通过 WorkBuddy 本地 Google 授权搜索、阅读和整理邮件。", icon: gmail },
  { id: "canva", name: "Canva可画", description: "无缝调用 Canva可画的设计能力。一句话生成设计与视觉内容。", icon: canva },
  { id: "github", name: "GitHub", description: "在 GitHub 上克隆、推送代码，查看和管理仓库、Issue 与 Pull Request。", icon: github, oauthProvider: "github" },
  { id: "notion", name: "Notion", description: "创建、搜索和管理 Notion 工作区。用自然语言整理知识与项目资料。", icon: notion, oauthProvider: "notion" },
  { id: "linear", name: "Linear", description: "管理 Linear 中的 Issues、项目、文档和发布计划。", icon: linear },
  { id: "tencent-meeting", name: "腾讯会议", description: "通过命令行创建、查询和管理腾讯会议。安排会议并整理会议信息。", icon: meeting },
  { id: "feishu", name: "飞书", description: "通过命令行管理飞书/Lark 全产品能力：即时消息、文档与协同空间。", icon: feishu },
  { id: "wecom", name: "企业微信", description: "企业微信官方 CLI 套件，覆盖消息、邮件与企业协作。", icon: wecom },
  { id: "dingtalk", name: "钉钉", description: "通过命令行管理钉钉全产品能力：AI 表格、文档与业务协同。", icon: dingtalk },
  { id: "textin", name: "TextIn xParse·智能文档解析", description: "通过命令行将文件（PDF、图片、Word 等）解析为结构化内容。", icon: textin },
  { id: "tiktok", name: "TikTok for Business", description: "TikTok for Business MCP Server 是基于营销场景的业务连接器。", icon: tiktok },
  { id: "wps", name: "金山文档|WPS云文档", description: "金山文档官方 Skill，对话即操作——知识、文档与团队协作。", icon: wps },
  { id: "edgeone", name: "EdgeOne Makers", description: "将项目部署到 EdgeOne Makers 并返回线上预览地址。", icon: edgeone },
  { id: "kling", name: "可灵 AI", description: "一句话，让灵感从想法变成大片。可灵（Kling）图像与视频创作。", icon: kling },
  { id: "futu", name: "富途牛牛", description: "富途牛牛是股票交易与行情数据连接器。整理金融市场信息。", icon: futu },
  { id: "moomoo", name: "Moomoo", description: "Moomoo is a stock trading and market data connector.", icon: moomoo },
  { id: "laiye", name: "来也智能文档专家", description: "让 Agent 直接读懂并处理业务文档。对话式提取和整理内容。", icon: laiye },
  { id: "xingcai", name: "星财富AI", description: "从你关心的问题出发，获得更清晰的金融信息与研究线索。", icon: xingcai },
  { id: "outlook", name: "Microsoft Outlook", description: "通过 Microsoft Graph 读取和管理 Outlook 邮件与日历。", icon: outlook },
  { id: "figma", name: "Figma", description: "连接设计文件与团队设计资产。" },
  { id: "database", name: "数据库", description: "为项目接入结构化数据源与查询工作流。" },
  { id: "cloud", name: "云服务", description: "连接部署、存储与运行环境。" },
];
