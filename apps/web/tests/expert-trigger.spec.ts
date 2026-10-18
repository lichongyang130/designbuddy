import { expect, test } from "@playwright/test";

test("expert identity beside plus replaces @ and selects, switches, clears without sending", async ({ page }) => {
  await page.goto("/");
  const trigger = page.locator(".home-expert-trigger");
  const plus = page.getByRole("button", { name: "添加附件", exact: true });
  const input = page.getByRole("textbox", { name: "任务描述" });
  await expect(trigger).toHaveText("自动匹配专家");
  await expect(page.getByRole("button", { name: "添加文本上下文" })).toHaveCount(0);
  const a = (await plus.boundingBox())!, b = (await trigger.boundingBox())!;
  expect(b.x).toBeGreaterThanOrEqual(a.x + a.width);
  expect(Math.abs(a.y - b.y)).toBeLessThan(2);
  await input.fill("帮我开发一个 React 网站");
  await expect(page.locator(".home-expert-recommendations")).toHaveCount(0);
  await trigger.click();
  const menu = page.getByRole("dialog", { name: "专家选项", exact: true });
  await expect(menu).toBeVisible();
  await page.getByRole("button", { name: "手动选择专家", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "搜索专家" })).toBeFocused();
  await expect(page.getByRole("menu", { name: "添加到任务" })).toBeHidden();
  const m = (await menu.boundingBox())!;
  expect(m.y + m.height).toBeLessThanOrEqual((await trigger.boundingBox())!.y);
  await menu.getByRole("button", { name: "全栈开发专家", exact: true }).click();
  await expect(trigger).toHaveText("全栈开发专家");
  await expect(trigger.locator("img")).toBeVisible();
  await expect(input).toHaveValue("帮我开发一个 React 网站");
  await expect(input).toBeFocused();
  await expect(page).toHaveURL(/\/$/);
  await trigger.click();
  await page.getByRole("button", { name: "切换专家", exact: true }).click();
  await page.getByRole("textbox", { name: "搜索专家" }).fill("数据");
  await menu.getByRole("button", { name: "数据分析专家", exact: true }).click();
  await expect(trigger.locator("span").last()).toHaveText("数据分析专家");
  await trigger.click();
  await menu.getByRole("button", { name: "恢复自动匹配" }).click();
  await expect(trigger).toHaveText("自动匹配专家");
});

test("expert popup closes with Escape/outside and excludes the model menu", async ({ page }) => {
  await page.goto("/");
  const trigger = page.locator(".home-expert-trigger");
  await page.getByRole("button", { name: "选择大模型", exact: true }).click();
  await trigger.click();
  await expect(page.getByRole("dialog", { name: "选择大模型", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await trigger.press("Enter");
  await page.getByRole("button", { name: "手动选择专家", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "搜索专家" })).toBeFocused();
  await page.getByRole("textbox", { name: "任务描述" }).click();
  await expect(page.getByRole("dialog", { name: "专家选项" })).toHaveCount(0);
});

for (const width of [320, 375, 768, 1440]) {
  test(`expert picker fits ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.locator(".home-expert-trigger").click();
    const menu = page.getByRole("dialog", { name: "专家选项", exact: true });
    await expect(menu).toBeVisible();
    const box = (await menu.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(900);
    await menu.getByRole("button", { name: "手动选择专家", exact: true }).click();
    await menu.getByRole("button", { name: "全栈开发专家", exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if (width === 1440) await page.screenshot({ path: "../../.cache/home-expert-trigger.png" });
  });
}
