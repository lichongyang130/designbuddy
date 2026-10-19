import { test, expect, type Page } from "@playwright/test";
const settings = (page: Page) =>
  page.getByRole("dialog", { name: "设置", exact: true });
async function openProfile(page: Page) {
  await page.goto("/");
  await expect(page.locator("dialog.settings-window")).toBeAttached();
  await page.keyboard.press("Control+,");
  await settings(page)
    .getByRole("button", { name: "个人主页", exact: true })
    .click();
  await expect(
    settings(page).getByRole("button", { name: "编辑资料" }),
  ).toBeVisible();
}

test("settings profile shows the real identity instead of a wallet dashboard", async ({
  page,
}) => {
  await openProfile(page);
  const account = await page.evaluate(
    async () => (await (await fetch("/api/auth/me")).json()).user,
  );
  await expect(
    settings(page).locator(".settings-profile-identity"),
  ).toContainText(account.displayName || account.username);
  await expect(settings(page)).toContainText("账号资料");
  await expect(settings(page)).not.toContainText("$0.00");
  await expect(
    settings(page).getByRole("button", { name: "后台连接状态" }),
  ).toBeVisible();
});

test("profile edit supports cancel, saves to the server and persists after reload", async ({
  page,
}) => {
  await openProfile(page);
  const original = await page.evaluate(
    async () => (await (await fetch("/api/auth/me")).json()).user,
  );
  const panel = settings(page);
  await panel.getByRole("button", { name: "编辑资料" }).click();
  await panel.getByLabel("显示名称", { exact: true }).fill("Not saved");
  await panel.getByRole("button", { name: "取消", exact: true }).click();
  await expect(panel.locator(".settings-profile-identity")).not.toContainText(
    "Not saved",
  );
  try {
    await panel.getByRole("button", { name: "编辑资料" }).click();
    await panel
      .getByLabel("显示名称", { exact: true })
      .fill("Settings redesign test");
    await panel.getByRole("button", { name: "保存更改" }).click();
    await expect(panel.locator(".settings-profile-identity")).toContainText(
      "Settings redesign test",
    );
    await expect(panel.getByRole("status")).toContainText("更改已保存");
    await page.reload();
    await expect(page.locator("dialog.settings-window")).toBeAttached();
    await page.keyboard.press("Control+,");
    await settings(page)
      .getByRole("button", { name: "个人主页", exact: true })
      .click();
    await expect(
      settings(page).locator(".settings-profile-identity"),
    ).toContainText("Settings redesign test");
  } finally {
    await page.evaluate(async ({ displayName, email }) => {
      await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, email }),
      });
    }, original);
  }
});

test("profile account entry still navigates to the full account page", async ({
  page,
}) => {
  await openProfile(page);
  await settings(page)
    .getByRole("button", { name: "账号与数据", exact: true })
    .click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(
    page.getByRole("heading", { name: "个人主页", level: 1 }),
  ).toBeVisible();
});
