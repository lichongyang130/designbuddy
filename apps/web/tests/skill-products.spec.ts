import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { freshAccountPage } from "./auth-helpers";
const evidence = resolve(
  process.cwd(),
  "../../docs/verification/skills-consolidation-2026-10-20",
);

test("default directory shows 8 outcomes, not 49 tool cards; filters find former tools", async ({
  page,
}) => {
  await page.goto("/skills");
  await expect(page.getByRole("heading", { name: /选一个成果/ })).toBeVisible();
  await expect(page.locator(".product-card")).toHaveCount(8);
  await expect(page.locator(".skill-directory-card")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "添加技能" })).toHaveCount(0);
  await expect(page.locator(".product-summary")).toContainText(
    "主要路径当前可执行",
  );
  await page
    .getByRole("searchbox", { name: "搜索成果技能" })
    .fill("social.carousel");
  await expect(page.locator(".product-card")).toHaveCount(1);
  await expect(
    page.getByRole("article", { name: "营销与商品视觉" }),
  ).toBeVisible();
  await page.getByRole("searchbox").fill("");
  await page.getByRole("button", { name: "设计制作", exact: true }).click();
  await expect(page.locator(".product-card")).toHaveCount(2);
  await page.getByRole("button", { name: "整合与验收说明" }).click();
  await expect(
    page.getByRole("region", { name: "整合与验收说明" }),
  ).toContainText("不等于 244 个已安装执行器");
});

test("old favorites migrate by outcome without overwriting old tool favorites", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.removeItem("designbuddy.skill-product-favorites.v1");
    localStorage.setItem(
      "designbuddy.skill-favorites.v1",
      JSON.stringify(["table.analyze", "table.join", "social.carousel"]),
    );
  });
  await page.goto("/skills");
  await page.getByRole("button", { name: "只看收藏（2）" }).click();
  await expect(page.locator(".product-card")).toHaveCount(2);
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("designbuddy.skill-favorites.v1")!),
    ),
  ).toEqual(["table.analyze", "table.join", "social.carousel"]);
});

test("choosing a scene scopes the existing workbench to that executor only, and preserves deep links", async ({
  page,
}) => {
  await page.goto("/skills?product=documents&scene=document.structure");
  const workbench = page.getByRole("region", { name: "真实技能执行台" });
  await expect(workbench.getByLabel("执行技能")).toHaveValue(
    "document.structure",
  );
  await expect(workbench.getByLabel("执行技能").locator("option")).toHaveCount(
    1,
  );
  await page.getByLabel("这次要完成什么").selectOption("pdf.extract");
  await expect(workbench.getByLabel("执行技能")).toHaveValue("pdf.extract");
  await page.reload();
  await expect(workbench.getByLabel("执行技能")).toHaveValue("pdf.extract");
  await page.getByRole("button", { name: "收起工作区" }).click();
  await expect(page.locator(".product-panel")).toHaveCount(0);
});

test("configuration failures are explicit; no automatic fallback or third-party submission", async ({
  page,
}) => {
  let submissions = 0;
  await page.route("**/api/skill-runtime", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.skills = body.skills.map((s: any) =>
      s.id === "slides.create"
        ? {
            ...s,
            status: "unavailable",
            limits: "测试条件：AI 凭据缺失，禁止运行。",
            availabilityReason: "测试条件：AI 凭据缺失，禁止运行。",
          }
        : s,
    );
    await route.fulfill({ response, json: body });
  });
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      /skill-runs|\/workflows\/.+\/runs/.test(request.url())
    )
      submissions++;
  });
  await page.goto("/skills?product=presentations&scene=slides.create");
  await expect(
    page.getByRole("heading", { name: "当前不能执行此场景" }),
  ).toBeVisible();
  await expect(page.locator(".product-blocked")).toContainText("AI 凭据缺失");
  await expect(
    page.getByRole("region", { name: "真实技能执行台" }),
  ).toHaveCount(0);
  await page.getByLabel("这次要完成什么").selectOption("slides.compose");
  await expect(
    page.getByRole("region", { name: "真实技能执行台" }).getByLabel("执行技能"),
  ).toHaveValue("slides.compose");
  expect(submissions).toBe(0);
});

