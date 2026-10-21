import { expect, test } from "@playwright/test";

/**
 * The launcher's geometry contract.
 *
 * Before: hero → mode tabs → shortcut row → composer → rail → recommendations →
 * plugin picks → example gallery → more scenes → two explore links.
 * Now: hero → composer → three examples → recent. These tests pin that shape,
 * the centered column, and that nothing overflows on a phone.
 */

const title = /DesignBuddy 让工作更高效/;

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
});

test("shared sidebar stays as it was", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const sidebar = page.locator(".app-sidebar");
  expect((await sidebar.boundingBox())!.width).toBe(239);
  expect((await sidebar.boundingBox())!.height).toBe(1000);
  await expect(sidebar.getByRole("button", { name: "首页", exact: true })).toBeVisible();
  for (const name of ["插件", "主题", "模版", "定时任务"]) {
    await expect(sidebar.getByRole("button", { name, exact: true })).toBeVisible();
  }
  await expect(sidebar.getByRole("button", { name: /^账号菜单：/ })).toBeVisible();
  await expect(sidebar).toHaveCSS("background-color", "rgb(242, 242, 242)");
  await expect(page.locator(".home27")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.locator(".home27")).toHaveCSS("background-image", "none");
});

test("hero, composer, examples and recent stack in one centered column", async ({ page }) => {
  for (const width of [320, 375, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    const box = async (selector: string) => (await page.locator(selector).boundingBox())!;

    const hero = await box(".home27-hero");
    const composer = await box(".composer-shell");
    const footer = await box(".composer-footer");
    const suggestions = await box(".home-suggestion-bar");

    expect(composer.y).toBeGreaterThan(hero.y + hero.height);
    expect(footer.y).toBeGreaterThan(composer.y + composer.height - 1);
    expect(suggestions.y).toBeGreaterThan(footer.y + footer.height - 1);
    expect(composer.width).toBeLessThanOrEqual(960);
    expect(composer.x + composer.width).toBeLessThanOrEqual(width);
    // The example row starts where the card starts, like the meta row above it.
    expect(Math.abs(suggestions.x - composer.x)).toBeLessThan(2);
    expect(suggestions.width).toBeLessThanOrEqual(composer.width + 1);
    // Centred while it fits: the space above the title and below the examples
    // should feel shared rather than pooling at the bottom.
    const below = 900 - (suggestions.y + suggestions.height);
    if (width >= 768) expect(hero.y).toBeGreaterThan(48);
    expect(below).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if (width === 1440) await page.screenshot({ path: "../../.cache/home-launcher-1440.png" });
  }
});

test("the whole page fits without scrolling on a laptop screen", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const doc = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    innerHeight: window.innerHeight,
  }));
  expect(doc.scrollHeight).toBeLessThanOrEqual(doc.innerHeight + 8);

  const input = page.getByRole("textbox", { name: "任务描述" });
  await input.fill("把 Q3 销售数据整理成一份复盘");
  const after = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    innerHeight: window.innerHeight,
  }));
  expect(after.scrollHeight).toBeLessThanOrEqual(after.innerHeight + 8);
});

test("recent work only appears once something exists", async ({ page }) => {
  await expect(page.locator(".home-recent")).toHaveCount(0);

  await page.evaluate(() => {
    localStorage.setItem(
      "designbuddy.projects.v1",
      JSON.stringify([
        {
          id: "recent-demo",
          name: "Q3 复盘",
          prompt: "把 Q3 复盘写成汇报",
          files: [],
          status: "draft",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]),
    );
  });
  await page.reload();
  await expect(page.locator(".home-recent")).toBeVisible();
  await expect(page.locator(".home-recent li")).toHaveCount(1);
  await expect(page.locator(".home-recent")).toContainText("Q3 复盘");
});

test("the two selects under the input stay inside the viewport", async ({ page }) => {
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole("button", { name: "工作空间", exact: true })).toBeVisible();
    await expect(page.getByLabel("任务权限")).toBeVisible();
    const trigger = (await page.getByRole("button", { name: "工作空间", exact: true }).boundingBox())!;
    expect(trigger.x).toBeGreaterThanOrEqual(-1);
    expect(trigger.x + trigger.width).toBeLessThanOrEqual(width + 1);
    for (const select of await page.locator(".footer-select").all()) {
      const box = (await select.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(-1);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
    }
  }
});

test("keyboard order reaches the input before anything else", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("textbox", { name: "任务描述" }).focus();
  await expect(page.getByRole("textbox", { name: "任务描述" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("textbox", { name: "任务描述" })).not.toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("textbox", { name: "任务描述" })).toBeFocused();
});

test("⌘K still reaches every destination the old page linked to", async ({ page }) => {
  await page.keyboard.press("ControlOrMeta+k");
  const palette = page.getByRole("dialog");
  await expect(palette).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
