import { test, expect } from "@playwright/test";
import { GUEST_STORAGE, registerViaAPI, loginViaAPI } from "./auth-helpers";

test.use({ storageState: GUEST_STORAGE });

const unique = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 6)}`;

test("a first-time visitor sees the immersive gallery welcome", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "把灵感，带进现实。" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /使用 Google 登录/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /使用 GitHub 登录/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /先逛逛工作台/ }).click();
  await expect(
    page.getByRole("heading", { name: /DesignBuddy 让工作更高效/ }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".welcome-page")).toHaveCount(0);
});
for (const path of ["/login", "/auth", "/register"]) {
  test(`auth route ${path} renders a real form in the gallery layout`, async ({
    page,
  }) => {
    await page.goto(path);
    await expect(
      page.getByRole("heading", {
        name: path === "/register" ? "创建账号" : "欢迎回来",
      }),
    ).toBeVisible();
    await expect(page.getByLabel("用户名", { exact: true })).toBeVisible();
    await expect(page.locator(".welcome-page")).toBeVisible();
  });
}

test("registering through the API still works and deep links load directly", async ({
  page,
}) => {
  const username = unique("gateless");
  await page.goto("/");
  await registerViaAPI(page, username, "gateless-pass-12345");
  await expect(
    page.getByRole("button", { name: `账号菜单：${username}`, exact: true }),
  ).toBeVisible();
  await page.goto("/workflows");
  await expect(
    page.getByRole("heading", { name: "工作流", exact: true }),
  ).toBeVisible();
});

test("clearing cookies keeps the session through the token fallback", async ({
  browser,
}) => {
  // Browsers that refuse third-party cookies (preview iframes) never store
  // the session cookie; the token fallback must keep the session alive.
  const context = await browser.newContext({ storageState: GUEST_STORAGE });
  const page = await context.newPage();
  const username = unique("uitoken");
  try {
    await page.goto("/");
    await registerViaAPI(page, username, "ui-token-pass-12");
    await expect(
      page.getByRole("button", { name: `账号菜单：${username}`, exact: true }),
    ).toBeVisible();
    await context.clearCookies();
    await page.reload();
    expect(await context.cookies()).toEqual([]);
    await expect(
      page.getByRole("button", { name: `账号菜单：${username}`, exact: true }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});

test("the server panel offers real account controls after guest entry", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /先逛逛工作台/ }).click();
  await page.getByRole("button", { name: "工作区状态", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "后台连接与账号" });
  await expect(dialog).toContainText("sqlite · 已连接");
  await expect(dialog.getByLabel("服务器用户名")).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "登录账号", exact: true }),
  ).toBeVisible();
});

test("an account session can sign back in through the API after a wipe", async ({
  browser,
}) => {
  const username = unique("uirelogin");
  const context = await browser.newContext({ storageState: GUEST_STORAGE });
  const page = await context.newPage();
  try {
    await page.goto("/");
    await registerViaAPI(page, username, "uirelogin-pass-12");
    const menu = page.getByRole("button", {
      name: `账号菜单：${username}`,
      exact: true,
    });
    await expect(menu).toBeVisible();
    await context.clearCookies();
    await page.evaluate(() =>
      localStorage.removeItem("designbuddy.auth-token.v1"),
    );
    await page.reload();
    // A wiped account returns to the welcome until the visitor explicitly enters.
    await expect(
      page.getByRole("heading", { name: "把灵感，带进现实。" }),
    ).toBeVisible();
    await loginViaAPI(page, username, "uirelogin-pass-12");
    await expect(menu).toBeVisible();
  } finally {
    await context.close();
  }
});
