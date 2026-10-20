import { test, expect, type Page } from "@playwright/test";

const settings = (page: Page) =>
  page.getByRole("dialog", { name: "设置", exact: true });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  const reset = await page.evaluate(async () => {
    const response = await fetch("/api/profile/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "workspace.preferences", value: {} }),
    });
    localStorage.clear();
    return response.ok;
  });
  expect(reset).toBe(true);
  await page.reload();
});

async function openAppearance(page: Page) {
  await page.goto("/");
  await expect(page.locator("dialog.settings-window")).toBeAttached();
  await page.keyboard.press("Control+,");
  await expect(settings(page)).toBeVisible();
  await settings(page).getByRole("button", { name: "外观", exact: true }).click();
}

test("appearance follows the reference interface-style layout", async ({ page }) => {
  await openAppearance(page);
  const panel = settings(page);
  const section = panel.locator(".settings-appearance");

  // Section heading + the hairline rule under it.
  await expect(section.getByRole("heading", { name: "界面样式" })).toBeVisible();
  await expect(section.locator(".settings-appearance-rule").first()).toBeVisible();

  // One row per setting: title + grey help on the left, control on the right.
  await expect(section.locator(".settings-appearance-row")).toHaveCount(9);
  await expect(section.locator(".settings-appearance-name")).toHaveText([
    "主题模式",
    "控制台主题",
    "链接打开方式",
    "语言",
    "字体风格",
    "内容宽度",
    "文件图标",
    "模糊与玻璃效果",
  ]);

  // Three theme preview cards, laid out in one grid row.
  const cards = section.locator(".settings-appearance-card");
  await expect(cards).toHaveCount(3);
  await expect(section.locator(".settings-appearance-card-label")).toHaveText([
    "跟随系统",
    "浅色",
    "深色",
  ]);
  await expect(cards.nth(1).locator(".settings-appearance-preview")).toHaveCSS(
    "background-color",
    "rgb(246, 247, 249)",
  );
  await expect(cards.nth(2).locator(".settings-appearance-preview")).toHaveCSS(
    "background-color",
    "rgb(23, 26, 33)",
  );
});

test("every appearance control is real: nothing is disabled or inert", async ({ page }) => {
  await openAppearance(page);
  const section = settings(page).locator(".settings-appearance");

  // No leftover placeholders: every select and switch is interactive.
  await expect(section.locator("select:disabled")).toHaveCount(0);
  await expect(section.locator("button[role=\"switch\"]:disabled")).toHaveCount(0);

  // 主题模式 + the preview cards drive the document theme.
  await section.getByLabel("主题模式").selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(section.locator(".settings-appearance-card").nth(2)).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await section.locator(".settings-appearance-card").nth(1).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(section.locator(".settings-appearance-card").nth(1)).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await section.getByRole("button", { name: "在浅色与深色之间切换" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  // 控制台主题 is its own preference and applies to the document.
  await section.getByLabel("控制台主题").selectOption("light");
  await expect(page.locator("html")).toHaveAttribute("data-console-theme", "light");
  await section.getByLabel("控制台主题").selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-console-theme", "dark");

  // 字体风格 really changes the rendered font.
  await section.getByLabel("字体风格").selectOption("serif");
  await expect(page.locator("body")).toHaveCSS("font-family", /Georgia|serif/i);
  await section.getByLabel("字体风格").selectOption("sans");

  // 内容宽度 sets the task content max width variable.
  const contentMax = () =>
    page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--db-content-max").trim(),
    );
  await section.getByLabel("内容宽度").selectOption("narrow");
  await expect.poll(contentMax).toBe("680px");
  await section.getByLabel("内容宽度").selectOption("wide");
  await expect.poll(contentMax).toBe("1320px");
  await section.getByLabel("内容宽度").selectOption("standard");
  await expect.poll(contentMax).toBe("920px");

  // 文件图标 switches between colored and monochrome tints.
  await section.getByLabel("文件图标").selectOption("mono");
  await expect(page.locator("html")).toHaveAttribute("data-file-icons", "mono");
  await expect(section.getByLabel("文件图标")).toHaveValue("mono");
  await section.getByLabel("文件图标").selectOption("color");
  await expect(page.locator("html")).toHaveAttribute("data-file-icons", "color");

  // 模糊与玻璃效果 toggles the real glass layer.
  const glass = section.getByRole("switch");
  await expect(glass).toHaveAttribute("aria-checked", "true");
  await glass.click();
  await expect(page.locator("html")).toHaveAttribute("data-glass", "off");
  await expect(glass).toHaveAttribute("aria-checked", "false");
  await glass.click();
  await expect(page.locator("html")).toHaveAttribute("data-glass", "on");
});

test("link behavior and density are real and shared with 常规", async ({ page }) => {
  await openAppearance(page);
  const section = settings(page).locator(".settings-appearance");
  await section.getByLabel("界面链接打开方式").selectOption("new-tab");
  await section.getByRole("radio", { name: "紧凑" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-density", "compact");

  // Both controls persist and stay in sync with the 常规 section.
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.locator("dialog.settings-window")).toBeAttached();
  await page.waitForTimeout(400);
  await page.keyboard.press("Control+,");
  const dialog = settings(page);
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "外观", exact: true }).click();
  await expect(dialog.locator(".settings-appearance").getByLabel("界面链接打开方式")).toHaveValue(
    "new-tab",
  );
  await dialog.getByRole("button", { name: "通用", exact: true }).click();
  await expect(dialog.getByLabel("链接打开方式", { exact: true })).toHaveValue("new-tab");
  await expect(page.locator("html")).toHaveAttribute("data-density", "compact");
});

test("the appearance language row drives the interface language", async ({ page }) => {
  await openAppearance(page);
  const section = settings(page).locator(".settings-appearance");
  await section.getByLabel("界面语言").selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  // Changing the language closes the settings window (existing behaviour), so
  // reopen it and confirm the row is translated, then switch back.
  await expect(settings(page)).toBeHidden();
  await page.keyboard.press("Control+,");
  const english = page.getByRole("dialog", { name: "Settings", exact: true });
  await expect(english).toBeVisible();
  await english.getByRole("button", { name: "Appearance", exact: true }).click();
  await expect(english.locator(".settings-appearance").getByLabel("Interface language")).toBeVisible();
  await english.locator(".settings-appearance").getByLabel("Interface language").selectOption("zh-CN");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
});
