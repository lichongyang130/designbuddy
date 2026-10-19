import { test, expect } from "@playwright/test";
import { GUEST_STORAGE, registerViaAPI } from "./auth-helpers";

test.use({ storageState: GUEST_STORAGE });
for (const path of ["/", "/inspiration/welcome-07", "/models"]) {
  test(`signed-out ${path} renders the latest login before and after refresh`, async ({
    page,
  }) => {
    await page.goto(path);
    for (let pass = 0; pass < 2; pass++) {
      await expect(
        page.getByRole("heading", { name: "欢迎回来", exact: true }),
      ).toBeVisible();
      await expect(page.locator(".auth-mode-switch")).toBeVisible();
      await expect(page.getByLabel("用户名", { exact: true })).toBeVisible();
      await expect(page.locator(".welcome-methods")).toHaveCount(0);
      const form = await page.locator(".welcome-form").boundingBox();
      const oauth = await page.locator(".welcome-oauth").boundingBox();
      expect(form!.y + form!.height).toBeLessThan(oauth!.y);
      if (pass === 0) await page.reload();
    }
    const register = page
      .locator(".auth-mode-switch")
      .getByRole("link", { name: "注册", exact: true });
    await expect(register).toHaveAttribute(
      "href",
      `/register?next=${encodeURIComponent(path)}`,
    );
  });
}
test("a confirmed account still refreshes directly into its workspace", async ({
  page,
}) => {
  await page.goto("/");
  const username = `entry_${Date.now().toString(36)}`;
  await registerViaAPI(page, username, "entry-test-password-12");
  await page.reload();
  await expect(
    page.getByRole("button", { name: `账号菜单：${username}`, exact: true }),
  ).toBeVisible();
  await expect(page.locator(".auth-mode-switch")).toHaveCount(0);
});
