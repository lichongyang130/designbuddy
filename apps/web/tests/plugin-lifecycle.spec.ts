import { test, expect } from "@playwright/test";

/**
 * The plugin lifecycle must be real server state: install, disable, enable and
 * uninstall all go through the backend and leave a log behind.
 */
test("a plugin bundle can be installed, disabled, enabled and uninstalled on the server", async ({
  page,
}) => {
  await page.goto("/plugins");
  const panel = page.getByRole("region", { name: "插件生命周期" });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("heading", { name: "插件包安装与启停" })).toBeVisible();

  const cards = panel.locator(".pm-lifecycle-card");
  await expect(cards).toHaveCount(4);
  const first = cards.first();
  await expect(first.getByRole("heading")).toContainText("文档与数据基础包");
  await expect(first.locator(".pm-lifecycle-skills li")).toHaveCount(4);

  // Install from the server catalogue.
  await first.getByRole("button", { name: "安装", exact: true }).click();
  await expect(panel.getByRole("status").filter({ hasText: "已安装" })).toBeVisible();
  await expect(first.getByRole("button", { name: "停用", exact: true })).toBeVisible();

  // Disable it: the card shows the new state and the log records the action.
  await first.getByRole("button", { name: "停用", exact: true }).click();
  await expect(panel.getByRole("status").filter({ hasText: "已停用" })).toBeVisible();
  await expect(first.locator(".pm-lifecycle-state-tag")).toHaveText("已停用");

  await panel.getByRole("group").first().isVisible().catch(() => undefined);
  await panel.locator(".pm-lifecycle-log summary").click();
  const log = panel.locator(".pm-lifecycle-log li");
  await expect(log.first()).toContainText("停用");
  await expect(log.nth(1)).toContainText("安装");

  // Enable again, then remove the bundle completely.
  await first.getByRole("button", { name: "启用", exact: true }).click();
  await expect(panel.getByRole("status").filter({ hasText: "已启用" })).toBeVisible();
  await first.getByRole("button", { name: "卸载", exact: true }).click();
  await expect(panel.getByRole("status").filter({ hasText: "已卸载" })).toBeVisible();
  await expect(first.getByRole("button", { name: "安装", exact: true })).toBeVisible();
});

test("the plugin state survives a reload because the server owns it", async ({ page }) => {
  await page.goto("/plugins");
  const panel = page.getByRole("region", { name: "插件生命周期" });
  const second = panel.locator(".pm-lifecycle-card").nth(1);
  await second.getByRole("button", { name: "安装", exact: true }).click();
  await expect(panel.getByRole("status").filter({ hasText: "已安装" })).toBeVisible();
  await page.reload();
  const reloaded = page.getByRole("region", { name: "插件生命周期" }).locator(".pm-lifecycle-card").nth(1);
  await expect(reloaded.getByRole("button", { name: "停用", exact: true })).toBeVisible();
  await reloaded.getByRole("button", { name: "卸载", exact: true }).click();
  await expect(page.getByRole("region", { name: "插件生命周期" }).getByRole("status").filter({ hasText: "已卸载" })).toBeVisible();
});

test("a bundle states its interface version, its real permissions and the resolved skill versions", async ({
  page,
}) => {
  await page.goto("/plugins");
  const panel = page.getByRole("region", { name: "插件生命周期" });
  const cards = panel.locator(".pm-lifecycle-card");
  const first = cards.first();
  await expect(first.locator("[data-plugin-api]")).toHaveText("插件接口 1.0");
  await expect(first.locator(".pm-lifecycle-meta")).toContainText("读取本机上传文件");
  await expect(first.locator(".pm-lifecycle-meta")).toContainText("在本机写出成果文件");
  await expect(first.locator(".pm-lifecycle-meta")).not.toContainText("local.read");
  await expect(first.locator(".pm-lifecycle-compat")).toContainText("兼容");
  await expect(first.getByRole("button", { name: "安装", exact: true })).toBeEnabled();

  // The browser-check bundle really does need network and process rights.
  const browserBundle = cards.nth(2);
  await expect(browserBundle.getByRole("heading")).toContainText("网页与质量检查包");
  await expect(browserBundle.locator(".pm-lifecycle-meta")).toContainText("访问网络地址");
  await expect(browserBundle.locator(".pm-lifecycle-meta")).toContainText("启动本机子进程");

  // Installing records the skill versions that were resolved on the server.
  await first.getByRole("button", { name: "安装", exact: true }).click();
  await expect(panel.getByRole("status").filter({ hasText: "已安装" })).toBeVisible();
  await expect(first.locator(".pm-lifecycle-versions")).toContainText("@1.0.0");
  await first.getByRole("button", { name: "卸载", exact: true }).click();
  await expect(panel.getByRole("status").filter({ hasText: "已卸载" })).toBeVisible();
});
