import { test, expect } from "@playwright/test";
import {
  GUEST_STORAGE,
  freshAccountPage,
  registerViaAPI,
} from "./auth-helpers";

test.use({ storageState: GUEST_STORAGE });

const unique = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 6)}`;

test("a first-time visitor lands on the login gate with Google and GitHub buttons", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "欢迎回来" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /使用 Google 登录/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /使用 GitHub 登录/ }),
  ).toBeVisible();
  await expect(page.locator(".app-sidebar")).toHaveCount(0);
});

test("registering through the UI creates the account and enters the app", async ({
  page,
}) => {
  const username = unique("uireg");
  await page.goto("/register");
  await expect(page.getByRole("heading", { name: "创建账号" })).toBeVisible();
  await page.getByLabel("用户名", { exact: true }).fill(username);
  await page.getByLabel("密码", { exact: true }).fill("ui-register-pass-1");
  await page.getByLabel("确认密码", { exact: true }).fill("ui-register-pass-1");
  await page.getByRole("button", { name: "注册并登录" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: /DesignBuddy 让工作更高效/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: `账号菜单：${username}`, exact: true }),
  ).toBeVisible();
});

test("a mismatched confirmation blocks the register submit", async ({
  page,
}) => {
  await page.goto("/register");
  await page.getByLabel("用户名", { exact: true }).fill(unique("uimismatch"));
  await page.getByLabel("密码", { exact: true }).fill("ui-register-pass-1");
  await page.getByLabel("确认密码", { exact: true }).fill("something-else-22");
  await expect(page.getByRole("alert")).toContainText("两次输入的密码不一致");
  await expect(
    page.getByRole("button", { name: "注册并登录" }),
  ).toBeDisabled();
});

test("logging in through the UI returns to the originally requested page", async ({
  page,
}) => {
  const username = unique("uilogin");
  await page.goto("/");
  await registerViaAPI(page, username, "ui-login-pass-12345");
  await page.context().clearCookies();
  await page.goto("/workflows");
  await expect(page.getByRole("heading", { name: "欢迎回来" })).toBeVisible();
  await page.getByLabel("用户名", { exact: true }).fill(username);
  await page.getByLabel("密码", { exact: true }).fill("ui-login-pass-12345");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/workflows$/);
  await expect(
    page.getByRole("heading", { name: "工作流", exact: true }),
  ).toBeVisible();
});

test("a wrong password fails honestly on the login form", async ({
  page,
}) => {
  const username = unique("uibad");
  await page.goto("/");
  await registerViaAPI(page, username, "ui-login-pass-12345");
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("用户名", { exact: true }).fill(username);
  await page.getByLabel("密码", { exact: true }).fill("definitely-wrong-1");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("用户名或密码不正确");
  await expect(page).toHaveURL(/\/login$/);
});

test("unconfigured OAuth providers explain themselves instead of navigating away", async ({
  page,
}) => {
  await page.goto("/login");
  const providers = await page.evaluate(async () => {
    const response = await fetch("/api/auth/providers", {
      credentials: "include",
    });
    return (await response.json()) as { google: boolean; github: boolean };
  });
  test.skip(
    providers.google && providers.github,
    "Both OAuth providers are configured on this server.",
  );
  const target = providers.google ? "GitHub" : "Google";
  await page.getByRole("button", { name: new RegExp(`使用 ${target} 登录`) }).click();
  await expect(page.getByRole("alert")).toContainText(
    `服务器尚未配置 ${target} 登录`,
  );
  await expect(page).toHaveURL(/\/login$/);
});

test("the server panel can sign out and back in without losing the app", async ({
  browser,
}) => {
  const username = unique("uipanel");
  const owned = await freshAccountPage(browser, username, "ui-panel-pass-12345");
  try {
    const page = owned.page;
    await page.getByRole("button", { name: "工作区状态", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "后台连接与账号" });
    await expect(dialog).toContainText("sqlite · 已连接");
    page.once("dialog", (d) => d.accept());
    await dialog.getByRole("button", { name: "退出服务器账号" }).click();
    await expect(dialog.getByLabel("服务器用户名")).toBeVisible();
    await dialog.getByLabel("服务器用户名").fill(username);
    await dialog.getByLabel("服务器密码").fill("ui-panel-pass-12345");
    await dialog.getByRole("button", { name: "登录账号", exact: true }).click();
    await expect(
      dialog.getByRole("button", { name: "退出服务器账号" }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "关闭服务器窗口" }).click();
    await expect(
      page.getByRole("button", { name: `账号菜单：${username}`, exact: true }),
    ).toBeVisible();
  } finally {
    await owned.context.close();
  }
});
