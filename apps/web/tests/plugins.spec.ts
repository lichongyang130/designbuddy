import { test, expect } from "@playwright/test";

test("plugin market has editorial features, real curated cards and honest catalog scope", async ({
  page,
}) => {
  await page.goto("/plugins");
  await expect(
    page.getByRole("heading", { name: "插件", exact: false }).first(),
  ).toBeVisible();
  await expect(page.locator(".brand-lockup strong")).toHaveText("DesignBuddy");
  await expect(
    page.getByRole("button", { name: "插件", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".pm-featured")).toBeVisible();
  await expect(page.locator(".pm-card")).toHaveCount(12);
  await expect(page.locator(".pm-catalog-note")).toContainText(
    "480 项能力规格",
  );
  await expect(page.locator(".pm-grid h3").first()).toHaveText(
    "Figma 文件桥接",
  );
  await expect(page.locator(".pm-page-footer")).toContainText(
    "不代表安装、授权或已可执行",
  );
  await expect(page.locator(".db-library-card-color")).toHaveCount(0);
});

test("search covers all capabilities, handles case/space and has a useful empty state", async ({
  page,
}) => {
  await page.goto("/plugins");
  const search = page.getByRole("textbox", { name: "搜索插件" });
  await search.fill("  FIGMA  ");
  await expect(page.locator(".pm-card")).toHaveCount(1);
  await expect(page.locator(".pm-grid h3")).toHaveText("Figma 文件桥接");
  await expect(page.locator(".pm-featured")).toHaveCount(0);
  await search.fill("不存在XYZ插件");
  await expect(page.getByRole("status")).toContainText("没有找到匹配的插件");
  await page.getByRole("button", { name: "清除筛选，查看全部" }).click();
  await expect(search).toHaveValue("");
  await expect(page.locator(".pm-card")).toHaveCount(24);
  await search.fill("效率办公");
  await expect(page.locator(".pm-results-heading")).toContainText("共 48 项");
  await page.getByRole("button", { name: "清空插件搜索" }).click();
  await expect(search).toBeFocused();
  await expect(page.locator(".pm-results-heading")).toContainText("共 480 项");
});

test("Chinese categories and pagination cover the full catalog, and filter changes reset the page", async ({
  page,
}) => {
  await page.goto("/plugins");
  await page.getByRole("button", { name: "全部插件", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "插件页码" }).locator("option"),
  ).toHaveCount(20);
  await page.getByRole("button", { name: "下一页插件" }).click();
  await expect(page.getByRole("combobox", { name: "插件页码" })).toHaveValue(
    "2",
  );
  await expect(page.locator(".pm-grid h3").first()).toHaveText("组件目录");
  await page.getByRole("combobox", { name: "插件页码" }).selectOption("20");
  await expect(page.getByRole("button", { name: "下一页插件" })).toBeDisabled();
  await expect(page.locator(".pm-card")).toHaveCount(24);
  await page
    .getByRole("group", { name: "插件分类" })
    .getByRole("button", { name: "设计创意", exact: true })
    .click();
  await expect(page.getByRole("combobox", { name: "插件页码" })).toHaveValue(
    "1",
  );
  await expect(page.locator(".pm-results-heading")).toContainText("共 48 项");
  await page.getByRole("button", { name: "更多分类", exact: true }).click();
  await page
    .getByRole("group", { name: "插件分类" })
    .getByRole("button", { name: "研究采集", exact: true })
    .click();
  await expect(page.locator(".pm-card")).toHaveCount(2);
  await expect(page.locator(".pm-pagination")).toHaveCount(0);
  await page.getByRole("combobox", { name: "插件排序" }).selectOption("name");
  await expect(page.locator(".pm-grid h3")).toHaveText([
    "竞品研究",
    "网页采集器",
  ]);
});

test("hero links lead to design capabilities and the local toolbox", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/plugins");
  await page.getByRole("button", { name: "探索设计插件" }).click();
  await expect(
    page
      .getByRole("group", { name: "插件分类" })
      .getByRole("button", { name: "设计创意", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".pm-results-heading h2")).toHaveText("设计创意");
  await page.getByRole("button", { name: "精选发现", exact: true }).click();
  await page.getByRole("button", { name: "整理我的清单" }).click();
  await expect(page.getByRole("status")).toContainText("添上第一项能力");
  await page.getByRole("button", { name: "去发现插件" }).click();
  await expect(page.locator(".pm-results-heading")).toContainText("共 480 项");
});

