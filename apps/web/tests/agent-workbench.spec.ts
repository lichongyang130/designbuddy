import { test, expect } from "@playwright/test";

test("Agent workbench executes end-to-end plan, code modification, HITL approval gate, unified diff, live preview, memory isolation and rollback", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Agent 工作台", exact: true }).click();
  await expect(page).toHaveURL(/\/agent$/);
  await expect(page.getByRole("heading", { name: "Agent 工程工作台" })).toBeVisible();

  // 1. Create a real server-persisted project directly from the UI
  await page.getByRole("button", { name: "新建验证项目" }).click();
  await expect(page.getByRole("status")).toContainText("已创建服务端持久化项目");

  // 2. Add a pinned brand color memory constraint via UI and verify live architecture scan
  await page.getByRole("tab", { name: "项目记忆与仓库架构" }).click();
  await expect(page.getByText(/packages\/ai-core/)).toBeVisible();
  await expect(page.getByText(/bridged-core/).first()).toBeVisible();
  await page.getByLabel("记忆标题").fill("品牌主色调");
  await page.getByLabel("记忆内容").fill("全站主色统一采用 #2a6f97 深海蓝");
  await page.getByRole("button", { name: "保存记忆条目" }).click();
  await expect(page.getByText("[constraint] 品牌主色调")).toBeVisible();

  // 3. Verify Human-in-the-loop pause gate: stage changes, edit staged file, and approve commit
  await page.getByLabel(/写入前暂停人工确认/).check();
  await page.getByRole("textbox", { name: "任务目标" }).fill("为验证项目补充响应式特性模块与品牌色卡片");
  await page.getByRole("button", { name: "执行分析、修改与 QA 验收" }).click();
  await expect(page.getByRole("region", { name: "待人工审阅确认" })).toBeVisible();
  await page.getByRole("button", { name: "批准并写入项目" }).click();
  await expect(page.getByRole("status")).toContainText("已批准并写入项目文件");

  // 4. Inspect Unified Diff & QA Report tab
  await page.getByRole("tab", { name: "Unified Diff 与 QA 报告" }).click();
  await expect(page.getByText("styles.css", { exact: true })).toBeVisible();
  await expect(page.locator('[data-diff-path="styles.css"] .aw-diff-pre')).toContainText(
    "--db-agent-primary: #2a6f97",
  );
  await expect(page.getByText(/通过/).first()).toBeVisible();

  // 5. Inspect live sandboxed preview iframe and check 375px viewport fits cleanly without overflow
  await page.getByRole("tab", { name: "实时沙箱预览" }).click();
  const frame = page.frameLocator('iframe[title="项目实时沙箱预览"]');
  await expect(frame.getByRole("heading", { name: "为验证项目补充响应式特性模块与品牌色卡片" })).toBeVisible();

  await page.setViewportSize({ width: 375, height: 820 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);

  // 6. Execute 1-click Rollback and verify preview & persisted state revert to baseline
  await page.getByRole("button", { name: "回滚到执行前版本" }).click();
  await expect(page.getByRole("status")).toContainText("已回滚到本次执行前的基线文件版本");
  await expect(frame.getByRole("heading", { name: "为验证项目补充响应式特性模块与品牌色卡片" })).toHaveCount(0);
  await expect(frame.getByRole("heading", { name: "DesignBuddy 验证项目" })).toBeVisible();
});
