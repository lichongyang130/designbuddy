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
 * A workflow is a recipe of real skills: the person fills a few answers, the
 * server runs the steps, and the artifacts of the finished run are listed.
 */
test("a workflow runs the real skills and lists the artifacts", async ({ page }) => {
  const username = "wf_" + crypto.randomUUID().slice(0, 8);
  await page.goto("/");
  await account(page, username);

  await page.goto("/workflows");
  await expect(page.getByRole("heading", { name: "工作流", exact: true })).toBeVisible();
  const cards = page.locator(".wf-recipe");
  await expect(cards).toHaveCount(7);
  await expect(cards.filter({ hasText: "业务对比信息图" })).toBeVisible();

  // Step 1: the answers.
  const recipe = cards.filter({ hasText: "业务对比信息图" });
  await recipe.getByRole("button", { name: "开始" }).click();
  await expect(page.getByRole("heading", { name: "业务对比信息图" })).toBeVisible();
  await page.getByLabel("图表标题").fill("渠道收入对比");
  await page.getByLabel("指标名").fill("确认收入");
  await page.getByLabel("单位").fill("万元");
  await page.getByLabel("统计口径").fill("2026年9月已确认收入；各渠道采用相同记账口径");
  await page.getByLabel("数据来源").fill("端到端测试样例");
  await page.getByRole("button", { name: "添加一行" }).click();
  await page.getByRole("button", { name: "添加一行" }).click();
  await page.getByLabel("类别或日期").nth(0).fill("线上直营");
  await page.getByLabel("数值").nth(0).fill("128.5");
  await page.getByLabel("类别或日期").nth(1).fill("线下门店");
  await page.getByLabel("数值").nth(1).fill("96.2");

  // Step 2: the confirmation lists what will really run.
  await page.getByRole("button", { name: "下一步：确认" }).click();
  await expect(page.getByRole("heading", { name: "确认要跑什么" })).toBeVisible();
  await expect(page.locator(".wf-plan")).toContainText("infographic.compose");

  // Step 3: the run and its artifacts.
  await page.getByRole("button", { name: "确认并执行" }).click();
  await expect(page.getByRole("heading", { name: /业务对比信息图 ·/ })).toBeVisible();
  await expect(page.locator(".wf-steps-list > li").first()).toHaveAttribute("data-status", "succeeded", {
    timeout: 60_000,
  });
  const artifacts = page.locator(".wf-artifacts a");
  expect(await artifacts.count()).toBeGreaterThanOrEqual(2);
  await expect(artifacts.filter({ hasText: ".svg" })).toHaveCount(1);
  await expect(artifacts.filter({ hasText: ".png" })).toHaveCount(1);

  // The run is kept on the server and shows up in the history.
  await page.getByRole("button", { name: "返回工作流列表" }).click();
  await expect(page.locator(".wf-run-list")).toContainText("业务对比信息图");
  await expect(page.locator(".wf-run-list")).toContainText("已完成");
});

test("a workflow that needs a file reads the uploaded file", async ({ page }) => {
  const username = "wffile_" + crypto.randomUUID().slice(0, 8);
  await page.goto("/");
  await account(page, username);

  await page.goto("/workflows");
  const recipe = page.locator(".wf-recipe").filter({ hasText: "表格清洗与统计" });
  await recipe.getByRole("button", { name: "开始" }).click();
  await page.locator("#wf-file").setInputFiles({
    name: "channels.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("渠道,确认收入\n线上直营,128.5\n线下门店,96.2\n合作渠道,73.8\n", "utf8"),
  });
  await expect(page.locator(".wf-file-name")).toContainText("channels.csv");

  await page.getByRole("button", { name: "下一步：确认" }).click();
  await expect(page.locator(".wf-plan")).toContainText("table.analyze");
  await page.getByRole("button", { name: "确认并执行" }).click();
  await expect(page.locator(".wf-steps-list > li").first()).toHaveAttribute("data-status", "succeeded", {
    timeout: 60_000,
  });
  await expect(page.locator(".wf-artifacts a").filter({ hasText: ".xlsx" })).toHaveCount(1);
});