test("saved plugins persist in the existing workspace store and can be removed without executing", async ({
  page,
}) => {
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && !r.url().endsWith("/api/local/session"))
      writes.push(r.url());
  });
  await page.goto("/plugins");
  await page
    .getByRole("button", { name: "收藏Figma 文件桥接", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("尚未安装或授权");
  await expect(
    page.getByRole("button", { name: "移除Figma 文件桥接", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await page.getByRole("button", { name: /我的清单.*1/ }).click();
  await expect(page.locator(".pm-card")).toHaveCount(1);
  const assets = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("designbuddy.workspace.v1")!).state
        .assets,
  );
  expect(
    assets.filter((a: { id: string }) => a.id === "plugin-01"),
  ).toHaveLength(1);
  expect(assets[0].type).toBe("plugins");
  await page
    .getByRole("button", { name: "移除Figma 文件桥接", exact: true })
    .click();
  await expect(page.locator(".pm-card")).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: /我的清单.*0/ }).click();
  await expect(page.locator(".pm-empty")).toBeVisible();
  expect(writes).toEqual([]);
});

test("detail dialog shows permissions, traps focus, supports Escape and restores focus", async ({
  page,
}) => {
  await page.goto("/plugins");
  const opener = page.getByRole("button", {
    name: "查看Figma 文件桥接详情",
    exact: true,
  });
  await opener.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("待配置适配器");
  await expect(dialog).toContainText("network:allowlisted");
  await expect(dialog).toContainText("workspace:read");
  await expect(dialog).toContainText("不会安装软件");
  await expect(
    page.getByRole("button", { name: "关闭插件详情" }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  expect(
    await dialog.evaluate((el) => el.contains(document.activeElement)),
  ).toBe(true);
  await page.keyboard.press("Tab");
  expect(
    await dialog.evaluate((el) => el.contains(document.activeElement)),
  ).toBe(true);
  await page.getByRole("button", { name: "加入我的清单", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("加入本地清单");
  await expect(
    dialog.getByRole("button", { name: "从我的清单移除", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  await opener.click();
  await page.mouse.click(5, 5);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("permission details for write capabilities remain explicit and link to existing connectors", async ({
  page,
}) => {
  await page.goto("/plugins");
  await page.getByRole("textbox", { name: "搜索插件" }).fill("Pull Request");
  await page
    .getByRole("button", { name: "查看Pull Request 助手详情", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("写入前确认");
  await expect(page.getByRole("dialog")).toContainText(
    "workspace:write:approval",
  );
  await page.getByRole("button", { name: "查看连接器", exact: false }).click();
  await expect(page).toHaveURL(/\/connectors$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    "hidden",
  );
});

test("Ctrl K focuses search; a storage failure is shown without a false saved state", async ({
  page,
}) => {
  await page.goto("/plugins");
  await page.getByRole("button", { name: "全部插件", exact: true }).focus();
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("textbox", { name: "搜索插件" })).toBeFocused();
  await page.evaluate(() => {
    const native = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === "designbuddy.workspace.v1")
        throw new DOMException("Full", "QuotaExceededError");
      native.call(this, k, v);
    };
  });
  await page
    .getByRole("button", { name: "查看Figma 文件桥接详情", exact: true })
    .click();
  await page.getByRole("button", { name: "加入我的清单", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "保存失败",
  );
  await expect(
    page.getByRole("button", { name: "加入我的清单", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "收藏Figma 文件桥接", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
});

for (const width of [320, 375, 768, 1024, 1440]) {
  test(`plugin market, all filters and detail controls fit ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.goto("/plugins");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.getByRole("button", { name: "更多分类", exact: true }).click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page
      .getByRole("button", { name: "查看Figma 文件桥接详情", exact: true })
      .click();
    const box = (await page.getByRole("dialog").boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y + box.height).toBeLessThanOrEqual(813);
    await expect(
      page.getByRole("button", { name: "加入我的清单", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "关闭插件详情" }).click();
  });
}
