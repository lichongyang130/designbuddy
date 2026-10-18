import { test, expect } from "@playwright/test";
import { GUEST_STORAGE, registerViaAPI, loginViaAPI } from "./auth-helpers";

test.use({ storageState: GUEST_STORAGE });

const unique = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 6)}`;

// NOTE (gate off): while AUTH_GATE_ENABLED is false there is no login wall,
// the /login /register /auth routes redirect home, and the server panel has
// no auth controls. The gate-era UI tests (login/register forms, OAuth
// buttons, panel sign-in) are parked in git history; restore them when the
// gate flips back on.

test("a first-time visitor lands directly in the app, with no login wall", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /DesignBuddy 让工作更高效/ }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "欢迎回来" })).toHaveCount(0);
  await expect(page.locator(".auth-loading")).toHaveCount(0);
});

for (const legacy of ["/login", "/register", "/auth"]) {
  test(`legacy route ${legacy} redirects home instead of showing auth UI`, async ({
    page,
  }) => {
    await page.goto(legacy);
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole("heading", { name: /DesignBuddy 让工作更高效/ }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "欢迎回来" })).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "创建账号" }),
    ).toHaveCount(0);
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

test("the server panel shows connection status without auth controls", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "工作区状态", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "后台连接状态" });
  await expect(dialog).toContainText("sqlite · 已连接");
  await expect(dialog).toContainText("免登录模式");
  await expect(
    dialog.getByRole("button", { name: "登录账号", exact: true }),
  ).toHaveCount(0);
  await expect(dialog.getByLabel("服务器用户名")).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "退出服务器账号" }),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: "关闭服务器窗口" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
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
    // No login wall: the app loads straight into a fresh guest session.
    await expect(
      page.getByRole("heading", { name: /DesignBuddy 让工作更高效/ }),
    ).toBeVisible();
    await loginViaAPI(page, username, "uirelogin-pass-12");
    await expect(menu).toBeVisible();
  } finally {
    await context.close();
  }
});
