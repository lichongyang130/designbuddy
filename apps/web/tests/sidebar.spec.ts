import { test, expect } from "@playwright/test";

test("sidebar uses DesignBuddy and the requested five entries in order", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".brand-lockup strong")).toHaveText("DesignBuddy");
  await expect(
    page.locator(
      ".app-sidebar > .sidebar-nav-item, .sidebar-navigation > .sidebar-nav-item",
    ),
  ).toHaveText(["首页", "插件", "模版", "定时任务", "更多"]);
  await expect(
    page.getByRole("button", { name: "首页", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("button", { name: "插件", exact: true }),
  ).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(page.locator(".sidebar-navigation")).not.toContainText("助理");
  await expect(page.locator(".sidebar-navigation")).not.toContainText("资料库");
  await expect(page.getByRole("menu", { name: "更多栏目" })).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "任务描述", exact: true })
    .fill("保留未提交的输入");
  await page.getByRole("button", { name: "首页", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "任务描述", exact: true }),
  ).toHaveValue("保留未提交的输入");
  await page.getByRole("button", { name: "定时任务", exact: true }).click();
  await expect(page.locator('.home-notice[role="status"]')).toContainText(
    "定时任务入口正在规划中",
  );
});

test("hover reveals three separate rows to the right and allows crossing into the menu", async ({
  page,
}) => {
  await page.goto("/");
  const more = page.getByRole("button", { name: "更多", exact: true });
  await more.hover();
  const menu = page.getByRole("menu", { name: "更多栏目" });
  await expect(menu.getByRole("menuitem")).toHaveText([
    "专家",
    "技能",
    "连接器",
  ]);
  const side = (await page.locator(".app-sidebar").boundingBox())!;
  const box = (await menu.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(side.x + side.width);
  const rows = await menu.getByRole("menuitem").all();
  for (let i = 1; i < rows.length; i++) {
    const above = (await rows[i - 1].boundingBox())!;
    const below = (await rows[i].boundingBox())!;
    expect(below.x).toBe(above.x);
    expect(below.y).toBeGreaterThanOrEqual(above.y + above.height);
  }
  await menu.getByRole("menuitem", { name: "专家", exact: true }).hover();
  await expect(menu).toBeVisible();
  await menu.getByRole("menuitem", { name: "专家", exact: true }).click();
  await expect(page).toHaveURL(/\/experts$/);
  await expect(menu).toHaveCount(0);
  await more.hover();
  await expect(
    menu.getByRole("menuitem", { name: "专家", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.mouse.move(700, 30);
  await expect(menu).toHaveCount(0);
});

test("more menu supports keyboard, Escape, click and outside dismissal", async ({
  page,
}) => {
  await page.goto("/");
  const more = page.getByRole("button", { name: "更多", exact: true });
  const menu = page.getByRole("menu", { name: "更多栏目" });
  await more.focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    menu.getByRole("menuitem", { name: "专家", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("End");
  await expect(
    menu.getByRole("menuitem", { name: "连接器", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(
    menu.getByRole("menuitem", { name: "技能", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/skills$/);
  await more.click();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(more).toBeFocused();
  await more.click();
  await expect(menu).toBeVisible();
  await page
    .getByRole("button", { name: "返回 DesignBuddy 首页", exact: true })
    .click();
  await expect(menu).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
});

test("plugins and templates open their real catalogs; template destination is inspiration", async ({
  page,
}) => {
  await page.route("https://images.unsplash.com/**", (route) => route.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "插件", exact: true }).click();
  await expect(page).toHaveURL(/\/plugins$/);
  await expect(
    page.getByRole("heading", { name: "插件", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "插件", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.getByRole("textbox", { name: "搜索插件" }).fill("Figma 文件桥接");
  await expect(page.locator(".pm-card")).toHaveCount(1);
  await page.getByRole("button", { name: "查看Figma 文件桥接权限" }).click();
  await expect(page.getByRole("dialog")).toContainText("权限声明");
  await page.getByRole("button", { name: "关闭插件详情", exact: true }).click();
  await page.getByRole("button", { name: "模版", exact: true }).click();
  await expect(page).toHaveURL(/\/inspiration$/);
  await expect(
    page.getByRole("heading", { name: "社区", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "模版", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page
    .getByRole("textbox", { name: "搜索作品", exact: true })
    .fill("开放影像");
  await expect(
    page.getByRole("heading", {
      name: "开放影像 · 多尺度结构研究",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "社区", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "首页", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
});

for (const width of [320, 375, 768, 1440]) {
  test(`all navigation and flyout entries remain reachable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.goto("/");
    const more = page.getByRole("button", { name: "更多", exact: true });
    await more.click();
    const menu = page.getByRole("menu", { name: "更多栏目" });
    const box = (await menu.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y + box.height).toBeLessThanOrEqual(812);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await menu.getByRole("menuitem", { name: "连接器", exact: true }).click();
    await expect(page).toHaveURL(/\/connectors$/);
    await expect(page.locator(".brand-lockup strong")).toHaveText(
      "DesignBuddy",
    );
  });
}

test("touch users can open more without hover", async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 375, height: 812 },
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:5173/");
  await page.getByRole("button", { name: "更多", exact: true }).tap();
  await page.getByRole("menuitem", { name: "技能", exact: true }).tap();
  await expect(page).toHaveURL(/\/skills$/);
  await context.close();
});
