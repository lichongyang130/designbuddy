import { test, expect, type Page } from "@playwright/test";

async function account(page: Page, username: string, register = true) {
  await page.getByRole("button", { name: "工作区状态", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "后台连接与账号" });
  await expect(dialog).toContainText("sqlite · 已连接");
  await dialog.getByLabel("服务器用户名").fill(username);
  await dialog.getByLabel("服务器密码").fill("test-password-12345");
  await dialog
    .getByRole("button", {
      name: register ? "注册并保留访客数据" : "登录账号",
      exact: true,
    })
    .click();
  await expect(dialog.getByRole("button", { name: "退出服务器账号" })).toBeVisible();
  await dialog.getByRole("button", { name: "关闭服务器窗口" }).click();
}

async function openCode(page: Page) {
  await page.getByRole("button", { name: "源代码", exact: true }).click();
  await expect(page.getByLabel("index.html 源码")).toBeVisible();
}

/**
 * The editor keeps a real version history on the server: every saved change
 * is stored, a conflicting save is refused instead of overwriting, and an old
 * version can be restored.
 */
test("the editor records versions, refuses a conflicting save and restores an old one", async ({
  page,
  browser,
}) => {
  const username = "versions_" + crypto.randomUUID().slice(0, 8);
  await page.goto("/");
  await account(page, username);
  await page.goto("/projects");
  await page.getByRole("button", { name: "＋ 新建项目", exact: true }).click();
  await expect(page).toHaveURL(/\/editor\//);
  const editorUrl = page.url();

  // The first sync stores the first version of every file.
  await page.getByRole("button", { name: "同步云端", exact: true }).click();
  await expect(page.locator(".db-save-state")).toContainText("云端已同步");

  // The history opens as a dialog, so it also works on narrow screens.
  await page.getByRole("button", { name: "版本历史", exact: true }).click();
  const history = page.getByRole("dialog", { name: "版本历史" });
  await expect(history).toBeVisible();
  await expect(history.getByRole("button", { name: "查看" }).first()).toBeVisible();
  // The editor shows which cloud version the local files are based on.
  await expect(history.locator(".db-version-base")).toContainText("index.html v1");
  await page.getByRole("button", { name: "关闭版本历史" }).click();

  // A second device of the same account saves a newer version.
  const second = await browser.newContext();
  try {
    await second.addCookies(await page.context().cookies());
    const other = await second.newPage();
    await other.goto("/projects");
    await other.getByRole("button", { name: "载入云端/团队项目", exact: true }).click();
    await expect(other.getByRole("alert")).toContainText("已载入 1 个");
    await other.goto(editorUrl);
    await openCode(other);
    await other.getByLabel("index.html 源码").fill("<h1>来自另一台设备</h1>");
    await other.getByRole("button", { name: "同步云端", exact: true }).click();
    await expect(other.locator(".db-save-state")).toContainText("云端已同步");

    // The first device now saves on top of an outdated base: the server refuses.
    await openCode(page);
    await page.getByLabel("index.html 源码").fill("<h1>我的版本</h1>");
    await page.getByRole("button", { name: "同步云端", exact: true }).click();
    const conflict = page.locator(".db-version-conflict");
    await expect(conflict).toBeVisible();
    await expect(conflict).toContainText("index.html");
    await expect(page.locator(".db-save-state")).not.toContainText("云端已同步");

    // The person decides: keep their version, and the overwrite is recorded.
    await conflict.getByRole("button", { name: "用我的版本覆盖" }).click();
    await expect(page.locator(".db-save-state")).toContainText("云端已同步");
    await expect(conflict).toHaveCount(0);

    // The history lists the versions and the audit trail records the actions.
    await page.getByRole("button", { name: "版本历史", exact: true }).click();
    await expect(history.getByRole("button", { name: "查看" }).first()).toBeVisible();
    await history.locator(".db-version-audit summary").click();
    await expect(history.locator(".db-version-audit li").first()).toContainText("project.save");
    await expect(history.locator(".db-version-audit")).toContainText("project.conflict");

    // Restoring an older version brings its content back.
    const rows = history.locator(".db-version-list li");
    const count = await rows.count();
    expect(count).toBeGreaterThan(1);
    await rows.last().getByRole("button", { name: "恢复" }).click();
    await expect(history.locator(".db-version-notice")).toContainText("已恢复");
  } finally {
    await second.close();
  }
});

/**
 * The base version is remembered on this device, so a reload does not turn a
 * normal edit into a conflict, and a real concurrent edit is still refused.
 */
test("the base version survives a reload and still refuses a concurrent change", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  const username = "versions_reload_" + crypto.randomUUID().slice(0, 8);
  await page.goto("/");
  await account(page, username);
  await page.goto("/projects");
  await page.getByRole("button", { name: "＋ 新建项目", exact: true }).click();
  await expect(page).toHaveURL(/\/editor\//);
  const editorUrl = page.url();
  await page.getByRole("button", { name: "同步云端", exact: true }).click();
  await expect(page.locator(".db-save-state")).toContainText("云端已同步");

  // Reload: the editor still knows which cloud version it started from.
  await page.reload();
  await openCode(page);
  await page.getByRole("button", { name: "版本历史", exact: true }).click();
  const history = page.getByRole("dialog", { name: "版本历史" });
  await expect(history.locator(".db-version-base")).toContainText("index.html v1");
  await page.getByRole("button", { name: "关闭版本历史" }).click();

  // An ordinary edit on this device is not a conflict.
  await openCode(page);
  await page.getByLabel("index.html 源码").fill("<h1>本机续写</h1>");
  await page.getByRole("button", { name: "同步云端", exact: true }).click();
  await expect(page.locator(".db-save-state")).toContainText("云端已同步");
  await expect(page.locator(".db-version-conflict")).toHaveCount(0);

  // A second device moves the file forward; this device is then refused.
  const second = await browser.newContext();
  try {
    await second.addCookies(await page.context().cookies());
    const other = await second.newPage();
    await other.goto("/projects");
    await other.getByRole("button", { name: "载入云端/团队项目", exact: true }).click();
    await expect(other.getByRole("alert")).toContainText("已载入 1 个");
    await other.goto(editorUrl);
    await openCode(other);
    await other.getByLabel("index.html 源码").fill("<h1>另一台设备</h1>");
    await other.getByRole("button", { name: "同步云端", exact: true }).click();
    await expect(other.locator(".db-save-state")).toContainText("云端已同步");

    await openCode(page);
    await page.getByLabel("index.html 源码").fill("<h1>本机第三稿</h1>");
    await page.getByRole("button", { name: "同步云端", exact: true }).click();
    await expect(page.locator(".db-version-conflict")).toBeVisible();
    await expect(page.locator(".db-version-conflict")).toContainText("index.html");

    // Loading the server version resolves the conflict.
    await page.locator(".db-version-conflict").getByRole("button", { name: "载入服务器版本" }).click();
    await expect(page.locator(".db-version-conflict")).toHaveCount(0);
    await openCode(page);
    await expect(page.getByLabel("index.html 源码")).toHaveValue("<h1>另一台设备</h1>");
  } finally {
    await second.close();
  }
});

/**
 * The version history is reachable on a phone screen: the wrapped action row
 * must not be covered by the file list.
 */
test("the editor actions stay reachable on a phone screen", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/projects");
  await page.getByRole("button", { name: "＋ 新建项目", exact: true }).click();
  await expect(page).toHaveURL(/\/editor\//);
  const sync = page.getByRole("button", { name: "同步云端", exact: true });
  await expect(sync).toBeVisible();
  await sync.click();
  await expect(page.locator(".db-save-state")).toContainText("云端已同步");
  await page.getByRole("button", { name: "版本历史", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "版本历史" })).toBeVisible();
});
