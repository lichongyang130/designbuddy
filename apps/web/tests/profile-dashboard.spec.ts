import { test, expect } from "@playwright/test";

test("personal home mirrors the plan dashboard while keeping billing honest", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("designbuddy.projects.v1", JSON.stringify([{ id: "one" }]));
    localStorage.setItem("designbuddy.conversation.v1.one", "{}");
    localStorage.setItem("designbuddy.samples.drafts.v2", JSON.stringify([{ id: "draft-one" }]));
    localStorage.setItem("designbuddy.samples.v2.one", "{}");
  });
  await page.goto("/profile");

  await expect(page.getByRole("heading", { name: "个人主页", level: 1 })).toBeVisible();
  const plan = page.getByRole("region", { name: "当前套餐" });
  await expect(plan).toContainText("Free");
  await expect(plan).toContainText("计费服务未接入");
  await expect(plan.getByRole("button", { name: "升级", exact: true })).toBeEnabled();

  const wallet = page.getByRole("region", { name: "钱包余额" });
  await expect(wallet.getByLabel("钱包余额未接入")).toHaveText("—");
  await expect(wallet.getByRole("switch", { name: "自动充值" })).toBeDisabled();
  await expect(wallet).toContainText("不会产生扣费");

  const resets = page.getByRole("region", { name: "使用限额重置" });
  await expect(resets).toContainText("可用");
  await expect(resets.locator(".profile-quota-available")).toContainText("0");
  await expect(resets).toContainText("暂无可用重置额度");

  const usage = page.getByRole("region", { name: "本机使用概览" });
  const projectMetric = usage.locator(".profile-usage-grid > div").filter({ hasText: "设计项目" });
  const conversationMetric = usage.locator(".profile-usage-grid > div").filter({ hasText: "任务对话" });
  const draftMetric = usage.locator(".profile-usage-grid > div").filter({ hasText: "模板草稿" });
  await expect(projectMetric).toContainText("1");
  await expect(conversationMetric).toContainText("1");
  await expect(draftMetric).toContainText("1");
  await page.evaluate(() => localStorage.setItem("designbuddy.projects.v1", JSON.stringify([{ id: "one" }, { id: "two" }])));
  await usage.getByRole("button", { name: "刷新统计" }).click();
  await expect(projectMetric).toContainText("2");

  await plan.getByRole("button", { name: "升级", exact: true }).click();
  const upgrade = page.getByRole("dialog", { name: "付费套餐暂未接入" });
  await expect(upgrade).toBeVisible();
  await expect(upgrade).toContainText("不会创建订单或产生扣费");
  await upgrade.getByRole("button", { name: "知道了" }).click();
  await expect(upgrade).not.toBeVisible();

  await page.getByRole("button", { name: "账号与数据", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "账号与数据", level: 2 })).toBeInViewport();
});
