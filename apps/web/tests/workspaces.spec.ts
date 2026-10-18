import { test, expect } from "@playwright/test";
import { GUEST_STORAGE, freshAccountPage, registerViaAPI } from "./auth-helpers";

/**
 * A workspace is the tenant of a project: the role a person has there decides
 * whether the project may be read, changed or only looked at.
 */
test("a workspace organises projects and decides who may change them", async ({ browser }) => {
  test.setTimeout(90_000);
  const ownerName = "ws_owner_" + crypto.randomUUID().slice(0, 8);
  const owner = await freshAccountPage(browser, ownerName);
  try {
    const page = owner.page;
    await page.goto("/workspaces");
    await expect(page.getByRole("heading", { level: 1, name: "工作空间" })).toBeVisible();

    // The owner creates a workspace and gets a join code.
    await page.getByLabel("新工作空间名称").fill("设计组");
    await page.getByRole("button", { name: "创建工作空间" }).click();
    await expect(page.locator(".ws-list")).toContainText("设计组");
    const joinCode = (await page.locator(".ws-code code").innerText()).trim();
    expect(joinCode).toMatch(/^[A-Z0-9]{6}$/);

    // Another account joins with that code.
    const second = await browser.newContext({ storageState: GUEST_STORAGE });
    try {
      const other = await second.newPage();
      await other.goto("/");
      await registerViaAPI(other, "ws_member_" + crypto.randomUUID().slice(0, 8));
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
  } finally {
    await owner.context.close();
  }
});