test("a catalog race cannot initialize an out-of-scope fallback executor", async ({
  page,
}) => {
  await page.goto("/skills");
  await expect(page.locator(".product-summary")).toContainText(
    "主要路径当前可执行",
  );
  await page.route("**/api/skill-runtime", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.skills = body.skills.map((s: any) =>
      s.id === "web.audit" ? { ...s, status: "unavailable" } : s,
    );
    await route.fulfill({ response, json: body });
  });
  await page
    .getByRole("button", { name: "打开技能：设计与交付质量检查" })
    .click();
  const workbench = page.getByRole("region", { name: "真实技能执行台" });
  await expect(workbench).toContainText("当前选择尚无满足执行条件的技能");
  await expect(workbench.getByLabel("执行技能")).toHaveCount(0);
});

test("catalog failure is fail-closed, retry recovers without a fake ready badge", async ({
  page,
}) => {
  await page.route("**/api/skill-runtime", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "测试：目录暂不可用" }),
    }),
  );
  await page.goto("/skills");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "打开技能：品牌与视觉系统" }),
  ).toBeDisabled();
  await page.unroute("**/api/skill-runtime");
  await page.getByRole("button", { name: "重试加载" }).click();
  await expect(
    page.getByRole("button", { name: "打开技能：品牌与视觉系统" }),
  ).toBeEnabled();
});

test("merged brand scene runs real steps in the same workspace and reopens persisted history", async ({
  browser,
}) => {
  test.setTimeout(60000);
  const owned = await freshAccountPage(
    browser,
    "product_" + crypto.randomUUID().slice(0, 8),
  );
  try {
    const page = owned.page;
    await page.goto("/skills?product=brand&scene=workflow%3Abrand-delivery");
    await expect(page.locator(".wf-embedded")).toBeVisible();
    await expect(page.locator("main")).toHaveCount(1);
    await page.locator("#wf-brandName").fill("林间样例");
    await page
      .locator("#wf-description")
      .fill("这是执行验证用的合成品牌，不代表真实客户。");
    await page.locator("#wf-concept").fill("清晰、自然");
    await page.locator("#wf-tagline").fill("让信息更容易理解");
    await page.locator("#wf-voice").fill("温和、明确");
    await page.getByRole("button", { name: "下一步：确认" }).click();
    await expect(page.locator(".wf-plan")).toContainText("brand.system");
    await expect(page.locator(".wf-plan")).toContainText("web.audit");
    await page.getByRole("button", { name: "确认并执行" }).click();
    await expect(page.locator(".wf-steps-list > li")).toHaveCount(3);
    for (let i = 0; i < 3; i++)
      await expect(page.locator(".wf-steps-list > li").nth(i)).toHaveAttribute(
        "data-status",
        "succeeded",
        { timeout: 60000 },
      );
    await expect(page.locator(".wf-artifacts")).toContainText([
      "brand-guidelines.html",
      "css-audit.json",
      "html-audit.json",
    ]);
    await expect(page.locator(".wf-steps-list")).toContainText(
      "未做浏览器或商业验收",
    );
    await page.getByRole("button", { name: "返回工作流列表" }).click();
    await expect(page.locator(".wf-run-list")).toContainText(
      "品牌系统与规范检查",
    );
    await page
      .getByRole("button", { name: /品牌系统与规范检查 · 已完成/ })
      .click();
    await expect(page.locator(".wf-steps-list > li")).toHaveCount(3);
  } finally {
    await owned.context.close();
  }
});

