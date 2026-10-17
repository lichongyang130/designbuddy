import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => { await page.goto("/skills"); });

test("skills use the expert-directory layout and list real registered capabilities by area", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "让每项技能，都对应真实交付" })).toBeVisible();
  await expect(page.getByRole("button", { name: "添加技能" })).toBeVisible();
  await expect(page.getByRole("button", { name: "全部技能", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "办公提效", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "设计制作", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "网页应用", exact: true })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "搜索技能" })).toBeVisible();
  await expect(page.getByRole("button", { name: /全部（/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /可执行（/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /未接入（/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "办公提效技能" })).toBeVisible();
  await expect(page.getByRole("region", { name: "设计制作技能" })).toBeVisible();
  await expect(page.getByRole("region", { name: "网页应用技能" })).toBeVisible();
  await expect(page.getByRole("article", { name: "社交媒体多页轮播图生成" })).toBeVisible();
  await expect(page.getByRole("article", { name: "社交媒体多页轮播图生成" })).toContainText("social-carousel.zip");
  await expect(page.getByText(/项服务端注册技能/)).toBeVisible();
  await expect(page.getByText(/Microsoft 365|Deep Research|Google Flights/)).toHaveCount(0);
});

test("search, area filters and favorites operate on the real skills list", async ({ page }) => {
  const search = page.getByRole("searchbox", { name: "搜索技能" });
  await search.fill("财务收支汇总");
  await expect(page.getByRole("article", { name: "财务收支汇总与分类报告" })).toBeVisible();
  await expect(page.getByRole("article", { name: "OKR进度记分卡与核算" })).toHaveCount(0);
  await search.fill("");
  await page.getByRole("button", { name: "办公提效", exact: true }).click();
  await expect(page.getByRole("article", { name: "新员工入职计划与日历导出" })).toBeVisible();
  await expect(page.getByRole("article", { name: "社交媒体多页轮播图生成" })).toHaveCount(0);

  await page.getByRole("button", { name: "全部技能", exact: true }).click();
  const card = page.getByRole("article", { name: "社交媒体多页轮播图生成" });
  await card.getByRole("button", { name: "收藏技能：社交媒体多页轮播图生成" }).click();
  await page.getByRole("button", { name: /已收藏/ }).click();
  await expect(card).toBeVisible();
  await expect(page.getByRole("article", { name: "财务收支汇总与分类报告" })).toHaveCount(0);
});

test("skill details expose real file limits and launch the matching executor", async ({ page }) => {
  const card = page.getByRole("article", { name: "社交媒体多页轮播图生成" });
  await card.getByRole("button", { name: "查看技能：社交媒体多页轮播图生成" }).click();
  const dialog = page.getByRole("dialog", { name: "社交媒体多页轮播图生成" });
  await expect(dialog).toContainText(".json");
  await expect(dialog).toContainText("social-carousel.zip");
  await expect(dialog).toContainText("JSON≤2MB");
  await dialog.getByRole("button", { name: "打开执行工作台" }).click();
  const workbench = page.getByRole("region", { name: "真实技能执行台" });
  await expect(workbench).toBeVisible();
  await expect(page.getByRole("heading", { name: "运行：社交媒体多页轮播图生成" })).toBeVisible();
  await expect(workbench.getByLabel("执行技能")).toHaveValue("social.carousel");
});

test("every skill states the tool permissions it really uses", async ({ page }) => {
  const browserCard = page.getByRole("article", { name: "网页生成与浏览器验证" });
  await browserCard.getByRole("button", { name: "查看技能：网页生成与浏览器验证" }).click();
  const browserDialog = page.getByRole("dialog", { name: "网页生成与浏览器验证" });
  const permissions = browserDialog.getByRole("region", { name: "所需权限" });
  await expect(permissions).toBeVisible();
  await expect(permissions.getByRole("listitem")).toHaveCount(4);
  await expect(permissions).toContainText("访问网络地址");
  await expect(permissions).toContainText("启动本机子进程");
  await browserDialog.getByRole("button", { name: "关闭技能详情" }).click();

  const localCard = page.getByRole("article", { name: "杂志风格长文排版" });
  await localCard.getByRole("button", { name: "查看技能：杂志风格长文排版" }).click();
  const localDialog = page.getByRole("dialog", { name: "杂志风格长文排版" });
  const localPermissions = localDialog.getByRole("region", { name: "所需权限" });
  await expect(localPermissions.getByRole("listitem")).toHaveCount(2);
  await expect(localPermissions).toContainText("读取本机上传文件");
  await expect(localPermissions).not.toContainText("访问网络地址");
});

