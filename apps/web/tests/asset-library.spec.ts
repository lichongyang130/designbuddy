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
 * The asset library keeps uploaded files on the server: the file is stored,
 * text files are parsed there, the visibility decides who may see it and every
 * change is written into the file's own history.
 */
test("an uploaded file is stored on the server, parsed there and can be changed or deleted", async ({
  page,
}) => {
  const username = "assets_" + crypto.randomUUID().slice(0, 8);
  await page.goto("/");
  await account(page, username);
  await page.goto("/assets");

  await expect(page.getByRole("heading", { name: "素材库" })).toBeVisible();
  await expect(page.locator(".as-list")).toContainText("素材库还是空的");

  await page.getByLabel("选择要上传的文件").setInputFiles({
    name: "brief.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# 活动需求\n请做一个活动落地页。", "utf8"),
  });

  const item = page.locator(".as-list li").first();
  await expect(item).toContainText("brief.md");
  await expect(item).toContainText("服务端已解析文本");

  await item.getByRole("button", { name: "查看解析文本" }).click();
  await expect(page.locator(".as-text")).toContainText("请做一个活动落地页");

  await item.getByLabel("brief.md 的可见范围").selectOption("public");
  await expect(page.locator(".as-message")).toContainText("可见范围");

  await item.getByRole("button", { name: "操作记录" }).click();
  await expect(page.locator(".as-events")).toContainText("asset.upload");
  await expect(page.locator(".as-events")).toContainText("asset.visibility");

  await item.getByRole("button", { name: "删除" }).click();
  await expect(page.locator(".as-message")).toContainText("已删除");
  await expect(page.locator(".as-list")).toContainText("素材库还是空的");
});
