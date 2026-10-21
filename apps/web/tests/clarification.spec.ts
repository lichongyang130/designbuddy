import { test, expect, type Page } from "@playwright/test";
import { setMode, setPermission } from "./helpers/home";

const sse = (text: string) => `data: ${JSON.stringify({ model: "clarification-test", choices: [{ delta: { content: text }, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`;
const protocol = (questions: unknown) => '```designbuddy-clarification\n' + JSON.stringify({ questions }) + '\n```';
async function ask(page: Page, text = "帮我做一个UI", mode?: string, permission?: string) {
  await page.goto("/");
  if (mode) await setMode(page, mode);
  if (permission) await setPermission(page, permission);
  await page.getByRole("textbox", { name: "任务描述", exact: true }).fill(text);
  await page.getByRole("button", { name: "开始任务", exact: true }).click();
  await expect(page).toHaveURL(/\/tasks\//);
}
async function selectWeb(page: Page) {
  await page.getByRole("radio", { name: "直接设计并实现界面", exact: true }).click();
  await page.getByRole("button", { name: "下一题", exact: true }).click();
  await page.getByRole("radio", { name: "网页页面（HTML/React 等）", exact: true }).click();
}

test("UI questions pause without API calls, retain answers across pages/reload, and submit once with context", async ({ page }) => {
  const payloads: any[] = [];
  await page.route("**/api/chat", route => { payloads.push(route.request().postDataJSON()); return route.fulfill({ contentType: "text/event-stream", body: sse("已收到你的界面需求和补充。") }); });
  await ask(page);
  const card = page.getByRole("region", { name: "确认问题", exact: true });
  await expect(card).toBeVisible();
  await expect(page.getByRole("button", { name: "提交确认并继续" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "上一题", exact: true })).toBeDisabled();
  expect(payloads).toHaveLength(0);
  await page.getByRole("radio", { name: "直接设计并实现界面", exact: true }).click();
  await page.getByRole("textbox", { name: "其他补充" }).fill("面向独立设计师，灰白配色");
  await page.getByRole("button", { name: "下一题", exact: true }).click();
  await page.getByRole("radio", { name: "网页页面（HTML/React 等）", exact: true }).click();
  await expect(page.getByRole("button", { name: "下一题", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "上一题", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "其他补充" })).toHaveValue("面向独立设计师，灰白配色");
  await page.getByRole("button", { name: "下一题", exact: true }).click();
  await page.reload();
  await expect(card).toContainText("2/2");
  await expect(page.getByRole("radio", { name: "网页页面（HTML/React 等）", exact: true })).toHaveAttribute("aria-checked", "true");
  expect(payloads).toHaveLength(0);
  await page.screenshot({ path: "../../.cache/clarification-desktop.png" });
  await page.getByRole("button", { name: "提交确认并继续" }).click();
  await expect(page.locator(".task-progress summary").last()).toContainText("已完成");
  expect(payloads).toHaveLength(1);
  const body = payloads[0].messages.at(-1).content;
  expect(body).toContain("帮我做一个UI");
  expect(body).toContain("灰白配色");
  expect(body).toContain("网页页面（HTML/React 等）");
  await expect(page.getByRole("textbox", { name: "继续描述任务", exact: true })).toBeVisible();
  await expect(page.locator(".task-user-message")).toHaveCount(2);
  await page.reload();
  expect(payloads).toHaveLength(1);
  await expect(card).toHaveCount(0);
});

test("closing does not execute; reopen preserves selections; custom-only answers are valid", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/chat", route => { calls++; return route.fulfill({ contentType: "text/event-stream", body: sse("先讨论需求。") }); });
  await ask(page);
  await page.getByRole("textbox", { name: "其他补充" }).fill("我只想评审现有设计");
  await page.getByRole("button", { name: "关闭确认" }).click();
  await expect(page.getByRole("region", { name: "确认问题" })).toHaveCount(0);
  expect(calls).toBe(0);
  await page.getByRole("button", { name: "重新打开确认" }).click();
  await expect(page.getByRole("textbox", { name: "其他补充" })).toHaveValue("我只想评审现有设计");
  await page.getByRole("button", { name: "下一题", exact: true }).click();
  await page.getByRole("textbox", { name: "其他补充" }).fill("桌面应用，先不实现");
  await page.getByRole("button", { name: "提交确认并继续" }).click();
  await expect(page.locator(".task-progress summary").last()).toContainText("已完成");
  expect(calls).toBe(1);
});

