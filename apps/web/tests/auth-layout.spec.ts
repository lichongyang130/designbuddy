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
