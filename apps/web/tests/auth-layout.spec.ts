import { test, expect } from "@playwright/test";
import { GUEST_STORAGE } from "./auth-helpers";

test.use({ storageState: GUEST_STORAGE });
for (const mode of ["login", "register"]) {
  for (const width of [1440, 768, 390, 320]) {
    test(`${mode} left form alignment and no clipping at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`/${mode}`);
      await expect(page.locator(".welcome-page--auth")).toBeVisible();
      const inputs = page.locator(".welcome-form input");
      await expect(inputs).toHaveCount(mode === "register" ? 3 : 2);
      const boxes = await inputs.evaluateAll((nodes) =>
        nodes.map((n) => {
          const b = n.getBoundingClientRect();
          return { x: b.x, width: b.width, height: b.height };
        }),
      );
      for (const b of boxes) {
        expect(b.height).toBeGreaterThanOrEqual(48);
        expect(Math.abs(b.x - boxes[0].x)).toBeLessThan(1);
        expect(Math.abs(b.width - boxes[0].width)).toBeLessThan(1);
      }
      const primary = await page
        .locator(".welcome-form .welcome-primary")
        .boundingBox();
      expect(Math.abs(primary!.width - boxes[0].width)).toBeLessThan(1);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      for (const locale of ["en", "ja", "zh-TW", "zh-CN"]) {
        await page.getByRole("combobox").selectOption(locale);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
      await page.locator(".welcome-footer").scrollIntoViewIfNeeded();
      await expect(page.getByRole("combobox")).toBeInViewport();
    });
  }
}
test("welcome keeps its original layout variant", async ({ page }) => {
  await page.goto("/welcome");
  await expect(page.locator(".welcome-page")).toBeVisible();
  await expect(page.locator(".welcome-page--auth")).toHaveCount(0);
  await expect(page.locator(".welcome-methods button")).toHaveCount(2);
});
test("provider retry text spans the complete form instead of an icon column", async ({
  page,
}) => {
  await page.route("**/api/auth/providers", (route) =>
    route.fulfill({ status: 503, json: { error: "Offline" } }),
  );
  await page.goto("/register");
  const retry = page.getByRole("button", { name: /无法加载登录选项/ });
  await expect(retry).toBeVisible();
  const display = await retry.evaluate((el) => getComputedStyle(el).display);
  expect(display).toBe("block");
});

test("approved form-first layout and top navigation preserve the destination", async ({
  page,
}) => {
  await page.goto("/login?next=%2Finspiration%2Fwelcome-07");
  const form = await page.locator(".welcome-form").boundingBox();
  const oauth = await page.locator(".welcome-oauth").boundingBox();
  expect(form!.y + form!.height).toBeLessThan(oauth!.y);
  const nav = page.locator(".auth-mode-switch");
  await expect(
    nav.getByRole("link", { name: "登录", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await nav.getByRole("link", { name: "注册", exact: true }).click();
  await expect(page).toHaveURL(/\/register\?next=%2Finspiration%2Fwelcome-07$/);
  await expect(
    nav.getByRole("link", { name: "注册", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByLabel("确认密码", { exact: true })).toBeVisible();
  await nav.getByRole("link", { name: "登录", exact: true }).click();
  await expect(page.getByLabel("确认密码", { exact: true })).toHaveCount(0);
});

test("password visibility controls are keyboard accessible, localized and never submit", async ({
  page,
}) => {
  await page.goto("/login");
  const input = page.getByLabel("密码", { exact: true });
  await input.fill("test-only-password-12");
  const show = page.getByRole("button", { name: "显示密码", exact: true });
  await show.focus();
  await page.keyboard.press("Enter");
  await expect(input).toHaveAttribute("type", "text");
  await expect(input).toHaveValue("test-only-password-12");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole("combobox").selectOption("en");
  await page
    .getByRole("button", { name: "Hide password", exact: true })
    .click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "password");
});
