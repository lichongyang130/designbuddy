import { test, expect } from "@playwright/test";
import { GUEST_STORAGE, freshAccountPage } from "./auth-helpers";

/**
 * A controlled share is a server side link: the token decides who may look,
 * the server decides when it stops working, and the owner can revoke it.
 */
test("a controlled share link is readable by a visitor and dies when the owner revokes it", async ({
  browser,
}) => {
  const username = "shares_" + crypto.randomUUID().slice(0, 8);
  const owner = await freshAccountPage(browser, username);
  const page = owner.page;
  try {
      await page.goto("/projects");
    await page.getByRole("button", { name: "＋ 新建项目", exact: true }).click();
    await expect(page).toHaveURL(/\/editor\//);
    await page.getByRole("button", { name: "同步云端", exact: true }).click();
    await expect(page.locator(".db-save-state")).toContainText("云端已同步");

    await page.getByRole("button", { name: "受控分享", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "受控分享" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("链接由服务器托管");
    await dialog.getByRole("button", { name: "创建 7 天有效链接" }).click();
    await expect(dialog.getByRole("status")).toContainText("已创建 7 天有效的只读分享链接");

    const link = await dialog.locator(".db-share-list li strong").first().innerText();
    expect(link).toContain("/share/");
    await expect(dialog.locator(".db-share-list li").first()).toContainText("访问");

    // A visitor with a different browser session can read the shared snapshot.
    const visitor = await browser.newContext({ storageState: GUEST_STORAGE });
    const visitorPage = await visitor.newPage();
    await visitorPage.goto(link);
    await expect(visitorPage.locator(".db-share-summary")).toContainText("服务器受控只读分享");
    await expect(visitorPage.locator(".db-share-frame iframe")).toBeVisible();
    await expect(visitorPage.locator(".db-share-summary h1")).not.toBeEmpty();
    await visitor.close();

    // The owner revokes the link, and the visitor is turned away.
    await dialog.getByRole("button", { name: "撤销", exact: true }).click();
    await expect(dialog.getByRole("status")).toContainText("已撤销");
    await expect(dialog.locator(".db-share-list li").first()).toContainText("已撤销");

    const blocked = await browser.newContext({ storageState: GUEST_STORAGE });
    const blockedPage = await blocked.newPage();
    await blockedPage.goto(link);
    await expect(blockedPage.locator(".db-share-invalid")).toContainText("撤销");
    await blocked.close();
  } finally {
    await owner.context.close();
  }
});
