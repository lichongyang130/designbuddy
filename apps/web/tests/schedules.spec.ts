import { test, expect } from "@playwright/test";

test("scheduled checks are created, listed, paused and deleted on the server", async ({ page }) => {
  await page.goto("/schedules");
  await expect(page.getByRole("heading", { level: 1, name: "定时任务" })).toBeVisible();
  const name = `自检计划-${Date.now()}`;
  await page.getByLabel("名称", { exact: true }).fill(name);
  await page.getByLabel("检查地址", { exact: true }).fill("http://127.0.0.1:8787/api/health");
  await page.getByLabel("cron 表达式", { exact: true }).fill("*/30 * * * *");
  await page.getByLabel("时区").fill("Asia/Shanghai");
  await page.getByRole("button", { name: "创建计划" }).click();
  await expect(page.locator(".schedules-message")).toContainText("已创建计划");
  const row = page.locator(".schedule-list li", { hasText: name });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("Asia/Shanghai");
  // The plan is a real server record: reloading keeps it.
  await page.reload();
  await expect(page.locator(".schedule-list li", { hasText: name })).toHaveCount(1);
  await page.locator(".schedule-list li", { hasText: name }).getByRole("button", { name: "暂停" }).click();
  await expect(page.locator(".schedule-list li", { hasText: name })).toHaveClass(/is-paused/);
  await page.locator(".schedule-list li", { hasText: name }).getByRole("button", { name: "删除" }).click();
  await expect(page.locator(".schedule-list li", { hasText: name })).toHaveCount(0);
});

test("an invalid cron expression is rejected by the server with a readable message", async ({ page }) => {
  await page.goto("/schedules");
  await page.getByLabel("名称", { exact: true }).fill("非法计划");
  await page.getByLabel("检查地址", { exact: true }).fill("http://127.0.0.1:8787/api/health");
  await page.getByLabel("cron 表达式", { exact: true }).fill("not a cron");
  await page.getByRole("button", { name: "创建计划" }).click();
  await expect(page.locator(".schedules-message.is-error")).toContainText("cron");
});
