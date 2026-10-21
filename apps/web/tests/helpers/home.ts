import { expect, type Locator, type Page } from "@playwright/test";

/**
 * The launcher is one input box now. Everything that used to be a permanent
 * control on the page (mode tabs, workspace, permission, the 15 scene cards)
 * moved one interaction away, so the specs share these helpers instead of each
 * one re-deriving the new path.
 */

export const draft = (page: Page): Locator =>
  page.getByRole("textbox", { name: "任务描述", exact: true });

export const MODE_VALUES: Record<string, string> = {
  办公提效: "office",
  设计制作: "design",
  网页应用: "code",
};

/** The mode is inferred from the draft; picking one pins it. */
export async function setMode(page: Page, label: string) {
  const value = MODE_VALUES[label] ?? label;
  const select = page.getByRole("combobox", { name: "任务模式", exact: true });
  await select.selectOption(value);
  await expect(select).toHaveValue(value);
}

export async function openComposerSettings(page: Page) {
  const toggle = page.getByRole("button", { name: "更多设置", exact: true });
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  await expect(page.locator(".composer-settings")).toBeVisible();
}

export async function setPermission(page: Page, value: string) {
  await openComposerSettings(page);
  await page.getByLabel("任务权限", { exact: true }).selectOption(value);
}

export async function setWorkspace(page: Page, value: string) {
  await openComposerSettings(page);
  await page.getByLabel("工作空间", { exact: true }).selectOption(value);
}

/**
 * The interactive samples are behind ⌘K now: search the scene, then hit its
 * 「预览」 action instead of opening a 15-card gallery.
 */
export async function openScenePreview(page: Page, scene: string) {
  await page.keyboard.press("ControlOrMeta+k");
  const search = page.getByRole("textbox", { name: "搜索场景、插件、技能" });
  await expect(search).toBeVisible();
  await search.fill(scene);
  await page.getByRole("button", { name: `预览${scene}`, exact: true }).click();
  const modal = page.getByRole("dialog", { name: `${scene}场景预览`, exact: true });
  await expect(modal).toBeVisible();
  return modal;
}
