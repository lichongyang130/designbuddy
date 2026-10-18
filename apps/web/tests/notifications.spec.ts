import { test, expect, type Page } from "@playwright/test";
import { freshAccountPage } from "./auth-helpers";
const key = "designbuddy.notifications.v1";
async function ask(page: Page, text = "整理今天的工作") {
  await page.goto("/");
  await page.getByRole("textbox", { name: "任务描述", exact: true }).fill(text);
  await page.getByRole("button", { name: "开始任务", exact: true }).click();
  await expect(page).toHaveURL(/\/tasks\//);
}
async function completeTask(page: Page) {
  await page.route("**/api/chat", route => route.fulfill({ contentType: "text/event-stream", body: `data: ${JSON.stringify({ choices: [{ delta: { content: "工作已整理。" }, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n` }));
  await ask(page);
  await expect(page.locator(".task-progress summary")).toContainText("已完成");
}

test("bell opens an honest empty inbox, outside click and Escape close and restore focus", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "通知", exact: true });
  await trigger.click();
  const panel = page.getByRole("dialog", { name: "通知中心" });
  await expect(panel).toContainText("暂时没有通知");
  await expect(panel).toContainText("非手机推送");
  await expect(panel.getByRole("button", { name: "全部已读" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole("heading", { name: /DesignBuddy 让工作更高效/ }).click();
  await expect(panel).toHaveCount(0);
});

test("real task completion creates one persistent notification and opens its task", async ({ page }) => {
  await completeTask(page);
  const taskUrl = page.url();
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "通知", exact: true });
  await expect(trigger.locator(".notification-unread-dot")).toBeVisible();
  await trigger.click();
  const panel = page.getByRole("dialog", { name: "通知中心" });
  await expect(panel.locator("li")).toHaveCount(1);
  await expect(panel).toContainText("AI 回复已完成");
  await expect(panel).toContainText("整理今天的工作");
  await panel.getByRole("button", { name: /AI 回复已完成/ }).first().click();
  await expect(page).toHaveURL(taskUrl);
  await expect(trigger.locator(".notification-unread-dot")).toHaveCount(0);
  await page.reload();
  await trigger.click();
  await expect(panel.locator("li")).toHaveCount(1);
  await expect(panel).toContainText("0 条未读");
  await panel.getByRole("button", { name: "清除已读" }).click();
  await expect(panel).toContainText("暂时没有通知");
  await page.reload();
  await expect(page.locator(".task-reply-markdown")).toContainText("工作已整理");
});

test("failures notify; filtering, marking read and deletion do not remove the task", async ({ page }) => {
  await page.route("**/api/chat", route => route.fulfill({ status: 503, json: { error: "测试连接失败" } }));
  await ask(page);
  await expect(page.getByRole("alert")).toContainText("测试连接失败");
  await page.getByRole("button", { name: "通知", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "通知中心" });
  await expect(panel).toContainText("任务回复失败");
  await panel.getByRole("button", { name: "未读 1", exact: true }).click();
  await panel.getByRole("button", { name: "标为已读", exact: true }).click();
  await expect(panel).toContainText("没有未读通知");
  await panel.getByRole("button", { name: "全部", exact: true }).click();
  await panel.getByRole("button", { name: "删除通知：任务回复失败" }).click();
  await expect(panel).toContainText("暂时没有通知");
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("测试连接失败");
  await page.getByRole("button", { name: "通知", exact: true }).click();
  await expect(panel.locator("li")).toHaveCount(0);
});

test("waiting-for-answer notifies only once while editing and resolves when dismissed", async ({ page }) => {
  await ask(page, "帮我做一个UI");
  await expect(page.getByRole("region", { name: "确认问题" })).toBeVisible();
  await page.getByRole("textbox", { name: "其他补充" }).fill("需要简约设计");
  await page.getByRole("button", { name: "通知", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "通知中心" });
  await expect(panel.locator("li")).toHaveCount(1);
  await expect(panel).toContainText("任务等待确认");
  await page.getByRole("button", { name: "关闭通知" }).click();
  await page.getByRole("button", { name: "关闭确认" }).click();
  await page.getByRole("button", { name: "通知", exact: true }).click();
  await expect(panel).toContainText("0 条未读");
  await expect(panel.locator("li")).toHaveCount(1);
});

test("read state is synchronized between browser tabs through the sidebar bell", async ({ page, context }) => {
  await completeTask(page);
  await page.goto("/");
  await page.getByRole("button", { name: "通知", exact: true }).click();
  const other = await context.newPage();
  await other.goto("/");
  await other.getByRole("button", { name: "通知", exact: true }).click();
  await other.getByRole("button", { name: "全部已读" }).click();
  await expect(page.getByRole("dialog", { name: "通知中心" })).toContainText("0 条未读");
  await expect(page.locator(".notification-unread-dot")).toHaveCount(0);
  await other.close();
});

test("invalid saved records are ignored; deleted task links show an honest error", async ({ browser }) => {
  // The server inbox is the record of truth, so this exact-count assertion
  // needs a user whose inbox is empty.
  const owned = await freshAccountPage(browser, `notifications_invalid_${Date.now().toString(36)}`);
  const page = owned.page;
  try {
    await page.goto("/");
    await page.evaluate((storageKey) => localStorage.setItem(storageKey, JSON.stringify([null, { kind: "bad" }, { id: "missing", projectId: "no-longer-exists", messageId: "reply-1", kind: "error", title: "历史任务失败", description: "已删除的任务", createdAt: new Date().toISOString(), read: false }])), key);
    await page.reload();
    await page.getByRole("button", { name: "通知", exact: true }).click();
    const panel = page.getByRole("dialog", { name: "通知中心" });
    await expect(panel.locator("li")).toHaveCount(1);
    await panel.getByRole("button", { name: /历史任务失败/ }).first().click();
    await expect(panel).toContainText("原任务已不存在");
    await expect(page).toHaveURL(/\/$/);
  } finally {
    await owned.context.close();
  }
});

for (const width of [320, 375, 768, 1440]) {
  test(`notification popover stays within ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    // Open from the desktop sidebar, then check resize handling at narrow widths.
    // The compact sidebar still hides secondary controls; no top-right bell is restored.
    if (width <= 680) await page.setViewportSize({ width: 1024, height: 900 });
    await page.getByRole("button", { name: "通知", exact: true }).click();
    await page.setViewportSize({ width, height: 900 });
    const panel = page.getByRole("dialog", { name: "通知中心" });
    await expect(panel).toBeVisible();
    await expect.poll(async () => {
      const box = (await panel.boundingBox())!;
      return box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= 900;
    }).toBe(true);
    await page.getByRole("button", { name: "关闭通知" }).click();
    await expect(page.getByRole("button", { name: "查看首页通知", exact: true })).toHaveCount(0);
    if (width === 1440) await page.screenshot({ path: "../../.cache/home-text-shortcuts.png" });
  });
}
