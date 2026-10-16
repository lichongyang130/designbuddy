import { test, expect, type Page } from "@playwright/test";

/**
 * Account profile: edit the display name and email, rotate the password,
 * read the account audit trail, and delete the account for good.
 *
 * Everything runs against the real server; nothing is mocked.
 */
const PASSWORD = "browser-local-pass-1";
const ROTATED = "browser-local-pass-2";
// A fresh account per run: the server database outlives a single test run.
const USERNAME = `browser_acct_${Date.now().toString(36)}`;

async function register(page: Page, username: string) {
  const result = await page.evaluate(
    async ([name, password]) => {
      // The server expects a session before it accepts an account.
      await fetch("/api/local/session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const response = await fetch("/api/auth/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: name, password }),
      });
      return { status: response.status, text: await response.text() };
    },
    [username, PASSWORD] as const,
  );
  expect(result.status).toBe(201);
}

test("the account profile is edited, audited and deleted against the real server", async ({
  page,
}) => {
  await page.goto("/profile");
  await register(page, USERNAME);

  await page.reload();
  const card = page.getByRole("region", { name: "账号资料" });
  await expect(card).toBeVisible();
  await expect(card).toContainText(`登录用户名：${USERNAME}`);

  // The display name and email can be changed and are written to the server.
  await card.getByLabel("显示名").fill("李工");
  await card.getByLabel("邮箱").fill("li@example.com");
  await card.getByRole("button", { name: "保存账号资料" }).click();
  await expect(page.locator(".profile-message")).toContainText("账号资料已更新");
  await expect(card.locator("tr[data-audit='account.profile.update']")).toHaveCount(1);
  await expect(card.locator("tr[data-audit='account.register']")).toHaveCount(1);

  // The account menu shows the new display name.
  await page.goto("/");
  await expect(page.getByRole("button", { name: "账号菜单：李工" })).toBeVisible();

  // A wrong current password is refused.
  await page.goto("/profile");
  await card.getByLabel("当前密码").fill("not-the-password");
  await card.getByLabel("新密码").fill(ROTATED);
  await card.getByRole("button", { name: "修改密码" }).click();
  await expect(page.locator(".profile-message.is-error")).toContainText("当前密码不正确");

  // The password can be rotated, and the rotation is audited.
  await card.getByLabel("当前密码").fill(PASSWORD);
  await card.getByLabel("新密码").fill(ROTATED);
  await card.getByRole("button", { name: "修改密码" }).click();
  await expect(page.locator(".profile-message")).toContainText("密码已修改");
  await expect(card.locator("tr[data-audit='account.password.change']")).toHaveCount(1);

  // The new password is the one that works now.
  const login = await page.evaluate(
    async ([password, name]) => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: name, password }),
      });
      return response.status;
    },
    [ROTATED, USERNAME] as const,
  );
  expect(login).toBe(200);

  // Deleting the account needs an explicit confirmation and the password.
  const clear = page.getByRole("region", { name: "导出与清除" });
  await clear.getByRole("button", { name: "注销账号" }).click();
  await expect(page.locator(".profile-message.is-error")).toContainText("确认");
  await clear.getByLabel("确认注销账号").check();
  await clear.getByLabel("当前登录密码").fill(ROTATED);
  await clear.getByRole("button", { name: "注销账号" }).click();
  await expect(page.locator(".profile-message")).toContainText("账号已注销");
  await expect(page.getByRole("region", { name: "账号资料" })).toContainText(
    "当前是游客会话",
  );

  // The server really dropped the account: the old session is gone.
  const after = await page.evaluate(async () => {
    const response = await fetch("/api/auth/me", { credentials: "include" });
    return response.status;
  });
  expect(after).toBe(401);
});
