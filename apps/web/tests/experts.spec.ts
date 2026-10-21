import { test, expect, type Page } from "@playwright/test";
import { expectWorkspace, resetComposerDefaults, setPermission, setWorkspace } from "./helpers/home";
import { routingExperts } from "../../../shared/expertRouting";
const expertCatalog = routingExperts.map(e => ({ ...e, category: { office: "办公提效", design: "设计制作", code: "网页应用" }[e.mode] }));
// The directory renders one section per task area, so the visible order is grouped by area.
const areaOrder = ["办公提效", "设计制作", "网页应用"] as const;
const groupedCatalog = areaOrder.flatMap(area => expertCatalog.filter(e => e.category === area));
import { allPromptTasks } from "../src/components/promptLibrary";
async function openExperts(page: Page) {
  await page.getByRole("button", { name: "更多", exact: true }).hover();
  await page.getByRole("menuitem", { name: "专家", exact: true }).click();
}

test("directory has every routed expert, three task areas and no obsolete promotion", async ({ page }) => {
  await page.goto("/experts");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("为你的工作，找到合适的专家");
  await expect(page.locator(".expert-directory-card")).toHaveCount(expertCatalog.length);
  await expect(page.locator(".expert-card-heading h3")).toHaveText(groupedCatalog.map(e => e.name));
  await expect(page.getByRole("group", { name: "专家分类" }).getByRole("button")).toHaveText(["全部专家", "办公提效", "设计制作", "网页应用", "我的专家"]);
  for (const removed of ["高校创业导师", "升学备考通", "高校求职导师", "资讯每日简报", "腾讯专家", "开学季", "专家团", "最热"]) await expect(page.locator(".experts-main")).not.toContainText(removed);
  await expect(page.locator(".expert-card-popularity,.expert-collections,.expert-team-card")).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  expect((await page.locator(".app-sidebar").boundingBox())!.width).toBe(277);
  await page.screenshot({ path: "../../.cache/experts-redesign-desktop.png", fullPage: true });
});

