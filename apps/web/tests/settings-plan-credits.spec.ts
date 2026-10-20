import { test, expect, type Page } from "@playwright/test";

const settings = (page: Page) =>
  page.getByRole("dialog", { name: "设置", exact: true });

async function openPlan(page: Page) {
  await page.goto("/");
  await expect(page.locator("dialog.settings-window")).toBeAttached();
  await page.keyboard.press("Control+,");
  await expect(settings(page)).toBeVisible();
  await settings(page).getByRole("button", { name: "套餐与积分", exact: true }).click();
}

test("plan section renders the credits panel above the local usage card", async ({ page }) => {
  await openPlan(page);
  const panel = settings(page);

  const balance = panel.getByRole("region", { name: "积分余额" });
  await expect(balance).toContainText("免费版");
  await expect(balance.getByRole("button", { name: "升级套餐", exact: true })).toBeEnabled();
  await expect(balance).toContainText("193.4");
  await expect(balance).toContainText("总剩余积分");
  await expect(balance).toContainText("套餐基础积分");
  await expect(balance).toContainText("平台奖励积分");
  await expect(balance).toContainText("购买积分");

  const details = panel.getByRole("region", { name: "积分明细" });
  await expect(panel.getByRole("heading", { name: "积分明细", level: 3 })).toBeVisible();
  await expect(details).toContainText("下次刷新时间 2026/11/01 00:00:00");
  await expect(details).toContainText("已使用 100/100");
  await expect(details).toContainText("剩余 0%");
  await expect(details).toContainText("最近到期时间 2026/10/28 02:20:24");
  await expect(details).toContainText("已使用 346.6/540");
  await expect(details).toContainText("剩余 35%");
  // The bars reflect the printed ratios: full for 100/100, ~64% for 346.6/540.
  const bars = details.locator(".settings-credits-bar > span");
  await expect(bars).toHaveCount(2);
  const widths = await bars.evaluateAll((nodes) =>
    nodes.map((node) => {
      const parent = node.parentElement as HTMLElement;
      return Math.round((node.getBoundingClientRect().width / parent.getBoundingClientRect().width) * 100);
    }),
  );
  expect(widths[0]).toBe(100);
  expect(widths[1]).toBeGreaterThanOrEqual(63);
  expect(widths[1]).toBeLessThanOrEqual(65);
  await expect(details.getByRole("button", { name: "查看明细" })).toBeVisible();

  // The honest local usage card stays below the panel.
  await expect(panel).toContainText("不会产生订阅或扣费");
  await expect(panel).toContainText("设计项目");
  await expect(panel).toContainText("本地存储占用");
});

test("plan section upgrade button explains that billing is not connected", async ({ page }) => {
  await openPlan(page);
  await settings(page).getByRole("button", { name: "升级套餐", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "付费套餐暂未接入" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("不会创建订单或产生扣费");
  await dialog.getByRole("button", { name: "知道了" }).click();
  await expect(dialog).not.toBeVisible();
});

test("plan section credit details link opens the profile account data", async ({ page }) => {
  await openPlan(page);
  await settings(page).getByRole("button", { name: "查看明细" }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole("heading", { name: "个人主页", level: 1 })).toBeVisible();
});
