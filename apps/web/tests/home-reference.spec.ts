import { expect, test } from "@playwright/test";

const title = /DesignBuddy 让工作更高效/;

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
});

test("reference 27 structure is on the right and shared sidebar remains unchanged", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const sidebar = page.locator(".app-sidebar");
  expect((await sidebar.boundingBox())!.width).toBe(239);
  expect((await sidebar.boundingBox())!.height).toBe(1000);
  await expect(
    sidebar.getByRole("button", { name: "首页", exact: true }),
  ).toBeVisible();
  for (const name of ["插件", "模版", "定时任务"]) {
    await expect(
      sidebar.getByRole("button", { name, exact: true }),
    ).toBeVisible();
  }
  await expect(
    sidebar.getByRole("button", { name: /^账号菜单：/ }),
  ).toBeVisible();
  await expect(sidebar).toHaveCSS("background-color", "rgb(242, 242, 242)");
  await expect(page.locator(".home27")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await expect(page.locator(".home27")).toHaveCSS("background-image", "none");
  await expect(
    page.locator(
      ".home27-hero-art, .home27-scene-preview img, .home27-scene-description",
    ),
  ).toHaveCount(0);
  await expect(page.locator(".home27-shortcuts svg, .home27-color-icon, .home27-eyebrow")).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "办公提效" })).toHaveCSS(
    "color",
    "rgb(68, 68, 68)",
  );
  const composer = (await page.locator(".composer-shell").boundingBox())!;
  const shortcuts = (await page.locator(".home27-shortcuts").boundingBox())!;
  const scenes = (await page.locator(".home27-scenes").boundingBox())!;
  expect(shortcuts.y + shortcuts.height).toBeLessThan(composer.y);
  expect(scenes.y).toBeGreaterThan(composer.y + composer.height);
  await expect(page.locator(".home27-shortcut")).toHaveCount(6);
  await expect(page.locator(".home27-scene")).toHaveCount(5);
});

test("all five shortcuts prepare an editable task without automatically sending", async ({
  page,
}) => {
  const calls: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      /\/api\/(chat|generation)/.test(request.url())
    )
      calls.push(request.url());
  });
  for (const name of ["文档整理", "数据表格", "会议纪要", "周报总结", "汇报PPT"]) {
    const input = page.getByRole("textbox", { name: "任务描述", exact: true });
    await input.fill("");
    await page.getByRole("button", { name, exact: true }).click();
    await expect(input).toHaveValue("");
    await page.getByRole("menu", { name: `${name}下级栏目` }).getByRole("menuitem").first().click();
    await expect(input).toHaveValue("");
    await page.locator(".home-prompt-list button").first().click();
    expect((await input.inputValue()).match(/\p{Script=Han}/gu)!.length).toBeGreaterThanOrEqual(200);
    await expect(input).toHaveValue(new RegExp(name));
    await expect(input).toBeFocused();
    await expect(page.getByRole("tab", { name: "办公提效", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("button", { name: "开始任务" })).toBeEnabled();
    await expect(page).toHaveURL(/\/$/);
  }
  expect(calls).toEqual([]);
});

test("all five popular scenes load the right prompt and retain workspace and policy", async ({
  page,
}) => {
  await page
    .getByLabel("工作空间", { exact: true })
    .selectOption("产品设计空间");
  await page.getByLabel("任务权限").selectOption("需要确认后执行");
  await page.locator(".home-example-library > summary").click();
  const cases = [
    ["会议纪要", "办公提效", "负责人"],
    ["周报生成", "办公提效", "工作记录"],
    ["表格分析", "办公提效", "CSV"],
    ["汇报PPT", "办公提效", "故事线"],
    ["邮件撰写", "办公提效", "收件对象"],
  ];
  for (const [name, mode, content] of cases) {
    await page.getByRole("textbox", { name: "任务描述" }).fill("");
    await page
      .getByRole("button", { name: `预览${name}`, exact: true })
      .click();
    await page
      .getByRole("dialog", { name: `${name}场景预览`, exact: true })
      .getByRole("button", { name: "使用此场景" })
      .click();
    await expect(page.getByRole("textbox", { name: "任务描述" })).toHaveValue(
      new RegExp(content),
    );
    await expect(page.getByRole("tab", { name: mode })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByLabel("工作空间", { exact: true })).toHaveValue(
      "产品设计空间",
    );
    await expect(page.getByLabel("任务权限")).toHaveValue("需要确认后执行");
  }
});

