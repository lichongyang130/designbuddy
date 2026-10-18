import { test, expect, type Page } from "@playwright/test";

const settings = (page: Page) =>
  page.getByRole("dialog", { name: "设置", exact: true });

async function openProfile(page: Page) {
  await page.goto("/");
  await expect(page.locator("dialog.settings-window")).toBeAttached();
  await page.keyboard.press("Control+,");
  await expect(settings(page)).toBeVisible();
  await settings(page).getByRole("button", { name: "个人主页", exact: true }).click();
}

test("settings profile renders the plan banner, wallet card and quota card", async ({ page }) => {
  await openProfile(page);
  const panel = settings(page);

  // Plan banner: free plan, subscription state and the upgrade entry.
  const banner = panel.getByRole("region", { name: "当前套餐" });
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("Free");
  await expect(banner).toContainText("订阅状态：免费");
  await expect(banner.getByRole("button", { name: "升级", exact: true })).toBeEnabled();

  // Wallet card: the balance is the real unconnected state, not a billing figure.
  // The heading and its note sit above the card, matching the reference layout.
  await expect(panel.getByRole("heading", { name: "钱包余额", level: 3 })).toBeVisible();
  await expect(panel).toContainText("Design Plan 额度用尽后，自动使用此余额按量付费。");
  const wallet = panel.getByRole("region", { name: "钱包余额" });
  await expect(wallet).toContainText("$0.00");
  await expect(wallet).toContainText("当前可用余额");
  await expect(wallet).toContainText("自动充值");
  await expect(wallet).toContainText("升级会员后即可使用自动充值。");
  await expect(wallet.getByRole("switch", { name: "自动充值" })).toBeDisabled();
  await expect(wallet).toContainText("不会产生扣费");

  // Quota reset card.
  const quota = panel.getByRole("region", { name: "使用限额重置" });
  await expect(quota).toContainText("可用");
  await expect(quota).toContainText("暂无可用重置额度");
  await expect(quota).toContainText("没有已连接的云端额度服务");

  // The original connection and account entries are still there.
  await expect(panel).toContainText("套餐、钱包、支付和自动充值服务尚未接入");
  await expect(panel.getByRole("button", { name: "后台连接状态" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "账号与数据", exact: true })).toHaveCount(1);
});

test("settings profile upgrade button explains the missing billing service", async ({ page }) => {
  await openProfile(page);
  await settings(page).getByRole("button", { name: "升级", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "付费套餐暂未接入" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("不会创建订单或产生扣费");
  await dialog.getByRole("button", { name: "知道了" }).click();
  await expect(dialog).not.toBeVisible();
});

test("settings profile account entry still navigates to the profile page", async ({ page }) => {
  await openProfile(page);
  await settings(page).getByRole("button", { name: "账号与数据", exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole("heading", { name: "个人主页", level: 1 })).toBeVisible();
});
