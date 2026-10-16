import type { SkillInput } from "./executors";
import { json, out, text } from "./io";
import { htmlAudit } from "./web-checks";
import { cssAudit } from "./frontend-design";

/** Deterministic static review of one HTML file and its embedded style blocks. */
export async function designReview(input: SkillInput, event: (message: string) => void) {
  const source = text(input.bytes);
  if (source.length > 150_000) throw Error("设计检查最多150000字。");
  const html = await htmlAudit(input, () => {});
  const htmlReportFile = html.outputs.find(item => item.name === "html-audit.json");
  if (!htmlReportFile) throw Error("HTML解析报告生成失败。");
  const htmlReport = JSON.parse(Buffer.from(htmlReportFile.bytes).toString("utf8"));
  const styles = [...source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)].map(m => m[1]);
  const cssFindings: any[] = [];
  const cssReports: any[] = [];
  for (const [index, style] of styles.entries()) {
    const cssResult = await cssAudit({ ...input, filename: `${input.filename}.inline-${index + 1}.css`, bytes: Buffer.from(style) }, () => {});
    const reportOutput = cssResult.outputs.find(item => item.name === "css-audit.json");
    if (reportOutput) {
      const report = JSON.parse(Buffer.from(reportOutput.bytes).toString("utf8"));
      cssReports.push({ styleBlock: index + 1, syntaxValid: report.syntaxValid, ruleCount: report.rules || 0 });
      for (const finding of report.findings || []) cssFindings.push({ ...finding, styleBlock: index + 1 });
    }
  }
  const findings = [
    ...htmlReport.findings.map((finding: any) => ({ ...finding, severity: String(finding.code).startsWith("HTML_") ? "error" : "warning", source: "html" })),
    ...cssFindings.map(finding => ({ ...finding, source: `style-${finding.styleBlock}` })),
  ];
  const linksToExternalCss = [...source.matchAll(/<link\b(?=[^>]*\brel\s*=\s*["'][^"']*stylesheet)(?=[^>]*\bhref\s*=\s*["']([^"']+))[^>]*>/gi)].map(m => m[1]);
  const headingLevels = [...source.matchAll(/<h([1-6])\b/gi)].map(m => Number(m[1]));
  for (let i = 1; i < headingLevels.length; i++) {
    if (headingLevels[i] > headingLevels[i - 1] + 1) findings.push({ code: "HEADING_LEVEL_SKIP", severity: "warning", message: `标题层级从H${headingLevels[i - 1]}跳到H${headingLevels[i]}；请检查内容结构。`, line: null, source: "html" });
  }
  if (linksToExternalCss.length) findings.push({ code: "EXTERNAL_STYLESHEETS_NOT_SCANNED", severity: "info", message: `检测到${linksToExternalCss.length}个外链样式表；本次只检查HTML内嵌style块，外链文件未读取。`, line: null, source: "scope" });
  const report = {
    skill: "design.review", version: "1.0.0", syntax: { htmlElements: htmlReport.elements, inlineStyles: styles.length, css: cssReports },
    findings, counts: { error: findings.filter(f => f.severity === "error").length, warning: findings.filter(f => f.severity === "warning").length, info: findings.filter(f => f.severity === "info").length },
    scope: { executed: ["parse5 HTML解析与已登记静态规则", "PostCSS解析内嵌style块", "标题层级跳级启发式检查"], notExecuted: ["外链CSS及远程资源", "浏览器运行与截图", "真实视口布局", "颜色对比度的层叠计算", "键盘/屏幕阅读器交互", "完整WCAG验收", "AI审美判断"] },
    limitations: ["静态规则可能误报或漏报；未发现问题不代表设计质量或无障碍合格。", "不执行HTML中的脚本，不访问网络，不读取外部样式表、字体和图片。", "未进行视觉稿匹配、浏览器截图或人工设计评审。"],
  };
  event(`实际解析${htmlReport.elements}个HTML元素及${styles.length}个内嵌CSS样式块，汇总${findings.length}条静态设计/结构提示；未启动浏览器。`);
  const summary = `静态设计检查完成：${report.counts.error}个错误、${report.counts.warning}个警告、${report.counts.info}条提示。不是浏览器视觉验收或完整无障碍认证。`;
  return { summary, outputs: [json("design-review.json", report), out("design-review.txt", "text/plain; charset=utf-8", findings.map(f => `${String(f.severity || "info").toUpperCase()} ${f.code}: ${f.message}`).join("\n") || "已实现的静态规则未发现提示；不代表通过浏览器或无障碍验收。")] };
}