test("category filtering, task search, empty state and keyboard actions work", async ({ page }) => {
  await page.goto("/experts");
  for (const category of ["办公提效", "设计制作", "网页应用"]) {
    await page.getByRole("button", { name: category, exact: true }).click();
    await expect(page.locator(".expert-directory-card")).toHaveCount(expertCatalog.filter(e => e.category === category).length);
    await expect(page.locator(".expert-card-heading h3")).toHaveText(expertCatalog.filter(e => e.category === category).map(e => e.name));
  }
  await page.getByRole("button", { name: "全部专家", exact: true }).click();
  await page.getByRole("searchbox", { name: "搜索专家" }).fill("营销物料");
  await expect(page.locator(".expert-directory-card")).toHaveCount(1);
  await page.getByRole("searchbox", { name: "搜索专家" }).fill("不存在的任务xyz");
  await expect(page.getByRole("heading", { name: "没有找到匹配的专家" })).toBeVisible();
  await page.getByRole("searchbox", { name: "搜索专家" }).fill("营销物料");
  await page.getByRole("button", { name: "查看营销物料专家", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("营销物料专家");
});

test("every routed expert detail page shows methods, limitations and three actual homepage task examples", async ({ page }) => {
  test.setTimeout(90000);
  for (const expert of expertCatalog) {
    await page.goto(`/experts/${expert.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(expert.name);
    for (const heading of ["需要提供的材料", "工作步骤", "交付内容", "检查与验收标准", "当前能力与限制"]) await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await expect(page.locator(".expert-capability-note")).toContainText(expert.limits);
    await expect(page.getByRole("region", { name: "任务示例" }).getByRole("button")).toHaveCount(3);
    const task = allPromptTasks.find(t => t.id === expert.taskIds[0])!;
    await page.getByRole("button", { name: `使用任务示例：${task.title}`, exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("textbox", { name: "任务描述", exact: true })).toHaveValue(task.prompt);
    await expect(page.locator(".home-expert-trigger")).toContainText(expert.name);
  }
});

test("choosing an expert preserves the current draft, attachments, model, workspace and permission", async ({ page }) => {
  let executions = 0;
  page.on("request", r => { if (/\/api\/(chat|generation|expert-match)$/.test(r.url())) executions++; });
  await page.goto("/");
  await page.getByRole("textbox", { name: "任务描述", exact: true }).fill("请保留我的原始任务");
  await setWorkspace(page, "个人空间");
  await setPermission(page, "仅本地");
  await page.locator('input.visually-hidden-input[type="file"]').setInputFiles({ name: "keep.csv", mimeType: "text/csv", buffer: Buffer.from("项目,金额\n设计,200") });
  const model = await page.getByRole("button", { name: "选择大模型", exact: true }).textContent();
  await openExperts(page);
  await page.getByRole("button", { name: "使用数据分析专家", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "任务描述", exact: true })).toHaveValue("请保留我的原始任务");
  await expect(page.locator(".attachment-chip")).toContainText("keep.csv");
  await expectWorkspace(page, "个人空间");
  await expect(page.getByLabel("任务权限", { exact: true })).toHaveValue("仅本地");
  await expect(page.getByRole("button", { name: "选择大模型", exact: true })).toHaveText(model!);
  await expect(page.locator(".home-expert-trigger")).toContainText("数据分析专家");
  expect(executions).toBe(0);
  await page.locator(".home-expert-trigger").click();
  await page.getByRole("button", { name: "查看专家详情", exact: true }).click();
  await expect(page).toHaveURL(/\/experts\/data$/);
  await page.getByRole("button", { name: "用于当前任务", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "任务描述", exact: true })).toHaveValue("请保留我的原始任务");
});

test("task example replacement asks first, cancellation does not change expert or prompt", async ({ page }) => {
  // Composer defaults live in the account: an earlier spec in this file pins
  // 「仅本地」, which would otherwise leave auto-matching disabled here.
  await resetComposerDefaults(page);
  await page.getByRole("textbox", { name: "任务描述", exact: true }).fill("不要覆盖原文");
  await openExperts(page); await page.getByRole("button", { name: "查看数据分析专家", exact: true }).click();
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("button", { name: /使用任务示例：/ }).first().click();
  await expect(page.getByRole("textbox", { name: "任务描述", exact: true })).toHaveValue("不要覆盖原文");
  await expect(page.locator(".home-expert-trigger")).toHaveText("自动匹配专家");
  await openExperts(page); await page.getByRole("button", { name: "查看数据分析专家", exact: true }).click();
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: /使用任务示例：/ }).first().click();
  await expect(page.getByRole("textbox", { name: "任务描述", exact: true })).toHaveValue(/客户名单核对/);
  await expect(page.locator(".home-expert-trigger")).toContainText("数据分析专家");
  await expect(page).toHaveURL(/\/$/);
});

test("my experts can be created, reloaded and used, while existing custom experts/history remain untouched", async ({ page }) => {
  const saved = { state: { experts: [{ id: "personal-retained", name: "高校创业导师（我创建）", description: "保留我的原有专业资料", skills: ["整理"], capabilities: ["复核材料"], status: "active", createdAt: "2026-10-01T00:00:00Z" }], skills: [], connectors: [], assets: [] }, version: 0 };
  await page.addInitScript(value => {
    if (!localStorage.getItem("test.experts.seeded")) {
      localStorage.setItem("designbuddy.workspace.v1", JSON.stringify(value));
      localStorage.setItem("designbuddy.conversation.v1.keep", "historical-task-content");
      localStorage.setItem("test.experts.seeded", "yes");
    }
  }, saved);
  await page.goto("/experts");
  await page.getByRole("button", { name: "我的专家", exact: true }).click();
  await expect(page.locator(".expert-directory-card")).toHaveCount(1);
  await expect(page.locator(".expert-directory-card")).toContainText("高校创业导师（我创建）");
  await page.getByRole("button", { name: "创建专家", exact: true }).click();
  await page.getByLabel("专家名称", { exact: true }).fill("我的供应链专家");
  await page.getByLabel("职责描述", { exact: true }).fill("核对供应链交付、延期和成本。");
  await page.getByRole("button", { name: "保存专家", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("我的供应链专家");
  await page.getByRole("button", { name: "用于当前任务", exact: true }).click();
  await expect(page.locator(".home-expert-trigger")).toContainText("我的供应链专家");
  const result = await page.evaluate(() => ({ workspace: JSON.parse(localStorage.getItem("designbuddy.workspace.v1")!), history: localStorage.getItem("designbuddy.conversation.v1.keep") }));
  expect(result.workspace.state.experts[0]).toEqual(saved.state.experts[0]);
  expect(result.workspace.state.experts).toHaveLength(2);
  expect(result.history).toBe("historical-task-content");
});

test("retired built-in links do not resurrect irrelevant experts, closest legacy developer URL still works", async ({ page }) => {
  await page.goto("/experts/builtin-campus"); await expect(page.getByRole("heading", { name: "该专家已下架或不存在" })).toBeVisible();
  await expect(page.getByRole("button", { name: "用于当前任务", exact: true })).toHaveCount(0);
  await page.goto("/experts/builtin-developer"); await expect(page.getByRole("heading", { level: 1 })).toHaveText("全栈开发专家");
});

test("homepage matching candidates exactly match the directory experts, including added roles", async ({ page }) => {
  let body: any;
  await page.route("**/api/expert-match", route => { body = route.request().postDataJSON(); return route.fulfill({ json: { kind: "match", expertId: "brand", collaboratorIds: [], reason: "需要统一品牌识别。", responsibilities: ["建立配色与字体规范"], missing: [] } }); });
  // Same account-level defaults: the consent prompt only appears while the
  // policy is the default one, so reset before expecting it.
  await resetComposerDefaults(page);
  await page.getByRole("textbox", { name: "任务描述", exact: true }).fill("帮我制定品牌配色规范");
  await page.locator(".home-expert-trigger").click();
  await page.getByRole("button", { name: "允许并开启自动匹配", exact: true }).click();
  await expect(page.locator(".home-expert-trigger")).toContainText("品牌视觉专家");
  expect(body.experts.map((e: any) => [e.id, e.name, e.method, e.checks])).toEqual(expertCatalog.map(e => [e.id, e.name, e.method, e.checks]));
  await page.getByRole("button", { name: "查看专家详情", exact: true }).click();
  await expect(page).toHaveURL(/\/experts\/brand$/);
});

test("skills and connectors remain reachable", async ({ page }) => {
  await page.goto("/experts");
  await page.getByRole("navigation", { name: "专家技能连接器导航" }).getByRole("button", { name: "技能", exact: true }).click();
  await expect(page).toHaveURL(/\/skills$/);
  await page.getByRole("navigation", { name: "专家技能连接器导航" }).getByRole("button", { name: "专家", exact: true }).click();
  await page.getByRole("navigation", { name: "专家技能连接器导航" }).getByRole("button", { name: "连接器", exact: true }).click();
  await expect(page.getByRole("main", { name: "连接器市场" })).toBeVisible();
});
for (const width of [320, 375, 768, 1440]) {
  test(`directory and expert details fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await page.goto("/experts");
    await expect(page.getByRole("searchbox", { name: "搜索专家" })).toBeVisible();
    await expect(page.getByRole("button", { name: "我的专家", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.getByRole("button", { name: "查看文档整理专家", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("文档整理专家");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const heading = await page.getByRole("heading", { level: 1 }).boundingBox();
    expect(heading!.width).toBeGreaterThan(150);
    expect(heading!.height).toBeLessThan(70);
    if (width === 375) await page.screenshot({ path: "../../.cache/expert-detail-mobile.png", fullPage: true });
  });
}
