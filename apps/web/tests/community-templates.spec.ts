import { test, expect } from "@playwright/test";
import { GUEST_STORAGE, freshAccountPage, registerViaAPI } from "./auth-helpers";

/**
 * Publishing a template is a server side change: the author publishes the
 * current state, the community list shows it, copying creates a private copy
 * and the author can take it off the list again.
 */
test("a published template reaches the community, can be copied and can be taken down", async ({
  browser,
}) => {
  const username = "community_" + crypto.randomUUID().slice(0, 8);
  const author = await freshAccountPage(browser, username);
  try {
    const page = author.page;
    await page.goto("/inspiration/travel");

    const cloud = page.locator(".template-cloud");
    await expect(cloud).toBeVisible();
    await page.getByLabel("发布到社区的标题").fill("我的旅行行程模板");
    await page.getByLabel("发布到社区的可见范围").selectOption("public");
    await cloud.getByRole("button", { name: "发布到社区" }).click();
    await expect(cloud).toContainText("已发布到社区");

    await page.goto("/community");
    const item = page.locator(".ct-list li").first();
    await expect(item).toContainText("我的旅行行程模板");
    await expect(item).toContainText("已公开");

    // Copying creates an independent copy in the browser of the person copying.
    await item.getByRole("button", { name: "复制到我的副本" }).click();
    await expect(page).toHaveURL(/\/inspiration\/travel\/draft\//);

    await page.goto("/community");
    await page.locator(".ct-list li").first().getByRole("button", { name: "操作记录" }).click();
    await expect(page.locator(".ct-events")).toContainText("community.publish");

    await page.locator(".ct-list li").first().getByRole("button", { name: "下架" }).click();
    await expect(page.locator(".ct-message")).toContainText("已下架");
    // The author keeps the entry, but it is no longer public.
    await expect(page.locator(".ct-list li").first()).toContainText("仅自己可见");

    const other = await browser.newContext({ storageState: GUEST_STORAGE });
    try {
      const otherPage = await other.newPage();
      await otherPage.goto("/community");
      await registerViaAPI(
        otherPage,
        "community_other_" + crypto.randomUUID().slice(0, 8),
      );
      await otherPage.goto("/community");
      await expect(otherPage.locator(".ct-list")).toContainText("还没有已发布的模板");
    } finally {
      await other.close();
    }
  } finally {
    await author.context.close();
  }
});
