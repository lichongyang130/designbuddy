import { test, expect, type Page } from "@playwright/test";
// Tests run authenticated; the trigger shows the shared setup account, not the guest placeholder.
const triggerName = /^账号菜单：/;
async function openSettings(page: Page) {
  await page.getByRole("button", { name: triggerName }).click();
  const menu = page.getByRole("dialog", { name: "账号菜单", exact: true });
  await expect(menu.locator(".account-identity")).toBeVisible();
  await expect(menu.getByRole("button", { name: "设置", exact: true })).toBeVisible();
  await menu.getByRole("button", { name: "设置", exact: true }).click();
  return page.getByRole("dialog", { name: "设置", exact: true });
}

test("reference account menu opens settings with grouped navigation and real permission boundaries", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: triggerName })).toHaveCount(1);
  const dialog = await openSettings(page);
  await expect(dialog).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "账号菜单", exact: true }),
  ).toHaveCount(0);
  await expect(dialog.getByRole("navigation").getByRole("button")).toHaveCount(
    14,
  );
  await expect(
    dialog.getByRole("button", { name: "通用", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(dialog.getByLabel("语言", { exact: true })).toHaveValue("zh-CN");
  await expect(dialog.getByLabel("链接打开方式", { exact: true })).toHaveValue(
    "smart",
  );
  for (const name of ["运行时防止系统休眠", "开机自动启动", "自动安装可信技能"])
    await expect(dialog.getByRole("switch", { name })).toBeDisabled();
  await expect(
    dialog.getByLabel("允许锁屏运行", { exact: true }),
  ).toBeDisabled();
  await expect(dialog.getByLabel("网络代理", { exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "关闭设置" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: triggerName })).toBeFocused();
});

test("keyboard, focus trap, Escape and backdrop closing", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: triggerName });
  await trigger.click();
  await page.keyboard.press("ArrowDown");
  await expect(
    page
      .getByRole("dialog", { name: "账号菜单", exact: true })
      .getByRole("button", { name: "升级套餐", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  const dialog = await openSettings(page);
  for (let i = 0; i < 26; i++) {
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
    ).toBeTruthy();
  }
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await page.keyboard.press("Control+,");
  await expect(dialog).toBeVisible();
  await page.mouse.click(1, 1);
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("account popover closes on outside click without opening settings", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: triggerName }).click();
  await page.getByRole("heading", { name: /DesignBuddy 让工作更高效/ }).click();
  await expect(
    page.getByRole("dialog", { name: "账号菜单", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("dialog", { name: "设置", exact: true }),
  ).not.toBeVisible();
});

for (const path of ["/experts", "/skills", "/connectors"]) {
  test(`shared settings window works on ${path}`, async ({ page }) => {
    await page.goto(path);
    const dialog = await openSettings(page);
    await dialog.getByRole("button", { name: "模型", exact: true }).click();
    await expect(
      dialog.getByRole("heading", { name: "自定义模型", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: triggerName })).toBeFocused();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  });
}

for (const [width, height] of [
  [320, 480],
  [375, 812],
  [768, 600],
  [1440, 900],
]) {
  test(`settings and menu fit ${width}×${height}, with scrollable content`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await page.getByRole("button", { name: triggerName }).click();
    const popup = page.getByRole("dialog", { name: "账号菜单", exact: true });
    const menu = (await popup.boundingBox())!;
    expect(menu.x).toBeGreaterThanOrEqual(0);
    expect(menu.y).toBeGreaterThanOrEqual(0);
    expect(menu.x + menu.width).toBeLessThanOrEqual(width);
    expect(menu.y + menu.height).toBeLessThanOrEqual(height);
    await popup.getByRole("button", { name: "设置", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "设置", exact: true });
    const box = (await dialog.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y + box.height).toBeLessThanOrEqual(height);
    expect(
      await dialog.evaluate((el) => el.scrollWidth - el.clientWidth),
    ).toBeLessThanOrEqual(1);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await dialog
      .getByRole("switch", { name: "自动安装可信技能" })
      .scrollIntoViewIfNeeded();
    await expect(
      dialog.getByRole("switch", { name: "自动安装可信技能" }),
    ).toBeInViewport();
    await dialog.getByRole("button", { name: "模型", exact: true }).click();
    await dialog.getByRole("button", { name: "添加模型", exact: true }).click();
    await expect(dialog.getByLabel("模型名称", { exact: true })).toBeFocused();
    expect(
      await dialog
        .locator(".settings-content")
        .evaluate((el) => el.scrollWidth - el.clientWidth),
    ).toBeLessThanOrEqual(1);
    await dialog.getByRole("button", { name: "关闭设置" }).click();
    await expect(dialog).not.toBeVisible();
  });
}
