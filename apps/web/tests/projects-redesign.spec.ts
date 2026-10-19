import { test, expect, type Page } from "@playwright/test";
const key = "designbuddy.projects.v1";
const project = (id: string, name: string, updatedAt: string, extras = {}) => ({
  id,
  name,
  prompt: "整理需求与交付内容",
  files: [
    { path: "index.html", language: "html", content: "<h1>项目文件</h1>" },
    { path: "src/styles.css", language: "css", content: "body{}" },
  ],
  status: "draft",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt,
  ...extras,
});
const examples = [
  project("alpha", "产品介绍页", "2026-10-01T08:00:00Z", {
    workspaceId: "team",
    workspaceName: "产品组",
  }),
  project("beta", "品牌视觉探索", "2026-10-18T08:00:00Z"),
  project("gamma", "研究资料整理", "2026-10-10T08:00:00Z", {
    prompt: "梳理用户访谈要点",
  }),
];
async function seed(page: Page, items = examples) {
  await page.route("**/api/workspaces", (r) =>
    r.fulfill({
      json: {
        workspaces: [
          {
            id: "team",
            name: "产品组",
            ownerId: "owner",
            joinCode: "",
            createdAt: "2026-01-01",
          },
        ],
      },
    }),
  );
  await page.goto("/projects");
  await page.evaluate(([k, p]) => localStorage.setItem(k, JSON.stringify(p)), [
    key,
    items,
  ] as const);
  await page.reload();
  await expect(page.locator(".projects-main h1")).toContainText("我的项目");
}
const cards = (page: Page) => page.locator(".projects-card");

