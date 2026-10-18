import type { SkillInput } from "./executors";
import { json, out, text, xml } from "./io";

const textField = (value: unknown, max: number, required = true): value is string => typeof value === "string" && value.length <= max && (!required || !!value.trim());
const color = (value: unknown): value is string => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
function safeUrl(value: unknown): string | null {
  if (value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > 1000 || /[\x00-\x20\x7f]/.test(value)) throw Error("CTA链接格式不合法。");
  let url: URL;
  try { url = new URL(value); } catch { throw Error("CTA必须是完整的https://或mailto:链接。"); }
  if (url.protocol === "https:") {
    if (url.username || url.password || /^(localhost|127\.|0\.0\.0\.0|\[::1\])$/i.test(url.hostname)) throw Error("CTA不能使用本地地址或包含凭据的链接。");
    return url.toString();
  }
  if (url.protocol === "mailto:" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(url.pathname)) return url.toString();
  throw Error("CTA链接只支持https://或有效mailto:地址。");
}

export async function emailMarketing(input: SkillInput, event: (message: string) => void) {
  let data: any;
  try { data = JSON.parse(text(input.bytes)); } catch { throw Error("邮件模板配置必须是有效JSON。"); }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw Error("邮件模板根节点必须是对象。");
  const allowed = ["subject", "preheader", "brand", "title", "intro", "sections", "cta", "footer", "palette"];
  if (Object.keys(data).some(key => !allowed.includes(key))) throw Error("邮件模板包含不支持字段。");
  const required: [string, number][] = [["subject", 120], ["title", 120], ["intro", 1000], ["brand", 80]];
  for (const [key, limit] of required) if (!textField(data[key], limit)) throw Error(`${key} 必填且最多${limit}字。`);
  for (const [key, limit] of [["preheader", 160], ["footer", 500]] as [string, number][]) if (data[key] !== undefined && !textField(data[key], limit, false)) throw Error(`${key}最多${limit}字。`);
  if (!Array.isArray(data.sections) || data.sections.length > 5 || data.sections.some((s: any) => !s || typeof s !== "object" || Array.isArray(s) || Object.keys(s).some(k => !["heading", "body"].includes(k)) || !textField(s.heading, 120) || !textField(s.body, 1200))) throw Error("sections须为0至5组有效标题/正文，每段正文最多1200字。");
  const palette = data.palette;
  if (!palette || typeof palette !== "object" || Array.isArray(palette) || Object.keys(palette).some(k => !["primary", "background", "text"].includes(k)) || !color(palette.primary) || !color(palette.background) || !color(palette.text)) throw Error("palette须提供primary、background、text三个六位十六进制颜色。");
  let cta: { label: string; url: string } | null = null;
  if (data.cta !== undefined && data.cta !== null) {
    if (typeof data.cta !== "object" || Array.isArray(data.cta) || Object.keys(data.cta).some(k => !["label", "url"].includes(k)) || !textField(data.cta.label, 64)) throw Error("CTA须包含最多64字的按钮文字和链接。");
    const url = safeUrl(data.cta.url);
    if (!url) throw Error("填写CTA后必须提供目标链接。");
    cta = { label: data.cta.label, url };
  }
  const preheader = data.preheader || data.intro.slice(0, 120);
  const sections = data.sections.map((s: any) => `<tr><td style="padding:12px 36px 4px;font-family:Arial,sans-serif;color:${palette.text};font-size:20px;line-height:28px;font-weight:bold">${xml(s.heading)}</td></tr><tr><td style="padding:4px 36px 20px;font-family:Arial,sans-serif;color:${palette.text};font-size:16px;line-height:26px">${xml(s.body).replace(/\r?\n/g, "<br>")}</td></tr>`).join("");
  const ctaMarkup = cta ? `<tr><td align="center" style="padding:16px 36px 36px"><a href="${xml(cta.url)}" style="display:inline-block;padding:15px 26px;background:${palette.primary};color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:16px;line-height:20px;font-weight:bold;border-radius:6px">${xml(cta.label)}</a></td></tr>` : "";
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>${xml(data.subject)}</title><style>body{margin:0!important;padding:0!important;background:${palette.background}}table{border-collapse:collapse}a{color:${palette.primary}}@media only screen and (max-width:620px){.outer{width:100%!important}.pad{padding-left:22px!important;padding-right:22px!important}.title{font-size:30px!important;line-height:38px!important}}</style></head><body style="margin:0;padding:0;background:${palette.background}"><div style="display:none;font-size:1px;color:${palette.background};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">${xml(preheader)}&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${palette.background}"><tr><td align="center" style="padding:28px 12px"><table role="presentation" class="outer" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden"><tr><td class="pad" style="padding:26px 36px 16px;color:${palette.primary};font-family:Arial,sans-serif;font-size:13px;line-height:20px;letter-spacing:1.4px;font-weight:bold">${xml(data.brand)}</td></tr><tr><td class="pad title" style="padding:12px 36px 10px;color:${palette.text};font-family:Arial,sans-serif;font-size:36px;line-height:44px;font-weight:bold">${xml(data.title)}</td></tr><tr><td class="pad" style="padding:8px 36px 24px;color:${palette.text};font-family:Arial,sans-serif;font-size:17px;line-height:28px">${xml(data.intro).replace(/\r?\n/g, "<br>")}</td></tr>${sections}${ctaMarkup}${data.footer ? `<tr><td class="pad" style="padding:22px 36px;border-top:1px solid #e7e9e7;color:#69736d;font-family:Arial,sans-serif;font-size:12px;line-height:19px">${xml(data.footer).replace(/\r?\n/g, "<br>")}</td></tr>` : ""}</table><div style="font-family:Arial,sans-serif;font-size:11px;line-height:16px;color:#78817b;padding:16px">${xml(data.brand)} · 邮件模板</div></td></tr></table></body></html>`;
  const plainText = [data.brand, data.title, data.intro, ...data.sections.flatMap((s: any) => [s.heading, s.body]), ...(cta ? [cta.label, cta.url] : []), data.footer].filter(Boolean).join("\n\n");
  const report = { skill: "email.marketing", version: "1.0.0", subject: data.subject, sections: data.sections.length, ctaIncluded: !!cta, externalResources: "none", networkSent: false, limitations: ["只生成邮件HTML/纯文本，不发送邮件、不处理订阅、退订、收件人或追踪像素。", "使用邮件客户端兼容的表格布局与部分内联样式，但各邮件客户端渲染可能不同；须在目标客户端测试。", "链接及文案由用户提供；不做事实、商标、法律或营销合规审核。"] };
  event(`已生成无外部资源的表格布局邮件HTML和纯文本版本；没有发送邮件。`);
  return { summary: "邮件营销模板已生成HTML与纯文本版本；未发送邮件。", outputs: [out("marketing-email.html", "text/html; charset=utf-8", html), out("marketing-email.txt", "text/plain; charset=utf-8", plainText), json("marketing-email-report.json", report)] };
}
