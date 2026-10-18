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

  // One row per reference line: 主题模式, 终端主题, 终端链接, 语言, 字体风格,
  // 内容宽度, 文件图标, 模糊与玻璃效果, plus the real density row.
  await expect(section.locator(".settings-appearance-row")).toHaveCount(9);
  await expect(section.locator(".settings-appearance-name")).toHaveText([
    "主题模式",
    "终端主题",
    "终端链接使用内置浏览器",
    "语言",
    "字体风格",
    "内容宽度",
    "文件图标",
    "模糊与玻璃效果",
  ]);

  // Four style preview cards, laid out in one grid row, with the reference
  // names and palettes.
  const previews = section.locator(".settings-appearance-card");
  await expect(previews).toHaveCount(4);
  await expect(section.locator(".settings-appearance-card-label")).toHaveText([
    "森林",
    "节能",
    "蜜蜂",
    "羊皮纸",
  ]);
  await expect(previews.nth(0).locator(".settings-appearance-preview")).toHaveCSS(
    "background-color",
    "rgb(242, 244, 242)",
  );
  await expect(previews.nth(2).locator(".settings-appearance-preview")).toHaveCSS(
    "background-color",
    "rgb(247, 242, 216)",
  );
});

test("theme mode is a real control and unsupported rows stay inert", async ({ page }) => {
  await openAppearance(page);
  const section = settings(page).locator(".settings-appearance");

  // 主题模式 drives the document theme, and the small icon button flips it.
  await section.getByLabel("主题模式").selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await section.getByRole("button", { name: "在浅色与深色之间切换" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  // Rows with no counterpart in this build are present but inert: the selects
  // are disabled, the switches are disabled and unchecked. No fake state.
  for (const label of ["终端主题", "字体风格", "内容宽度", "文件图标"]) {
    await expect(section.getByLabel(label)).toBeDisabled();
  }
  const switches = section.getByRole("switch");
  await expect(switches).toHaveCount(2);
  for (const item of await switches.all()) {
    await expect(item).toBeDisabled();
    await expect(item).toHaveAttribute("aria-checked", "false");
  }

  // The preview cards are static artwork: no button, checkbox or radio inside.
  await expect(section.locator(".settings-appearance-previews")).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await expect(
    section.locator(".settings-appearance-previews").getByRole("button"),
  ).toHaveCount(0);
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

test("density keeps working from the appearance section", async ({ page }) => {
  await openAppearance(page);
  const section = settings(page).locator(".settings-appearance");
  await section.getByRole("radio", { name: "紧凑" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-density", "compact");
  await section.getByRole("radio", { name: "舒适" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-density", "comfortable");
});