test("shared workspace navigation, real file overview, search, grouping, sort and grid/list views", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await seed(page);
  await expect(
    page.locator('.app-sidebar button[aria-current="page"]'),
  ).toContainText("任务");
  expect((await page.locator(".app-sidebar").boundingBox())!.width).toBe(239);
  await expect(cards(page)).toHaveCount(3);
  await expect(cards(page).first()).toContainText("品牌视觉探索");
  await expect(cards(page).first()).toContainText("src/styles.css");
  await page.getByLabel("项目排序", { exact: true }).selectOption("name");
  const names = await cards(page).locator("h2").allTextContents();
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "zh-CN")));
  await page.getByLabel("项目排序", { exact: true }).selectOption("updated");
  await page
    .getByRole("textbox", { name: "搜索项目", exact: true })
    .fill("用户访谈");
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toContainText("研究资料整理");
  await page.getByRole("button", { name: "清空项目搜索", exact: true }).click();
  await page.getByLabel("按工作空间筛选").selectOption("team");
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toContainText("工作空间：产品组");
  await page
    .getByRole("textbox", { name: "搜索项目", exact: true })
    .fill("不匹配的内容");
  await expect(
    page.getByRole("heading", { name: "没有找到匹配的项目" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "清空筛选", exact: true }).click();
  await expect(cards(page)).toHaveCount(3);
  await page.getByRole("button", { name: "未分组", exact: true }).click();
  await expect(cards(page)).toHaveCount(2);
  await page.getByRole("button", { name: "列表视图", exact: true }).click();
  await expect(page.locator(".projects-collection")).toHaveClass(/is-list/);
  await expect(
    page.getByRole("button", { name: "列表视图", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /^全部项目/ }).click();
  await expect(cards(page)).toHaveCount(3);
  await page.getByRole("button", { name: "卡片视图", exact: true }).click();
  await page.screenshot({
    path: "../../.cache/projects-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "浏览模板", exact: true }).click();
  await expect(page).toHaveURL(/\/inspiration$/);
});

test("create, resume editing and resume a conversation retain their intended routes", async ({
  page,
}) => {
  await seed(page, []);
  await expect(
    page.getByRole("heading", { name: "给下一个想法，一个起点" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "创建第一个项目", exact: true })
    .click();
  await expect(page).toHaveURL(/\/editor\//);
  await page.goto("/projects");
  await expect(cards(page)).toHaveCount(1);
  await cards(page)
    .getByRole("button", { name: "继续编辑", exact: true })
    .click();
  await expect(page).toHaveURL(/\/editor\//);
  await seed(page, [examples[0]]);
  await page.evaluate(() =>
    localStorage.setItem(
      "designbuddy.conversation.v1.alpha",
      JSON.stringify({
        projectId: "alpha",
        mode: "office",
        model: "test-model",
        permission: "confirm",
        messages: [],
      }),
    ),
  );
  await page.reload();
  await page.getByRole("button", { name: "继续对话", exact: true }).click();
  await expect(page).toHaveURL(/\/tasks\/alpha$/);
});

test("delete is confirmed, cancel is non-destructive, and deletion persists after reload", async ({
  page,
}) => {
  await seed(page);
  page.once("dialog", (d) => d.dismiss());
  await cards(page)
    .first()
    .getByRole("button", { name: /删除项目/ })
    .click();
  await expect(cards(page)).toHaveCount(3);
  page.once("dialog", (d) => {
    expect(d.message()).toContain("云端版本不受影响");
    return d.accept();
  });
  await cards(page)
    .first()
    .getByRole("button", { name: /删除项目/ })
    .click();
  await expect(cards(page)).toHaveCount(2);
  await expect(page.getByRole("alert")).toContainText("本机草稿");
  await page.reload();
  await expect(cards(page)).toHaveCount(2);
});

test("cloud loading keeps confirmation and failure safety, and only performs requested reads", async ({
  page,
}) => {
  await seed(page);
  const remote = project("alpha", "云端版本", "2026-10-19T08:00:00Z");
  let reads = 0;
  const writes: string[] = [];
  await page.route("**/api/projects", (r) => {
    if (r.request().method() !== "GET") writes.push(r.request().method());
    reads++;
    return r.fulfill({ json: [remote] });
  });
  const load = page.getByRole("button", {
    name: "载入云端/团队项目",
    exact: true,
  });
  page.once("dialog", (d) => d.dismiss());
  await load.click();
  await expect(load).toBeEnabled();
  expect(reads).toBe(1);
  await expect(
    page.getByRole("heading", { name: "产品介绍页", exact: true }),
  ).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await load.click();
  await expect(page.getByRole("alert")).toContainText("已载入 1 个");
  await expect(
    page.getByRole("heading", { name: "云端版本", exact: true }),
  ).toBeVisible();
  await expect(cards(page)).toHaveCount(3);
  expect(writes).toEqual([]);
  await page.route("**/api/projects", (r) =>
    r.fulfill({ status: 503, json: { error: "云端暂不可用" } }),
  );
  await load.click();
  await expect(load).toBeEnabled();
  await expect(page.getByRole("alert")).toContainText("云端暂不可用");
  await expect(cards(page)).toHaveCount(3);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "云端版本", exact: true }),
  ).toBeVisible();
});

for (const width of [320, 390, 768, 1440])
  test(`projects at ${width}px have no horizontal overflow, including long names and list view`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: 1000 });
    await seed(page, [
      ...examples,
      project("long", "很长的项目名称".repeat(15), "invalid", {
        prompt: "long-unbroken-text".repeat(80),
        workspaceName: "很长的工作空间名称".repeat(20),
      }),
    ]);
    for (const view of ["卡片视图", "列表视图"]) {
      await page.getByRole("button", { name: view, exact: true }).click();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      expect(
        await page
          .locator(".projects-main")
          .evaluate((e) => e.scrollWidth <= e.clientWidth),
      ).toBe(true);
      await expect(cards(page)).toHaveCount(4);
    }
    await page.getByRole("button", { name: "卡片视图", exact: true }).click();
    if (width === 390)
      await page.screenshot({
        path: "../../.cache/projects-mobile.png",
        fullPage: true,
      });
    expect(errors).toEqual([]);
  });

test("dark theme follows app surfaces and empty search resets both filters", async ({
  page,
}) => {
  await seed(page);
  await page.evaluate(() => (document.documentElement.dataset.theme = "dark"));
  await expect(page.locator(".projects-card").first()).toHaveCSS(
    "background-color",
    "rgb(31, 35, 46)",
  );
  await page.getByLabel("按工作空间筛选").selectOption("team");
  await page
    .getByRole("textbox", { name: "搜索项目", exact: true })
    .fill("nothing");
  await expect(page.locator(".projects-empty")).toBeVisible();
  await page.getByRole("button", { name: "清空筛选", exact: true }).click();
  await expect(cards(page)).toHaveCount(3);
  await page.screenshot({
    path: "../../.cache/projects-dark.png",
    fullPage: true,
  });
});
