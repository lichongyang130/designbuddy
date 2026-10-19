import { test, expect, type Page } from "@playwright/test";
const settings = (page: Page) =>
  page.getByRole("dialog", { name: "设置", exact: true });
async function openPlan(page: Page) {
  await page.goto("/");
  await expect(page.locator("dialog.settings-window")).toBeAttached();
  await page.keyboard.press("Control+,");
  await settings(page)
    .getByRole("button", { name: "套餐与积分", exact: true })
    .click();
}

test("plan shows unavailable credits honestly and actual local usage", async ({
  page,
}) => {
  await openPlan(page);
  const panel = settings(page);
  await expect(panel.getByRole("region", { name: "本机免费版" })).toContainText(
    "不会产生订阅或扣费",
  );
  const balance = panel.getByRole("region", { name: "积分余额" });
  await expect(balance).toContainText("未接入");
  await expect(balance).toContainText("不展示示例余额");
  await expect(panel).not.toContainText("193.4");
  await expect(panel).not.toContainText("2026/11/01");
  await expect(panel.getByRole("progressbar")).toHaveCount(0);
  await expect(panel).toContainText("设计项目");
  await expect(panel).toContainText("本地存储占用");
  await expect(panel.locator(".settings-usage-list > div")).toHaveCount(6);
});

test("edition information does not create an order or pretend billing is connected", async ({
  page,
}) => {
  await openPlan(page);
  await settings(page)
    .getByRole("button", { name: "了解版本与服务状态" })
    .click();
  const dialog = page.getByRole("dialog", { name: "付费套餐暂未接入" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("不会创建订单或产生扣费");
  await dialog.getByRole("button", { name: "知道了" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(settings(page)).toBeVisible();
});