test("reference header and discovery links reach existing destinations", async ({
  page,
}) => {
  await expect(page.locator(".home27-topbar")).toHaveCount(0);
  for (const name of ["查看最近项目", "默认工作空间", "查看首页通知"]) await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
  await expect(page.getByLabel("工作空间", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "通知", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "通知中心" })).toContainText("暂时没有通知");
  await page.getByRole("button", { name: "关闭通知" }).click();
  await page.getByRole("button", { name: "搜索项目", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await page.goto("/");
  const previous = await page.locator(".home-prompt-list strong").allTextContents();
  await page.getByRole("button", { name: "换一批", exact: false }).click();
  expect(await page.locator(".home-prompt-list strong").allTextContents()).not.toEqual(previous);
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/");
  await page
    .getByRole("button", { name: "探索更多 AI 能力", exact: false })
    .click();
  await expect(page).toHaveURL(/\/plugins$/);
});

for (const width of [320, 375, 768, 1024, 1440]) {
  test(`reference cards stay accessible without horizontal overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    expect(
      await page
        .locator(".home27")
        .evaluate((el) => el.scrollWidth - el.clientWidth),
    ).toBeLessThanOrEqual(1);
    await page.locator(".home-example-library > summary").click();
    for (const card of await page.locator(".home27-scene").all()) {
      await card.scrollIntoViewIfNeeded();
      const box = (await card.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
    await page.getByRole("button", { name: "预览会议纪要" }).click();
    await page.getByRole("button", { name: "使用此场景" }).click();
    await expect(page.getByRole("textbox", { name: "任务描述" })).toBeFocused();
    await page.getByRole("button", { name: "选择大模型", exact: true }).click();
    const panel = (await page
      .getByRole("dialog", { name: "选择大模型", exact: true })
      .boundingBox())!;
    expect(panel.x).toBeGreaterThanOrEqual(0);
    expect(panel.y).toBeGreaterThanOrEqual(0);
    expect(panel.x + panel.width).toBeLessThanOrEqual(width);
    expect(panel.y + panel.height).toBeLessThanOrEqual(900);
  });
}

test("mode tabs use larger custom icons and readable centered labels", async ({
  page,
}) => {
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const list = page.getByRole("tablist", { name: "任务模式" });
    const box = (await list.boundingBox())!;
    const composer = (await page.locator(".composer-shell").boundingBox())!;
    expect(
      Math.abs(box.x + box.width / 2 - composer.x - composer.width / 2),
    ).toBeLessThan(1);
    for (const name of ["办公提效", "网页应用", "设计制作"]) {
      const tab = list.getByRole("tab", { name });
      await expect(tab).toHaveCSS("font-size", "14px");
      const icon = (await tab.locator(".home-mode-icon").boundingBox())!;
      expect(icon.width).toBeGreaterThanOrEqual(width <= 680 ? 20 : 26);
      expect((await tab.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await tab.click();
      await expect(tab).toHaveAttribute("aria-selected", "true");
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  }
});

test("requested home labels and select options stay 14px on desktop and mobile", async ({
  page,
}) => {
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const selectors = [
      ".footer-select select",
      ".footer-select option",
      ".model-picker",
      ".model-picker > span:nth-child(2)",
      ".mode-tab",
    ];
    for (const selector of selectors) {
      const elements = page.locator(selector);
      expect(await elements.count()).toBeGreaterThan(0);
      for (const element of await elements.all())
        await expect(element).toHaveCSS("font-size", "14px");
    }
    await expect(page.locator(".home27-hero-copy h1")).toHaveText(
      "DesignBuddy 让工作更高效",
    );
    await expect(page.locator(".home27-eyebrow")).toHaveCount(0);
    await page
      .getByRole("combobox", { name: "工作空间", exact: true })
      .selectOption("产品设计空间");
    await page
      .getByRole("combobox", { name: "任务权限", exact: true })
      .selectOption("需要确认后执行");
    for (const label of await page.locator(".footer-select").all()) {
      const box = (await label.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
    expect(
      await page
        .locator(".home27")
        .evaluate((el) => el.scrollWidth - el.clientWidth),
    ).toBeLessThanOrEqual(1);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  }
});

test("text shortcuts have bordered pill shapes on desktop and mobile", async ({ page }) => {
  for (const width of [320, 375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const shortcuts = page.locator(".home27-shortcut");
    await expect(shortcuts).toHaveCount(6);
    await expect(page.locator(".home27-shortcuts svg")).toHaveCount(0);
    for (const shortcut of await shortcuts.all()) {
      await expect(shortcut).toHaveCSS("border-radius", "999px");
      await expect(shortcut).toHaveCSS("border-top-width", "1px");
      await expect(shortcut).toHaveCSS("border-top-style", "solid");
      const selected = await shortcut.getAttribute("data-active") === "true";
      await expect(shortcut).toHaveCSS("border-top-color", selected ? "rgb(153, 153, 153)" : "rgb(201, 201, 201)");
      await expect(shortcut).toHaveCSS("background-color", selected ? "rgb(237, 237, 237)" : "rgb(255, 255, 255)");
      await expect(shortcut).toHaveCSS("font-size", "14px");
      const box = (await shortcut.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});

test("mode and category rows have breathing room and headline has no final period", async ({ page }) => {
  await expect(page.locator(".home27-hero h1")).toHaveText("DesignBuddy 让工作更高效");
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator(".home27-mode-row")).toHaveCSS("margin-bottom", "48px");
    const modes = (await page.getByRole("tablist", { name: "任务模式" }).boundingBox())!;
    const shortcuts = (await page.locator(".home27-shortcuts").boundingBox())!;
    expect(shortcuts.y - modes.y - modes.height).toBeGreaterThanOrEqual(48);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});

test("home uses a consistent centered column and section spacing across screen sizes", async ({ page }) => {
  for (const width of [320, 375, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    const box = async (selector: string) => (await page.locator(selector).boundingBox())!;
    const hero = await box(".home27-hero");
    const mode = await box(".home27-mode-row");
    const shortcuts = await box(".home27-shortcuts");
    const composer = await box(".composer-shell");
    const results = await box(".home-prompt-recommendations");
    const list = await box(".home-prompt-list");
    expect(mode.y - hero.y - hero.height).toBeCloseTo(width <= 680 ? 20 : 24, 0);
    expect(shortcuts.y - mode.y - mode.height).toBeCloseTo(48, 0);
    expect(composer.y - shortcuts.y - shortcuts.height).toBeCloseTo(16, 0);
    expect(results.y - composer.y - composer.height).toBeCloseTo(width <= 680 ? 28 : 32, 0);
    expect(composer.width).toBeLessThanOrEqual(960);
    expect(composer.x).toBeCloseTo(list.x, 0);
    expect(composer.width).toBeCloseTo(list.width, 0);
    expect(composer.x + composer.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if (width === 1440 || width === 375) await page.screenshot({ path: `../../.cache/home-layout-${width}.png` });
  }
});