test("capabilities that still miss a server credential never gain a run button", async ({ page }) => {
  await page.getByRole("button", { name: /未接入（/ }).click();
  const card = page.getByRole("article", { name: "生成式图片与商品抠图" });
  await expect(card).toBeVisible();
  await expect(card).toContainText("执行器已接入，缺服务端凭据");
  await card.getByRole("button", { name: "查看未接入原因：生成式图片与商品抠图" }).click();
  const dialog = page.getByRole("dialog", { name: "生成式图片与商品抠图" });
  await expect(dialog.getByText("执行器已经接入，但服务端还没配置它需要的凭据或环境，因此暂不提供运行入口；补齐后即可真实执行，不会用模拟结果代替。")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "打开执行工作台" })).toHaveCount(0);
});

test("skill registration explanation does not claim client-side installation", async ({ page }) => {
  await page.getByRole("button", { name: "添加技能" }).click();
  const dialog = page.getByRole("dialog", { name: "添加真实技能" });
  await expect(dialog).toContainText("服务端注册实际执行器");
  await expect(dialog).toContainText("没有客户端安装外部技能包的功能");
  await dialog.getByRole("button", { name: "知道了" }).click();
  await expect(dialog).toHaveCount(0);
});

for (const width of [320, 375, 681, 768, 1440]) {
  test(`expert-style skill directory stays usable at ${width}px without page overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole("heading", { name: "让每项技能，都对应真实交付" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

test("generated photo thumbnails load as actual images in their skill cards", async ({ page }) => {
  const photos = page.locator(".skill-role-photo");
  await expect(photos).toHaveCount(10);
  await photos.evaluateAll(images => images.forEach(image => { (image as HTMLImageElement).loading = "eager"; }));
  await expect.poll(() => photos.evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
});

test("every registered skill card has one matching task icon or generated photo", async ({ page }) => {
  const cards = page.locator(".skill-directory-card");
  const catalogue = await page.evaluate(async () => (await (await fetch("/api/skill-runtime")).json()).skills.length);
  await expect(cards).toHaveCount(catalogue);
  expect(await page.locator(".skill-role-icon svg, .skill-role-photo").count()).toBe(catalogue);
  const ids = await page.locator(".skill-role-icon").evaluateAll(elements => elements.map(element => element.getAttribute("data-skill-id")));
  expect(new Set(ids).size).toBe(catalogue);
  expect(ids).not.toContain(null);
});

test("skill card titles never collide with their favorite controls on compact layouts", async ({ page }) => {
  for (const width of [681, 768, 800]) {
    await page.setViewportSize({ width, height: 900 });
    const card = page.getByRole("article", { name: "表格清洗与统计" });
    await expect(card).toBeVisible();
    const title = await card.locator("h3").boundingBox();
    const favorite = await card.getByRole("button", { name: "收藏技能：表格清洗与统计" }).boundingBox();
    expect(title).not.toBeNull();
    expect(favorite).not.toBeNull();
    expect(title!.x + title!.width).toBeLessThanOrEqual(favorite!.x);
  }
});

test("the five former placeholders now show their real executor state and what they still need", async ({ page }) => {
  // The browser and build skills are really executable now.
  const verify = page.getByRole("article", { name: "网页生成与浏览器验证" });
  await expect(verify).toContainText("可执行技能");
  await expect(verify).toContainText("服务端已接入");
  const build = page.getByRole("article", { name: "隔离构建与全栈运行" });
  await expect(build).toContainText("可执行技能");
  await expect(build).toContainText("需提供");
  // The two that need an external service say so instead of pretending the capability is missing.
  const image = page.getByRole("article", { name: "生成式图片与商品抠图" });
  await expect(image).toContainText("执行器已接入 · 缺服务端凭据");
  await expect(image).toContainText("执行器已接入，缺服务端凭据");
  const sync = page.getByRole("article", { name: "外部日历与消息同步" });
  await expect(sync).toContainText("执行器已接入 · 缺服务端凭据");
});
