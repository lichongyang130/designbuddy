import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("reference layout, default mode and real task count", async ({ page }) => {
  await expect(
    page.getByRole("heading", { name: /DesignBuddy 让工作更高效/ }),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: "办公提效" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("button", { name: "开始任务" })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "任务（0）", exact: true }),
  ).toBeVisible();
  const sidebar = await page.locator(".app-sidebar").boundingBox();
  const composer = await page.locator(".composer-shell").boundingBox();
  expect(sidebar?.width).toBe(239);
  expect(composer!.x).toBeGreaterThan(sidebar!.width);
  expect(composer!.width).toBeGreaterThan(650);
  await expect(page.locator(".home27-shortcut")).toHaveCount(6);
  await expect(page.locator(".home27-scene")).toHaveCount(5);
  await expect(page.locator(".main-workspace")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await expect(page.locator(".app-sidebar")).toHaveCSS(
    "background-color",
    "rgb(242, 242, 242)",
  );
  await expect(page.locator(".home-buddy")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /做任务赢积分好礼/ }),
  ).toHaveCount(0);
});

test("mode keyboard navigation and additional quick scenes", async ({
  page,
}) => {
  await page.getByRole("tab", { name: "办公提效" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "设计制作" })).toBeFocused();
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: "网页应用" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.setViewportSize({ width: 375, height: 812 });
  await page.locator(".home27-more-scenes summary").click();
  await page.getByRole("button", { name: "网页设计", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "任务描述" })).toHaveValue(
    /网站首页/,
  );
  await expect(page.getByRole("button", { name: "开始任务" })).toBeEnabled();
});

test("model selection, Escape and outside click", async ({ page }) => {
  const trigger = page.getByRole("button", { name: "选择大模型", exact: true });
  await trigger.click();
  await page.getByRole("option", { name: /GLM-5.3-Flash/ }).click();
  await expect(trigger).toContainText("GLM-5.3-Flash");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await trigger.click();
  await page.getByRole("button", { name: "返回 DesignBuddy 首页" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("text attachment can be read and removed", async ({ page }) => {
  await page
    .locator('input.visually-hidden-input[type="file"]')
    .setInputFiles({
      name: "brief.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("首页设计说明"),
    });
  await expect(page.locator(".attachment-chip")).toContainText("brief.txt ✓");
  await page.getByRole("button", { name: "移除附件 brief.txt" }).click();
  await expect(page.locator(".attachment-chip")).toHaveCount(0);
});

test("Chinese IME does not submit; local-only task preserves selections", async ({
  page,
}) => {
  const prompt = page.getByRole("textbox", { name: "任务描述" });
  await prompt.fill("测试首页需求");
  await prompt.dispatchEvent("keydown", {
    key: "Enter",
    code: "Enter",
    isComposing: true,
  });
  await expect(page).toHaveURL(/\/$/);
  await prompt.press("Shift+Enter");
  await expect(page).toHaveURL(/\/$/);
  await page.getByLabel("工作空间", { exact: true }).selectOption("个人空间");
  await page.getByLabel("任务权限").selectOption("仅本地");
  await page.getByRole("button", { name: "开始任务" }).click();
  await expect(page).toHaveURL(/\/tasks\//);
  const saved = await page.evaluate(() =>
    Object.values(localStorage).find((value) => value.includes("测试首页需求")),
  );
  expect(saved).toContain("个人空间");
  expect(saved).toContain("仅本地");
  expect(saved).toContain("办公提效需求");
});

for (const width of [320, 375, 768, 1440]) {
  test(`no horizontal overflow or clipped model menu at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole("textbox", { name: "任务描述" })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.getByRole("button", { name: "选择大模型", exact: true }).click();
    const box = await page.getByRole("dialog").boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(900);
  });
}
