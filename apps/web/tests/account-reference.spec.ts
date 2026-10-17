import { test, expect, type Page } from "@playwright/test";
import { freshAccountPage } from "./auth-helpers";
const menu = (page: Page) => page.getByRole("dialog", { name: "账号菜单", exact: true });
const trigger = (page: Page) => page.getByRole("button", { name: /^账号菜单：/ });
async function open(page: Page) { await trigger(page).click(); await expect(menu(page)).toBeVisible(); }

test("reference cards and action order match the screenshot without fabricated balances or rewards", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/"); await open(page);
  const popup = menu(page);
  await expect(popup.locator(".account-identity strong")).toHaveText(/^uisetup_[0-9a-z]+$/);
  await expect(popup.locator(".account-identity small")).toContainText("已登录服务器账号");
  await expect(popup.locator(".account-actions .account-action > span")).toHaveText(["Buddy加油站", "去邀约", "成长计划", "设置", "外观", "记忆与进化", "意见反馈", "检查更新", "退出登录"]);
  await expect(popup.getByLabel("套餐与积分")).toContainText("未接入");
  await expect(popup).not.toContainText("1,679.47");
  await expect(popup).not.toContainText("650");
  await expect(popup.getByRole("button", { name: "购买积分", exact: true })).toBeDisabled();
  await expect(popup.getByRole("button", { name: "退出登录", exact: true })).toBeEnabled();
  const anchor = (await trigger(page).boundingBox())!, box = (await popup.boundingBox())!;
  expect(box.width).toBe(316);
  expect(box.y + box.height).toBeLessThanOrEqual(anchor.y - 7);
  await page.screenshot({ path: "../../.cache/account-reference-desktop.png" });
});

test("plan, appearance and memory entries open their real settings sections", async ({ page }) => {
  await page.goto("/");
  for (const [label, section, content] of [["升级套餐", "套餐与积分", "支付服务尚未接入"], ["外观", "外观", "灰白外观"], ["记忆与进化", "记忆与进化", "长期记忆"]]) {
    await open(page);
    await menu(page).getByRole("button", { name: label, exact: true }).click();
    const settings = page.getByRole("dialog", { name: "设置", exact: true });
    await expect(settings).toBeVisible();
    await expect(settings.getByRole("navigation").getByRole("button", { name: section, exact: true })).toHaveAttribute("aria-current", "page");
    await expect(settings).toContainText(content);
    await settings.getByRole("button", { name: "关闭设置" }).click();
    await expect(trigger(page)).toBeFocused();
  }
});

test("unsupported services explain their limits and do not create fake successes", async ({ page }) => {
  await page.goto("/"); await open(page);
  const popup = menu(page);
  for (const [label, text] of [["Buddy加油站", "无法领取、充值或消耗积分"], ["去邀约", "没有可生成的邀请链接"], ["成长计划", "尚未接入"], ["检查更新", "暂时无法检查或安装更新"]]) {
    await popup.getByRole("button", { name: label, exact: true }).click();
    await expect(popup.getByRole("heading", { name: label, exact: true })).toBeVisible();
    await expect(popup).toContainText(text);
    await popup.getByRole("button", { name: "返回账号菜单" }).click();
  }
  await page.keyboard.press("Escape");
  await expect(popup).toHaveCount(0);
});

test("feedback saves a local draft and downloads actual text without claiming submission", async ({ page }) => {
  await page.goto("/"); await open(page);
  await menu(page).getByRole("button", { name: "意见反馈", exact: true }).click();
  const text = "建议优化任务列表：希望支持按日期筛选，并保留原始草稿。";
  await menu(page).getByRole("textbox", { name: "反馈内容" }).fill(text);
  await expect(menu(page).getByRole("status")).toContainText("未发送");
  await page.reload(); await open(page);
  await menu(page).getByRole("button", { name: "意见反馈", exact: true }).click();
  await expect(menu(page).getByRole("textbox", { name: "反馈内容" })).toHaveValue(text);
  const downloaded = page.waitForEvent("download");
  await menu(page).getByRole("button", { name: "下载草稿" }).click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toBe("DesignBuddy-反馈草稿.txt");
  const stream = await file.createReadStream(); const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const body = Buffer.concat(chunks).toString("utf8");
  expect(body).toContain(text); expect(body).toContain("未发送");
});

test("real server logout requires confirmation, handles failure and retains local data", async ({ browser }) => {
  // A throwaway context: logging out rotates the session, which must not
  // kill the shared setup session that later tests reuse.
  const name = "menu_" + crypto.randomUUID().replaceAll("-", "").slice(0, 14);
  const { context, page } = await freshAccountPage(browser, name, "test-account-menu-12345");
  try {
    await expect(trigger(page)).toHaveAccessibleName(`账号菜单：${name}`);
    await page.evaluate(() => localStorage.setItem("designbuddy.account-test-draft", "keep-this-draft"));
    let calls = 0;
    page.on("request", r => { if (r.url().endsWith("/api/auth/logout")) calls++; });
    await open(page);
    await menu(page).getByRole("button", { name: "退出登录", exact: true }).click();
    await expect(menu(page)).toContainText("本地项目、对话、通知及草稿仍会保留");
    await menu(page).getByRole("button", { name: "取消", exact: true }).click();
    expect(calls).toBe(0);
    await page.route("**/api/auth/logout", route => route.fulfill({ status: 503, json: { error: "测试退出失败" } }));
    await menu(page).getByRole("button", { name: "退出登录", exact: true }).click();
    await menu(page).getByRole("button", { name: "确认退出", exact: true }).click();
    await expect(menu(page).getByRole("status")).toContainText("测试退出失败");
    await expect(trigger(page)).toHaveAccessibleName(`账号菜单：${name}`);
    await page.unroute("**/api/auth/logout");
    await menu(page).getByRole("button", { name: "确认退出", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "欢迎回来" })).toBeVisible();
    await expect.poll(() => page.evaluate(async () => { const response = await fetch("/api/auth/me"); return response.ok ? (await response.json()).user.kind : "waiting"; })).toBe("guest");
    expect(calls).toBe(2);
    expect(await page.evaluate(() => localStorage.getItem("designbuddy.account-test-draft"))).toBe("keep-this-draft");
  } finally {
    await context.close();
  }
});

test("keyboard traverses all enabled items and does not intercept feedback editing", async ({ page }) => {
  await page.goto("/"); await open(page);
  await page.keyboard.press("Home");
  await expect(menu(page).getByRole("button", { name: "升级套餐", exact: true })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(menu(page).getByRole("button", { name: "Buddy加油站", exact: true })).toBeFocused();
  await page.keyboard.press("End");
  await expect(menu(page).getByRole("button", { name: "退出登录", exact: true })).toBeFocused();
  await menu(page).getByRole("button", { name: "意见反馈", exact: true }).click();
  const text = menu(page).getByRole("textbox", { name: "反馈内容" });
  await text.fill("反馈内容"); await text.press("Home");
  await expect(text).toBeFocused();
  expect(await text.evaluate(el => (el as HTMLTextAreaElement).selectionStart)).toBe(0);
});
