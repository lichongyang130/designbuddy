import { test, expect, type Page } from "@playwright/test";

async function account(page: Page, username: string) {
  await page.getByRole("button", { name: "工作区状态", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "后台连接与账号" });
  await expect(dialog).toContainText("sqlite · 已连接");
  await dialog.getByLabel("服务器用户名").fill(username);
  await dialog.getByLabel("服务器密码").fill("test-password-12345");
  await dialog.getByRole("button", { name: "注册并保留访客数据", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "退出服务器账号" })).toBeVisible();
  await dialog.getByRole("button", { name: "关闭服务器窗口" }).click();
}

/**
 * A workspace is the tenant of a project: the role a person has there decides
 * whether the project may be read, changed or only looked at.
 */
test("a workspace organises projects and decides who may change them", async ({ page, browser }) => {
  test.setTimeout(90_000);
  const ownerName = "ws_owner_" + crypto.randomUUID().slice(0, 8);
  await page.goto("/");
  await account(page, ownerName);
  await page.goto("/workspaces");
  await expect(page.getByRole("heading", { level: 1, name: "工作空间" })).toBeVisible();

  // The owner creates a workspace and gets a join code.
  await page.getByLabel("新工作空间名称").fill("设计组");
  await page.getByRole("button", { name: "创建工作空间" }).click();
  await expect(page.locator(".ws-list")).toContainText("设计组");
  const joinCode = (await page.locator(".ws-code code").innerText()).trim();
  expect(joinCode).toMatch(/^[A-Z0-9]{6}$/);

  // Another account joins with that code.
  const second = await browser.newContext();
  try {
    const other = await second.newPage();
    await other.goto("/");
    await account(other, "ws_member_" + crypto.randomUUID().slice(0, 8));
    await other.goto("/workspaces");
    await other.getByLabel("加入码").fill(joinCode);
    await other.getByRole("button", { name: "加入工作空间" }).click();
    await expect(other.locator(".ws-list")).toContainText("设计组");
    // A member may not manage the member list.
    await expect(other.locator(".ws-table select")).toHaveCount(0);

    // The owner creates a project: the sync puts it into the workspace in focus.
    await page.goto("/projects");
    await page.getByRole("button", { name: "＋ 新建项目", exact: true }).click();
    await expect(page).toHaveURL(/\/editor\//);
    await page.getByRole("button", { name: "同步云端", exact: true }).click();
    await expect(page.locator(".db-save-state")).toContainText("云端已同步");

    // The member sees the project of the workspace after loading the cloud projects.
    await other.goto("/projects");
    await other.getByRole("button", { name: "载入云端/团队项目", exact: true }).click();
    await expect(other.getByRole("alert")).toContainText("已载入");
    await expect(other.locator(".db-project-meta")).toContainText("工作空间：设计组");

    // The owner demotes the member to a read-only role.
    await page.goto("/workspaces");
    await page.locator(".ws-table select").first().selectOption("viewer");
    await expect(page.locator(".ws-table")).toContainText("只读成员");

    // The read-only member may open the project but not change it.
    await other.locator(".db-open-project").first().click();
    await expect(other).toHaveURL(/\/editor\//);
    await other.getByRole("button", { name: "源代码", exact: true }).click();
    await other.getByLabel("index.html 源码").fill("<h1>只读成员改的</h1>");
    await other.getByRole("button", { name: "同步云端", exact: true }).click();
    await expect(other.locator(".db-editor-notice")).toContainText("没有编辑权限");
    await expect(other.locator(".db-save-state")).not.toContainText("云端已同步");

    // The owner is still able to change the project.
    await page.goto("/projects");
    await page.getByRole("button", { name: "＋ 新建项目", exact: true }).click();
    await expect(page).toHaveURL(/\/editor\//);
    await page.getByRole("button", { name: "同步云端", exact: true }).click();
    await expect(page.locator(".db-save-state")).toContainText("云端已同步");
  } finally {
    await second.close();
  }
});
