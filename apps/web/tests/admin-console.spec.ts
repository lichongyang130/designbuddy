import { test, expect, type Page } from "@playwright/test";

const PASSWORD = "test-password-12345";

/**
 * Register (or log back into) a server account. The username may already
 * exist from an earlier run against the same database, so a failed
 * registration falls back to a plain login.
 */
async function account(page: Page, username: string) {
  await page.getByRole("button", { name: "工作区状态", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "后台连接与账号" });
  await expect(dialog).toContainText("sqlite · 已连接");
  await dialog.getByLabel("服务器用户名").fill(username);
  await dialog.getByLabel("服务器密码").fill(PASSWORD);
  const signedOut = dialog.getByRole("button", { name: "退出服务器账号" });
  await dialog.getByRole("button", { name: "注册并保留访客数据", exact: true }).click();
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await signedOut.isVisible().catch(() => false)) break;
    const message = await dialog.locator(".server-panel-message").innerText().catch(() => "");
    if (message.includes("不可用")) {
      // The username already exists on this server: log in with the same password.
      await dialog.getByRole("button", { name: "登录账号", exact: true }).click();
      break;
    }
    await page.waitForTimeout(250);
  }
  await expect(signedOut).toBeVisible();
  await dialog.getByRole("button", { name: "关闭服务器窗口" }).click();
}

const adminName = (process.env.DESIGNBUDDY_ADMIN_ACCOUNTS || "").split(/[,\s]+/).filter(Boolean)[0] || "";

/**
 * The operator console is only for the accounts the server names in
 * DESIGNBUDDY_ADMIN_ACCOUNTS. A normal account gets a clear refusal instead of
 * a page with half the data.
 */
test("the operator console is visible to the configured admin and refused to everyone else", async ({ page, browser }) => {
  const username = "plain_" + crypto.randomUUID().slice(0, 8);

  await page.goto("/");
  await account(page, username);

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "管理后台", exact: true })).toBeVisible();

  // A normal account is refused, and it sees no server data at all.
  await expect(page.locator(".ad-message.is-error")).toContainText("管理员");
  await expect(page.locator(".ad-stats")).toHaveCount(0);
  await expect(page.locator("section[aria-label=\"账号\"]")).toHaveCount(0);

  if (!adminName) {
    // Nobody is configured as an operator: the console stays closed for everyone.
    return;
  }

  // The configured operator sees the server.
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await adminPage.goto("/");
  await account(adminPage, adminName);
  await adminPage.goto("/admin");
  await expect(adminPage.locator(".ad-stats")).toBeVisible();
  await expect(adminPage.locator("section[aria-label=\"账号\"]")).toContainText(adminName);
  await expect(adminPage.locator("section[aria-label=\"技能健康\"]")).toContainText("可执行");
  await expect(adminPage.locator("section[aria-label=\"模型用量\"]")).toBeVisible();
  await adminContext.close();
});

test("an operator can turn an account off and the audit keeps the record", async ({ page, browser }) => {
  test.skip(!adminName, "这台服务器没有配置管理员账号（DESIGNBUDDY_ADMIN_ACCOUNTS）");
  const guest = "guest_" + crypto.randomUUID().slice(0, 8);

  // A second account on the same server, in its own browser context.
  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();
  await guestPage.goto("/");
  await account(guestPage, guest);

  await page.goto("/");
  await account(page, adminName);
  await page.goto("/admin");
  await expect(page.locator(".ad-stats")).toBeVisible();
  await expect(page.locator("section[aria-label=\"账号\"]")).toContainText(guest);

  const row = page.locator(".ad-list li").filter({ hasText: guest });
  await row.getByRole("button", { name: "停用" }).click();
  await expect(page.locator(".ad-message")).toContainText("已停用");
  await expect(row.getByText("已停用")).toBeVisible();
  await expect(page.locator("section[aria-label=\"审计\"]")).toContainText("account.disable");

  // The disabled account loses its session on the server right away.
  await guestPage.goto("/api/auth/me");
  await expect(guestPage.locator("body")).toContainText("SESSION_REQUIRED");
  await guestContext.close();
});
