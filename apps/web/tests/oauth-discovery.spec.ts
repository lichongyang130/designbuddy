import { test, expect } from "@playwright/test";
import { GUEST_STORAGE } from "./auth-helpers";

test.use({ storageState: GUEST_STORAGE });
for (const path of ["/", "/login", "/register"]) {
  test(`${path}: provider discovery works when cookies and guest-session creation fail`, async ({
    page,
    context,
  }) => {
    await context.addCookies([
      {
        name: "designbuddy_session",
        value: "x".repeat(43),
        domain: "127.0.0.1",
        path: "/",
      },
    ]);
    await page.addInitScript(() =>
      localStorage.setItem("designbuddy.auth-token.v1", "x".repeat(43)),
    );
    await page.route("**/api/local/session", (route) =>
      route.fulfill({
        status: 503,
        json: { error: "Session endpoint unavailable" },
      }),
    );
    const requests: { cookie?: string; authorization?: string }[] = [];
    page.on("request", (r) => {
      if (new URL(r.url()).pathname === "/api/auth/providers")
        requests.push(r.headers());
    });
    // Use the real proxied provider endpoint, not a mocked successful response.
    await page.goto(path);
    await expect(page.locator(".welcome-oauth small")).toHaveCount(2);
    await expect(
      page.getByRole("button", { name: /无法加载登录选项/ }),
    ).toHaveCount(0);
    expect(requests.length).toBeGreaterThan(0);
    for (const headers of requests) {
      expect(headers.cookie).toBeUndefined();
      expect(headers.authorization).toBeUndefined();
    }
    await page.getByRole("button", { name: /使用 Google 登录/ }).click();
    await expect(page.getByRole("alert")).toContainText("尚未配置");
  });
}
test("invalid provider JSON is not treated as a configured login provider", async ({
  page,
}) => {
  await page.route("**/api/auth/providers", (route) =>
    route.fulfill({ json: { google: "true", github: true } }),
  );
  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: /无法加载登录选项/ }),
  ).toBeVisible();
  await page.unroute("**/api/auth/providers");
  await page.getByRole("button", { name: /无法加载登录选项/ }).click();
  await expect(page.locator(".welcome-oauth small")).toHaveCount(2);
});