test("execution consent uses the card and never contacts AI on decline or reload", async ({ page }) => {
  let calls = 0, dialogs = 0;
  page.on("dialog", async dialog => { dialogs++; await dialog.dismiss(); });
  await page.route("**/api/chat", route => { calls++; return route.fulfill({ contentType: "text/event-stream", body: sse("这是你的报告摘要。") }); });
  await ask(page, "总结报告", undefined, "需要确认后执行");
  await expect(page.getByRole("region", { name: "确认问题" })).toContainText("发送给已配置的 AI 服务");
  await expect(page.getByRole("button", { name: "提交确认并继续" })).toBeDisabled();
  await page.getByRole("radio", { name: "暂不发送", exact: true }).click();
  await page.getByRole("button", { name: "提交确认并继续" }).click();
  expect(calls).toBe(0);
  await page.getByRole("button", { name: "重新打开确认" }).click();
  await page.getByRole("radio", { name: "确认发送", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("radio", { name: "确认发送", exact: true })).toHaveAttribute("aria-checked", "true");
  expect(calls).toBe(0);
  await page.getByRole("button", { name: "提交确认并继续" }).click();
  await expect(page.locator(".task-progress summary")).toContainText("已完成");
  expect(calls).toBe(1); expect(dialogs).toBe(0);
});

test("design confirmation carries original brief into generation; retry preserves confirmed context", async ({ page }) => {
  const requests: any[] = [];
  await page.route("**/api/generation", route => {
    requests.push(route.request().postDataJSON());
    return requests.length === 1 ? route.fulfill({ status: 503, json: { error: "测试连接失败" } }) : route.fulfill({ json: { files: [{ path: "index.html", content: "<!doctype html><h1>确认后的页面</h1>", language: "html" }] } });
  });
  await ask(page, "帮我做一个UI", "设计制作");
  await selectWeb(page);
  await page.getByRole("textbox", { name: "其他补充" }).fill("包含作品与联系表单");
  await page.getByRole("button", { name: "提交确认并继续" }).click();
  await expect(page.getByRole("alert")).toContainText("测试连接失败");
  await page.getByRole("button", { name: "重新生成", exact: true }).last().click();
  await expect(page.getByRole("button", { name: "打开生成的项目", exact: true })).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[1].prompt).toContain("帮我做一个UI");
  expect(requests[1].prompt).toContain("包含作品与联系表单");
  expect(requests[1].prompt).toBe(requests[0].prompt);
});

test("non-web choice discusses requirements instead of pretending an HTML preview is a mini app", async ({ page }) => {
  let generations = 0; const requests: any[] = [];
  await page.route("**/api/generation", route => { generations++; return route.abort(); });
  await page.route("**/api/chat", route => { requests.push(route.request().postDataJSON()); return route.fulfill({ contentType: "text/event-stream", body: sse("先讨论小程序需求，工作台仅支持网页预览。") }); });
  await ask(page, "帮我做一个UI", "网页应用");
  await page.getByRole("radio", { name: "直接设计并实现界面", exact: true }).click();
  await page.getByRole("button", { name: "下一题", exact: true }).click();
  await page.getByRole("radio", { name: "微信小程序", exact: true }).click();
  await page.getByRole("button", { name: "提交确认并继续" }).click();
  await expect(page.locator(".task-reply-markdown").last()).toContainText("仅支持网页预览");
  expect(generations).toBe(0); expect(requests).toHaveLength(1);
  expect(requests[0].messages.at(-1).content).toContain("微信小程序");
});

test("model clarification is validated, rendered without JSON, and answers go to real chat context", async ({ page }) => {
  const requests: any[] = [];
  await page.route("**/api/chat", route => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ contentType: "text/event-stream", body: sse(requests.length === 1 ? protocol([{ id: "audience", title: "报告主要给谁看？", options: ["管理层", "执行团队", "外部客户"] }, { id: "format", title: "需要哪种交付？", options: ["摘要", "详细报告"] }]) : "已按执行团队和详细报告整理。") });
  });
  await ask(page, "帮我整理一份报告");
  await expect(page.getByRole("heading", { name: "报告主要给谁看？" })).toBeVisible();
  await expect(page.locator(".task-reply-markdown")).not.toContainText("designbuddy-clarification");
  await page.getByRole("radio", { name: "管理层", exact: true }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("radio", { name: "执行团队", exact: true })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "下一题", exact: true }).click();
  await page.getByRole("radio", { name: "详细报告", exact: true }).click();
  expect(requests).toHaveLength(1);
  await page.getByRole("button", { name: "提交确认并继续" }).click();
  await expect(page.locator(".task-reply-markdown").last()).toContainText("已按执行团队");
  expect(requests).toHaveLength(2);
  expect(requests[1].messages.at(-1).content).toContain("帮我整理一份报告");
  expect(requests[1].messages.at(-1).content).toContain("执行团队");
});