for (const width of [1440, 390, 320])
  test(`outcome directory and embedded form fit ${width}px without horizontal overflow`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/skills");
    await expect(page.locator(".product-summary")).toContainText(
      "主要路径当前可执行",
    );
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    if (width !== 320) {
      mkdirSync(evidence, { recursive: true });
      await page.screenshot({
        path: resolve(evidence, `skills-${width}.png`),
        fullPage: true,
      });
    }
    await page
      .getByRole("button", { name: "打开技能：品牌与视觉系统" })
      .click();
    await expect(page.locator("#wf-brandName")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });

test("advanced tools and the original history remain reachable", async ({
  page,
}) => {
  await page.goto("/skills");
  await page.getByRole("button", { name: "高级工具与历史" }).click();
  await expect(
    page.getByRole("heading", { name: "让每项技能，都对应真实交付" }),
  ).toBeVisible();
  await expect(page.locator(".skill-directory-card")).toHaveCount(49);
  await page.getByRole("button", { name: "← 精简技能" }).click();
  await expect(page.locator(".product-card")).toHaveCount(8);
});

for (const scene of ["", "?product=brand&scene=workflow%3Abrand-delivery"])
  test(`core content has no axe violations ${scene || "directory"}`, async ({
    page,
  }) => {
    const { default: AxeBuilder } = await import("@axe-core/playwright");
    await page.goto("/skills" + scene);
    await expect(page.locator(".product-summary")).toContainText(
      "主要路径当前可执行",
    );
    if (scene) await expect(page.locator("#wf-brandName")).toBeVisible();
    const audit = await new AxeBuilder({ page })
      .include(".product-content")
      .analyze();
    expect(
      audit.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  });

test("project default is a real human-readable form, not a JSON upload", async ({
  page,
}) => {
  await page.goto("/skills?product=projects");
  await expect(page.locator("#wf-project")).toBeVisible();
  await expect(page.locator(".wf-embedded")).toContainText("需求与验收条件");
  await expect(
    page.getByRole("button", { name: "上传并执行技能" }),
  ).toHaveCount(0);
});

test("collapsing the merged UI stops observation but does not cancel a real persisted run", async ({
  page,
}) => {
  await page.goto("/skills?product=brand");
  await page.locator("#wf-brandName").fill("后台恢复样例");
  await page.locator("#wf-description").fill("合成测试材料，不代表真实客户。");
  await page.locator("#wf-concept").fill("验证后台真实执行");
  await page.locator("#wf-voice").fill("明确");
  const started = page.waitForResponse(
    (response) =>
      response.url().includes("/workflows/brand-delivery/runs") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "下一步：确认" }).click();
  await page.getByRole("button", { name: "确认并执行" }).click();
  const { run } = await (await started).json();
  await page.getByRole("button", { name: "收起工作区" }).click();
  await expect(page.locator(".wf-embedded")).toHaveCount(0);
  let observed = 0;
  page.on("request", (request) => {
    if (
      request.method() === "GET" &&
      request.url().includes("/workflow-runs/" + run.id)
    )
      observed++;
  });
  await expect
    .poll(
      async () => {
        const response = await page.request.get("/api/workflow-runs/" + run.id);
        return (await response.json()).run.status;
      },
      { timeout: 30000 },
    )
    .toBe("succeeded");
  expect(observed).toBe(0);
});

test("invalid deep links do not silently open another executor, and identity changes clear the work area", async ({
  page,
}) => {
  await page.goto("/skills?product=documents&scene=not-a-scene");
  await expect(page.getByRole("alert")).toContainText("指定场景无效");
  await expect(
    page.getByRole("region", { name: "真实技能执行台" }),
  ).toHaveCount(0);
  await page.getByLabel("这次要完成什么").selectOption("document.structure");
  await expect(
    page.getByRole("region", { name: "真实技能执行台" }),
  ).toBeVisible();
  await page.evaluate(() =>
    window.dispatchEvent(new Event("designbuddy:server-identity")),
  );
  await expect(page.locator(".product-panel")).toHaveCount(0);
});
