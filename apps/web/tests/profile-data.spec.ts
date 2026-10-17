import { test, expect } from "@playwright/test";

/**
 * Account data: preferences that follow the account, memories the person
 * allowed, the devices that used it, and export / forget.
 *
 * The page talks to the real server; nothing here is mocked.
 */
test("the account page lists what the server really holds", async ({ page }) => {
  await page.goto("/profile");
  const facts = page.getByRole("region", { name: "账号概览" });
  await expect(facts).toBeVisible();
  await expect(facts).toContainText("长期记忆");
  await expect(facts).toContainText("使用过的设备");
});

test("a memory is only written when the person agrees", async ({ page }) => {
  await page.goto("/profile");
  const card = page.getByRole("region", { name: "长期记忆" });
  await expect(card).toBeVisible();
  await card.getByLabel("要记住的内容").fill("汇报先给结论，再给论据");
  await card.getByRole("button", { name: "保存记忆" }).click();
  // Without the consent box the save is refused in the browser.
  await expect(page.locator(".profile-message.is-error")).toContainText("同意");
  await expect(card.getByRole("listitem").filter({ hasText: "汇报先给结论" })).toHaveCount(0);

  await card.getByLabel("同意保存这条记忆").check();
  await card.getByRole("button", { name: "保存记忆" }).click();
  await expect(card.getByRole("listitem").filter({ hasText: "汇报先给结论" })).toHaveCount(1);

  await card.getByRole("listitem").filter({ hasText: "汇报先给结论" }).getByRole("button", { name: "删除" }).click();
  await expect(card.getByRole("listitem").filter({ hasText: "汇报先给结论" })).toHaveCount(0);
});

test("forget needs an explicit confirmation", async ({ page }) => {
  await page.goto("/profile");
  const card = page.getByRole("region", { name: "导出与清除" });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "清除长期记忆与偏好" }).click();
  await expect(page.locator(".profile-message.is-error")).toContainText("确认");
});

test("the account page opens directly", async ({ page }) => {
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "账号与数据", level: 1 })).toBeVisible();
});