test("a missing answer is reported before anything runs", async ({ page }) => {
  const username = "wfmiss_" + crypto.randomUUID().slice(0, 8);
  await page.goto("/");
  await account(page, username);

  await page.goto("/workflows");
  await page.locator(".wf-recipe").filter({ hasText: "FAQ 帮助页" }).getByRole("button", { name: "开始" }).click();
  await page.getByRole("button", { name: "下一步：确认" }).click();
  await expect(page.locator(".wf-message.is-error")).toContainText("请先填写");
  // The person stays on the form and no run was started.
  await expect(page.getByRole("heading", { name: "FAQ 帮助页" })).toBeVisible();
  await page.getByRole("button", { name: "返回", exact: true }).click();
  await expect(page.locator(".wf-note")).toContainText("还没有运行记录");
});

test("a finished artifact can be opened in the editor or kept in the asset library", async ({ page }) => {
  const username = "wfkeep_" + crypto.randomUUID().slice(0, 8);
  await page.goto("/");
  await account(page, username);

  await page.goto("/workflows");
  await page.locator(".wf-recipe").filter({ hasText: "FAQ 帮助页" }).getByRole("button", { name: "开始" }).click();
  await page.getByLabel("页面标题").fill("报名帮助中心");
  await page.getByRole("button", { name: "添加一行" }).click();
  await page.getByLabel("类别").nth(0).fill("报名");
  await page.getByLabel("问题").nth(0).fill("如何报名活动？");
  await page.getByLabel("回答").nth(0).fill("打开活动详情页并点击报名入口。");
  await page.getByRole("button", { name: "下一步：确认" }).click();
  await page.getByRole("button", { name: "确认并执行" }).click();
  await expect(page.locator(".wf-steps-list > li").first()).toHaveAttribute("data-status", "succeeded", {
    timeout: 60_000,
  });

  // The artifact is a real file: it can be kept in the asset library.
  await page.locator(".wf-artifacts li").filter({ hasText: ".html" }).getByRole("button", { name: "存为素材" }).click();
  await expect(page.locator(".wf-message")).toContainText("素材库");
  await page.goto("/assets");
  await expect(page.locator(".al-list, .al-item, li").filter({ hasText: "faq-page.html" }).first()).toBeVisible();

  // The same artifact can be opened in the editor as source.
  await page.goto("/workflows");
  await page.locator(".wf-run-list").getByRole("button").first().click();
  await expect(page.getByRole("heading", { name: /FAQ 帮助页 ·/ })).toBeVisible();
  await page.locator(".wf-artifacts li").filter({ hasText: ".html" }).getByRole("button", { name: "继续编辑" }).click();
  await expect(page).toHaveURL(/\/editor\//);
  await expect(page.locator("body")).toContainText("faq-page.html");
});

test("a home scene with a recipe opens that workflow", async ({ page }) => {
  const username = "wfscene_" + crypto.randomUUID().slice(0, 8);
  await page.goto("/");
  await account(page, username);
  await page.getByRole("tab", { name: "办公提效", exact: true }).click();
  if (!await page.locator(".home-example-library").evaluate((el) => (el as HTMLDetailsElement).open))
    await page.locator(".home-example-library > summary").click();
  const scene = page.locator(".home27-scene").filter({ hasText: "表格分析" });
  await expect(scene.getByRole("button", { name: /用工作流：表格清洗与统计/ })).toBeVisible();
  await scene.getByRole("button", { name: /用工作流：表格清洗与统计/ }).click();
  await expect(page).toHaveURL(/\/workflows/);
  await expect(page.getByRole("heading", { name: "表格清洗与统计" })).toBeVisible();
});
