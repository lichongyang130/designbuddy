import { test, expect, type Page } from "@playwright/test";

const projectId = "right-preview-project";

const files = [
  {
    path: "index.html",
    language: "html",
    content: '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><link rel="stylesheet" href="./src/styles.css"></head><body><h1>右侧预览标题</h1><p id="marker">沙盒里的真实内容</p><script src="./src/main.js"></script></body></html>',
  },
  { path: "src/styles.css", language: "css", content: "body{background:#101418;color:#f2f2f2;font:16px/1.6 system-ui}" },
  { path: "src/main.js", language: "javascript", content: "document.body.dataset.ready = '1';" },
];

async function seed(page: Page, options: { artifact: boolean }) {
  await page.addInitScript(
    ({ projectId, files, artifact }) => {
      const now = new Date().toISOString();
      localStorage.setItem(
        "designbuddy.projects.v1",
        JSON.stringify([
          { id: projectId, name: "右侧预览项目", prompt: "做一个产品页", files, createdAt: now, updatedAt: now, status: "draft" },
        ]),
      );
      localStorage.setItem(
        `designbuddy.conversation.v1.${projectId}`,
        JSON.stringify({
          projectId,
          mode: "code",
          model: "",
          permission: "默认权限",
          workflow: "chat",
          messages: [
            { id: "user-1", role: "user", content: "做一个产品页", requestContent: "做一个产品页", createdAt: now, status: "complete" },
            {
              id: "assistant-1",
              role: "assistant",
              content: artifact ? "已生成 3 个项目文件。" : "先聊聊需求。",
              createdAt: now,
              status: "complete",
              ...(artifact ? { artifact: true } : {}),
            },
          ],
        }),
      );
    },
    { projectId, files, artifact: options.artifact },
  );
}

const panel = (page: Page) => page.getByRole("complementary", { name: "实时预览" });

test("生成项目后任务页自动打开右侧预览，并显示真实的沙盒页面", async ({ page }) => {
  await seed(page, { artifact: true });
  await page.goto(`/tasks/${projectId}`);
  await expect(panel(page)).toBeVisible();
  const frame = page.frameLocator(".preview-side-panel iframe");
  await expect(frame.locator("h1")).toHaveText("右侧预览标题");
  await expect(frame.locator("#marker")).toHaveText("沙盒里的真实内容");
  // The inlined stylesheet must apply inside the sandbox frame.
  await expect(frame.locator("body")).toHaveCSS("background-color", "rgb(16, 20, 24)");
  await expect(panel(page)).toContainText("AI 生成结果");
});

test("右侧预览可以切换设备尺寸、刷新并手动收起与重新打开", async ({ page }) => {
  await seed(page, { artifact: true });
  await page.goto(`/tasks/${projectId}`);
  await expect(panel(page)).toBeVisible();
  await panel(page).getByRole("button", { name: "手机" }).click();
  await expect(panel(page).locator(".preview-side-frame-mobile")).toBeVisible();
  await panel(page).getByRole("button", { name: "桌面" }).click();
  await expect(panel(page).locator(".preview-side-frame-desktop")).toBeVisible();
  await panel(page).getByRole("button", { name: "刷新" }).click();
  await expect(page.frameLocator(".preview-side-panel iframe").locator("h1")).toHaveText("右侧预览标题");

  await page.getByRole("button", { name: "右侧预览" }).click();
  await expect(panel(page)).toHaveCount(0);
  await page.getByRole("button", { name: "右侧预览" }).click();
  await expect(panel(page)).toBeVisible();
});

test("还没有生成网页的任务打开预览时给出明确说明，不伪造页面", async ({ page }) => {
  await seed(page, { artifact: false });
  await page.goto(`/tasks/${projectId}`);
  await expect(panel(page)).toHaveCount(0);
  await page.getByRole("button", { name: "右侧预览" }).click();
  await expect(panel(page)).toBeVisible();
  await expect(panel(page)).toContainText("本机项目草稿");
  // The local draft is a real page, so the sandbox still renders it.
  await expect(page.frameLocator(".preview-side-panel iframe").locator("h1")).toHaveText("右侧预览标题");
});

test("编辑器右侧预览分屏同时显示源码和实时预览", async ({ page }) => {
  await seed(page, { artifact: true });
  await page.goto(`/editor/${projectId}`);
  await page.getByRole("button", { name: "右侧预览", exact: true }).click();
  await expect(page.locator(".db-editor-split")).toBeVisible();
  await expect(page.locator(".db-editor-split .db-code-editor textarea")).toHaveValue(/右侧预览标题/);
  await expect(page.frameLocator(".db-editor-split iframe").locator("h1")).toHaveText("右侧预览标题");
  // Switching back to the single preview keeps the existing behaviour.
  await page.getByRole("button", { name: "设计预览", exact: true }).click();
  await expect(page.locator(".db-editor-split")).toHaveCount(0);
  await expect(page.locator(".db-live-preview-stage")).toBeVisible();
});
