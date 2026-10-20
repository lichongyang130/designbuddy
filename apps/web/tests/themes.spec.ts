import { test, expect } from "@playwright/test";

/**
 * Theme gallery.
 *
 * The assertions stay on deterministic structure (counts, labels, one open and
 * close) rather than pixel snapshots, so a legitimate palette tweak never turns
 * the suite red — while a theme that cannot be opened can.
 */

test("the sidebar entry opens a gallery of real previews", async ({ page }) => {
  await page.goto("/themes");

  await expect(page.getByRole("heading", { level: 1, name: "主题" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "主题", exact: true }),
  ).toHaveAttribute("aria-current", "page");

  const cards = page.locator(".th-card");
  await expect(cards).toHaveCount(12);

  // Previews are 16:9 DOM, not images: no <img> inside a card.
  await expect(cards.first().locator("img")).toHaveCount(0);
  await expect(cards.first().locator(".theme-preview")).toHaveAttribute("data-variant", "cover");
});

test("filtering and search narrow the grid without a submit button", async ({ page }) => {
  await page.goto("/themes");
  const cards = page.locator(".th-card");

  await page.getByRole("button", { name: "深色", exact: true }).click();
  await expect(cards).toHaveCount(2);

  await page.getByRole("button", { name: "全部", exact: true }).click();
  await page.getByRole("textbox", { name: "搜索主题" }).fill("杂志");
  await expect(cards).toHaveCount(2);

  await page.getByRole("textbox", { name: "搜索主题" }).fill("没有这个主题");
  await expect(page.getByText("没有匹配的主题")).toBeVisible();
  await page.getByRole("button", { name: "清除筛选" }).click();
  await expect(cards).toHaveCount(12);
});

test("a card opens a detail drawer and closing returns to the grid", async ({ page }) => {
  await page.goto("/themes");
  await page.getByRole("button", { name: "查看主题 墨绿经典" }).click();

  const drawer = page.getByRole("dialog", { name: "主题 墨绿经典" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("button", { name: "应用到当前演示稿" })).toBeVisible();

  // With no deck in this browser, applying explains what to do instead of failing.
  await drawer.getByRole("button", { name: "应用到当前演示稿" }).click();
  await expect(page.getByRole("status").filter({ hasText: "还没有演示稿" })).toBeVisible();

  await drawer.getByRole("button", { name: "关闭" }).click();
  await expect(drawer).toHaveCount(0);
});

test("the editor refuses an unreadable theme instead of saving it quietly", async ({ page }) => {
  await page.goto("/themes");
  await page.getByRole("button", { name: /新建主题/ }).click();

  const editor = page.getByRole("dialog", { name: "编辑主题" });
  await expect(editor).toBeVisible();
  await expect(editor.getByRole("button", { name: "保存", exact: true })).toBeEnabled();

  // Type a colour that is not a colour: validation must block the save.
  await editor.getByRole("textbox", { name: "正文色值" }).fill("ZZZZZZ");
  await expect(editor.getByRole("alert")).toBeVisible();
  await expect(editor.getByRole("button", { name: "保存", exact: true })).toBeDisabled();

  // A readable colour restores the save button.
  await editor.getByRole("textbox", { name: "正文色值" }).fill("#1F2A22");
  await expect(editor.getByRole("button", { name: "保存", exact: true })).toBeEnabled();

  await editor.getByRole("button", { name: "取消", exact: true }).click();
  await expect(editor).toHaveCount(0);
});
