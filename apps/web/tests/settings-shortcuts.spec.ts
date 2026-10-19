import { test, expect } from "@playwright/test";

async function openShortcuts(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(page.locator("dialog.settings-window")).toBeAttached();
  await page.keyboard.press("Control+,");
  const dialog = page.getByRole("dialog", { name: "设置", exact: true });
  await dialog.getByRole("button", { name: "快捷键", exact: true }).click();
  return dialog;
}

test("shortcuts have grouped keycaps, cancellable recording, and reset", async ({
  page,
}) => {
  const dialog = await openShortcuts(page);
  await expect(dialog.locator(".shortcut-action")).toHaveCount(5);
  await expect(dialog.locator(".shortcuts-fixed > div")).toHaveCount(3);
  await expect(dialog.locator(".shortcut-keys kbd").first()).toBeVisible();
  await dialog.getByRole("button", { name: "重新录制" }).first().click();
  await expect(dialog.locator(".shortcut-action.is-recording")).toHaveCount(1);
  await expect(dialog.locator("#shortcut-recording-hint")).toContainText("Esc");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".shortcut-action.is-recording")).toHaveCount(0);
  await expect(dialog.getByRole("status")).toContainText("取消");
  await dialog.getByRole("button", { name: "重新录制" }).nth(4).click();
  await page.keyboard.press("Control+Alt+U");
  await expect(
    dialog.locator(".shortcut-action").nth(4).locator(".shortcut-keys"),
  ).toHaveAttribute("aria-label", "Ctrl/⌘ + Alt + U");
  await dialog.getByRole("button", { name: "恢复默认", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("已恢复默认");
});

test("shortcuts fit narrow settings panes in light and dark themes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 600, height: 800 });
  const dialog = await openShortcuts(page);
  for (const theme of ["light", "dark"]) {
    await page.evaluate(
      (value) => (document.documentElement.dataset.theme = value),
      theme,
    );
    const pane = dialog.locator(".settings-content");
    expect(
      await pane.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    await expect(
      dialog.getByRole("button", { name: "重新录制" }).first(),
    ).toBeVisible();
  }
});
