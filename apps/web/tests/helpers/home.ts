import { expect, type Locator, type Page } from "@playwright/test";

/**
 * The launcher is one input box. The mode is chosen in the 「＋」 menu, the
 * workspace is a small menu (where the task is saved) and the policy is a
 * select, both under the input; interactive samples live behind ⌘K. These
 * helpers keep the specs reading in user terms.
 */

/**
 * Composer defaults live in the account, not in the browser context, so a spec
 * that pins 「仅本地」 or 「需要确认后执行」 would otherwise change how every later
 * spec in the run behaves. Call this before a spec that expects the defaults.
 */
export async function resetComposerDefaults(page: Page) {
  await page.goto("/");
  const reset = await page.evaluate(async () => {
    const response = await fetch("/api/profile/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "workspace.preferences", value: {} }),
    });
    return response.ok;
  });
  expect(reset).toBe(true);
  const reloaded = page.waitForResponse(
    (response) =>
      response.url().includes("/profile/preferences") && response.request().method() === "GET",
  );
  await page.reload();
  await reloaded;
}

export const draft = (page: Page): Locator =>
  page.getByRole("textbox", { name: "任务描述", exact: true });

/**
 * Pinning the mode is still a real path — it lives in the composer's 「＋」 menu
 * (模式), not in a tab row, because the draft already infers it.
 */
export async function setMode(page: Page, label: string) {
  await page.getByRole("button", { name: "添加附件", exact: true }).click();
  await page.getByRole("menuitem", { name: "模式", exact: true }).click();
  await page.getByRole("menuitemradio", { name: label, exact: true }).click();
  await expect(
    page.getByRole("button", { name: "添加附件", exact: true }),
  ).toBeFocused();
}

/** Reads the pinned mode back out of the same menu, then closes it. */
export async function expectMode(page: Page, label: string) {
  await page.getByRole("button", { name: "添加附件", exact: true }).click();
  await page.getByRole("menuitem", { name: "模式", exact: true }).click();
  await expect(
    page.getByRole("menuitemradio", { name: label, exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menuitem", { name: "模式", exact: true })).toHaveCount(0);
}

export async function setPermission(page: Page, value: string) {
  const select = page.getByLabel("任务权限", { exact: true });
  await select.selectOption(value);
  await expect(select).toHaveValue(value);
}

/** Workspace is a menu under the input (trigger + menuitemradio), not a select. */
export async function setWorkspace(page: Page, value: string) {
  const trigger = page.getByRole("button", { name: "工作空间", exact: true });
  await trigger.click();
  await page
    .getByRole("menu", { name: "工作空间", exact: true })
    .getByRole("menuitemradio", { name: new RegExp(`^${value}`) })
    .click();
  await expect(trigger).toContainText(value === "默认工作空间" ? "选择工作空间" : value);
}

export async function expectWorkspace(page: Page, value: string) {
  await expect(
    page.getByRole("button", { name: "工作空间", exact: true }),
  ).toContainText(value === "默认工作空间" ? "选择工作空间" : value);
}

/**
 * The interactive samples are behind ⌘K now: search the scene, then hit its
 * 「预览」 action instead of opening a 15-card gallery.
 */
export async function openScenePreview(page: Page, scene: string) {
  // The shortcut listener is attached by React after hydration, so on a cold
  // dev-server visit the first ⌘K can land before anyone is listening. Opening
  // the palette is idempotent, so retrying is safe.
  const search = page.getByRole("textbox", { name: "搜索场景、插件、技能" });
  await expect(draft(page)).toBeVisible();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await page.keyboard.press("ControlOrMeta+k");
    if (await search.count()) break;
    await page.waitForTimeout(300);
  }
  await expect(search).toBeVisible();
  await search.fill(scene);
  await page.getByRole("button", { name: `预览${scene}`, exact: true }).click();
  const modal = page.getByRole("dialog", { name: `${scene}场景预览`, exact: true });
  await expect(modal).toBeVisible();
  return modal;
}