test("malformed structured questions fail closed with a retry, not a broken card or fake answer", async ({ page }) => {
  await page.route("**/api/chat", route => route.fulfill({ contentType: "text/event-stream", body: sse(protocol([{ id: "bad", title: "选择？", options: ["只有一个"] }])) }));
  await ask(page, "帮我整理一份报告");
  await expect(page.getByRole("alert")).toContainText("确认问题格式无效");
  await expect(page.getByRole("region", { name: "确认问题" })).toHaveCount(0);
  await expect(page.locator(".task-reply-markdown")).toHaveCount(0);
});

test("corrupt saved questions do not crash the task or silently execute", async ({ page }) => {
  await ask(page);
  await expect(page.getByRole("region", { name: "确认问题" })).toBeVisible();
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find(k => k.startsWith("designbuddy.conversation.v1."))!;
    const task = JSON.parse(localStorage.getItem(key)!);
    task.messages.at(-1).clarification.answers = [];
    localStorage.setItem(key, JSON.stringify(task));
  });
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("确认信息已损坏");
  await expect(page.getByRole("region", { name: "确认问题" })).toHaveCount(0);
  await page.getByRole("button", { name: "重新生成", exact: true }).click();
  await expect(page.getByRole("region", { name: "确认问题" })).toBeVisible();
});

for (const width of [320, 375, 768, 1440]) {
  test(`confirmation card fits ${width}px and supports long custom text`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await ask(page);
    await selectWeb(page);
    await page.getByRole("textbox", { name: "其他补充" }).fill("需要适配窄屏移动端，保持完整交互。".repeat(20));
    const card = page.getByRole("region", { name: "确认问题" });
    await expect(card).toBeVisible();
    const bounds = (await card.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(900);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if (width === 375) await page.screenshot({ path: "../../.cache/clarification-mobile.png" });
  });
}

test("requirements answers do not bypass a separate execution consent", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/chat", route => { calls++; return route.fulfill({ contentType: "text/event-stream", body: sse("收到确认。") }); });
  await ask(page, "帮我做一个UI", undefined, "需要确认后执行");
  await selectWeb(page);
  await page.getByRole("button", { name: "提交确认并继续" }).click();
  await expect(page.getByRole("radio", { name: "确认发送", exact: true })).toBeVisible();
  expect(calls).toBe(0);
  await page.getByRole("radio", { name: "确认发送", exact: true }).click();
  await page.getByRole("button", { name: "提交确认并继续" }).click();
  await expect(page.locator(".task-progress summary").last()).toContainText("已完成");
  expect(calls).toBe(1);
});

test("only-local mode does not start online clarification or generation", async ({ page }) => {
  let calls = 0;
  await page.route(/\/api\/(chat|generation)$/, route => { calls++; return route.abort(); });
  await ask(page, "帮我做一个UI", "设计制作", "仅本地");
  await expect(page.locator(".task-progress summary")).toContainText("仅本地");
  await expect(page.getByRole("region", { name: "确认问题" })).toHaveCount(0);
  expect(calls).toBe(0);
});

test("follow-up after choosing discussion stays conversational, including after reload", async ({ page }) => {
  let generations = 0, chats = 0;
  await page.route("**/api/generation", route => { generations++; return route.abort(); });
  await page.route("**/api/chat", route => { chats++; return route.fulfill({ contentType: "text/event-stream", body: sse("继续讨论需求。") }); });
  await ask(page, "帮我做一个UI", "设计制作");
  await page.getByRole("radio", { name: "先梳理需求和交互", exact: true }).click();
  await page.getByRole("button", { name: "下一题", exact: true }).click();
  await page.getByRole("radio", { name: "还没定，先聊需求", exact: true }).click();
  await page.getByRole("button", { name: "提交确认并继续" }).click();
  await expect(page.locator(".task-progress summary").last()).toContainText("已完成");
  await page.reload();
  await page.getByRole("textbox", { name: "继续描述任务", exact: true }).fill("继续分析登录需求");
  await page.getByRole("button", { name: "发送消息", exact: true }).click();
  await expect(page.locator(".task-progress summary").last()).toContainText("已完成");
  expect(chats).toBe(2); expect(generations).toBe(0);
});
