import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
const key = "designbuddy.samples.v2.forme.sample";
const nav = (page: Page, name: string) =>
  page
    .getByRole("navigation", { name: "FORME 页面目录" })
    .getByRole("button", { name: new RegExp(name + "$") })
    .click();
async function file(page: Page, name: string) {
  const waiting = page.waitForEvent("download");
  await page.getByRole("button", { name, exact: true }).click();
  return readFile((await (await waiting).path())!);
}
async function addChair(page: Page) {
  await nav(page, "单品详情");
  await page.getByLabel("木色", { exact: true }).selectOption("oak");
  await page.getByLabel("面料", { exact: true }).selectOption("wool");
  await page.getByLabel("采购数量", { exact: true }).fill("2");
  await page.getByRole("button", { name: /加入采购清单 ·/ }).click();
}
async function seed(page: Page) {
  await page.addInitScript((key) => {
    localStorage.setItem(
      key,
      JSON.stringify({
        cart: [{ product: 0, finish: "walnut", fabric: "linen", qty: 2 }],
        client: "演示客户",
        contact: "demo@example.test",
        address: "示例路一号，仅供本地演示",
        receipt: {
          id: "FM-DEMO1234",
          createdAt: "2026-10-15T09:00:00.000Z",
          client: "演示客户",
          contact: "demo@example.test",
          address: "示例地址",
          lines: [{ product: 0, finish: "walnut", fabric: "linen", qty: 2 }],
          delivery: 0,
          assembly: false,
          total: 6560,
          status: "draft",
        },
      }),
    );
  }, key);
}

test("FORME has 24 substantive navigable pages, five original images and no runtime errors", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/inspiration/forme");
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const buttons = page
    .getByRole("navigation", { name: "FORME 页面目录" })
    .getByRole("button");
  await expect(buttons).toHaveCount(24);
  const contents = new Set<string>();
  const images = new Set<string>();
  for (let i = 0; i < 24; i++) {
    await buttons.nth(i).click();
    await expect(page.locator(`.fm-page-${i}`)).toBeVisible();
    const text = await page.locator(".fm-page").innerText();
    expect(text.length).toBeGreaterThan(70);
    contents.add(text);
    for (const src of await page
      .locator(".fm-page img")
      .evaluateAll((es) => es.map((e) => (e as HTMLImageElement).src)))
      images.add(src);
  }
  expect(contents.size).toBe(24);
  expect(images.size).toBe(5);
  expect(errors).toEqual([]);
});

test("catalog search/filter/sort, favorites and capped comparison operate on actual products", async ({
  page,
}) => {
  await page.goto("/inspiration/forme");
  await nav(page, "家具目录");
  await expect(page.locator(".fm-product")).toHaveCount(4);
  await page.getByLabel("搜索家具").fill("不存在");
  await expect(
    page.getByRole("heading", { name: "没有匹配的物件" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "重置筛选", exact: true }).click();
  await page.getByLabel("家具排序").selectOption("价格从低到高");
  await expect(page.locator(".fm-product").first()).toContainText("纸间落地灯");
  await page
    .locator(".fm-pills")
    .getByRole("button", { name: "座椅", exact: true })
    .click();
  await expect(page.locator(".fm-product")).toHaveCount(1);
  await page.getByRole("button", { name: "收藏 +", exact: true }).click();
  await nav(page, "收藏清单");
  await expect(page.locator(".fm-product")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".fm-product")).toContainText("弧线休闲椅");
  await nav(page, "单品对比");
  await page
    .locator(".fm-pills")
    .getByRole("button", { name: "原石椭圆茶几 +", exact: true })
    .click();
  await page
    .locator(".fm-pills")
    .getByRole("button", { name: "纸间落地灯 +", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("最多同时对比三件");
  await expect(page.locator(".fm-compare th")).toHaveCount(4);
});

test("procurement to simulated receipt: real prices, validation, immutable snapshot and cancellation", async ({
  page,
}) => {
  await page.goto("/inspiration/forme");
  await addChair(page);
  await nav(page, "采购清单");
  await expect(page.locator(".fm-total")).toContainText("6,760.00");
  await nav(page, "交付配置");
  await page.getByRole("button", { name: /02.*基础配送/ }).click();
  await page.getByLabel("添加组装示例服务").check();
  await nav(page, "项目预算");
  await expect(page.getByLabel("项目总价")).toHaveText("¥7,400.00");
  await page
    .getByRole("spinbutton", { name: "项目预算", exact: true })
    .fill("1000");
  await expect(
    page.getByRole("heading", { name: "超出预算 ¥6,400.00" }),
  ).toBeVisible();
  await nav(page, "客户信息");
  await page.getByRole("button", { name: "核对报价 ↗", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("请填写联系人");
  await page.getByLabel("联系人", { exact: true }).fill("林设计");
  await page.getByLabel("邮箱或电话").fill("lin@example.test");
  await page.getByLabel("交付地址说明").fill("示例城市示例街区 88 号");
  await page.getByRole("button", { name: "核对报价 ↗", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "进入模拟结算", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("确认本地演示").check();
  await page.getByRole("button", { name: "进入模拟结算", exact: true }).click();
  await page
    .getByRole("button", { name: "生成本地演示订单", exact: true })
    .click();
  await expect(page.locator(".fm-receipt")).toContainText("¥7,400.00");
  await expect(page.locator(".fm-receipt")).toContainText("未付款 · 未发送");
  const receipt = JSON.parse((await file(page, "下载回执 JSON")).toString());
  expect(receipt.total).toBe(7400);
  expect(receipt.lines[0].qty).toBe(2);
  await nav(page, "采购清单");
  await page.getByLabel("清单第1项数量").fill("3");
  await nav(page, "订单回执");
  await expect(page.locator(".fm-receipt .fm-total")).toContainText("7,400.00");
  await nav(page, "订单管理");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "取消演示订单", exact: true }).click();
  await page.reload();
  await expect(page.getByText("已取消（本地）", { exact: true })).toBeVisible();
});

test("layout pointer/coordinate edits, doorway check, undo redo and named versions persist", async ({
  page,
}) => {
  await page.goto("/inspiration/forme");
  await nav(page, "空间布局");
  await page.getByLabel("水平位置", { exact: true }).fill("100");
  await page.getByLabel("垂直位置", { exact: true }).fill("140");
  await expect(page.locator(".fm-floor svg g").first()).toHaveAttribute(
    "transform",
    "translate(100 140)",
  );
  const rect = (await page.locator(".fm-floor svg g").first().boundingBox())!;
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    rect.x + rect.width / 2 + 25,
    rect.y + rect.height / 2 + 20,
    { steps: 4 },
  );
  await page.mouse.up();
  await expect(page.getByLabel("水平位置", { exact: true })).not.toHaveValue(
    "100",
  );
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(page.getByLabel("水平位置", { exact: true })).toHaveValue("100");
  await nav(page, "尺寸与入户");
  await page.getByLabel("入户净宽").fill("55");
  await expect(
    page.getByRole("heading", { name: "需要进一步核查" }),
  ).toBeVisible();
  await nav(page, "场景灵感");
  await page.getByLabel("项目名称", { exact: true }).fill("初始版本");
  await page.getByLabel("版本名称").fill("方案 A");
  await page.getByRole("button", { name: "保存版本", exact: true }).click();
  await page.getByLabel("项目名称", { exact: true }).fill("第二版本");
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(page.getByLabel("项目名称", { exact: true })).toHaveValue(
    "初始版本",
  );
  await page.getByRole("button", { name: "重做", exact: true }).click();
  await expect(page.getByLabel("项目名称", { exact: true })).toHaveValue(
    "第二版本",
  );
  page.once("dialog", (d) => d.accept());
  await page.getByLabel("恢复命名版本").selectOption("0");
  await expect(page.getByLabel("项目名称", { exact: true })).toHaveValue(
    "初始版本",
  );
  await page.reload();
  await expect(page.getByLabel("项目名称", { exact: true })).toHaveValue(
    "初始版本",
  );
  await expect(page.getByLabel("恢复命名版本")).toContainText("方案 A");
});

test("copy isolation and own edits survive refresh", async ({ page }) => {
  await page.goto("/inspiration/forme");
  await nav(page, "场景灵感");
  await page.getByLabel("项目名称", { exact: true }).fill("原项目");
  await page.getByRole("button", { name: /做同款/ }).click();
  await expect(page).toHaveURL(/forme\/draft\//);
  await expect(page.getByLabel("项目名称", { exact: true })).toHaveValue(
    "原项目",
  );
  await page.getByLabel("项目名称", { exact: true }).fill("独立副本");
  await page.reload();
  await expect(page.getByLabel("项目名称", { exact: true })).toHaveValue(
    "独立副本",
  );
  await page.goto("/inspiration/forme");
  await expect(page.getByLabel("项目名称", { exact: true })).toHaveValue(
    "原项目",
  );
});

test("exports contain current prices, escaped text and real embedded photos, and run offline", async ({
  page,
  context,
}) => {
  await page.goto("/inspiration/forme");
  await addChair(page);
  await nav(page, "场景灵感");
  const title = "=SUM(1,2)";
  await page.getByLabel("项目名称", { exact: true }).fill(title);
  await page
    .getByLabel("我的空间笔记")
    .fill("<script>window.INJECTED=true</script>");
  await nav(page, "项目交付");
  const csv = (await file(page, "下载采购报价")).toString();
  expect(csv).toContain("'=SUM(1,2)");
  expect(csv).toContain("6760");
  const json = JSON.parse((await file(page, "下载项目备份")).toString());
  expect(json.state.cart[0].qty).toBe(2);
  const html = (await file(page, "下载空间方案")).toString();
  expect(html).toContain("data:image/webp;base64,");
  expect(html).toContain("data:font/woff2;base64,");
  expect(html).toContain("data-font-license");
  expect(html).toContain("&lt;script&gt;");
  const offline = await context.newPage();
  await offline.route("**/*", (r) => r.abort());
  await offline.setContent(html);
  await offline.evaluate(() => document.fonts.ready);
  expect(
    await offline
      .locator("button")
      .evaluate((el) => getComputedStyle(el).fontFamily),
  ).toContain("Noto Sans SC");
  await expect(
    offline.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await expect(offline.locator("strong")).toContainText("6,760.00");
  expect(
    await offline
      .locator("img")
      .evaluateAll((es) =>
        es.every(
          (e) =>
            (e as HTMLImageElement).complete &&
            (e as HTMLImageElement).naturalWidth > 0,
        ),
      ),
  ).toBe(true);
  expect(await offline.evaluate(() => Boolean((window as any).INJECTED))).toBe(
    false,
  );
  await offline.close();
});

test("aftercare, checklist and consultation create only editable local records", async ({
  page,
}) => {
  await page.goto("/inspiration/forme");
  await nav(page, "交付检查");
  await page.getByLabel("外箱与封条完整").check();
  await expect(page.getByText("1 / 6 项已记录")).toBeVisible();
  await nav(page, "售后申请");
  await page.getByRole("button", { name: "记录售后草稿", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("至少填写 10 字");
  await page
    .getByLabel("问题描述")
    .fill("希望进一步确认沙发模块拆分后的包装尺寸。");
  await page.getByRole("button", { name: "记录售后草稿", exact: true }).click();
  expect((await file(page, "下载售后草稿")).toString()).toContain("包装尺寸");
  await nav(page, "设计咨询");
  await page.getByLabel("咨询意向日期").fill("2026-11-15");
  await page
    .getByLabel("咨询重点")
    .fill("客厅长五米，希望保留阅读区和足够的通道。");
  await page
    .getByRole("button", { name: "生成本地咨询简报", exact: true })
    .click();
  expect((await file(page, "下载咨询简报")).toString()).toContain(
    "尚未发送或预约",
  );
  await page.reload();
  await expect(page.locator(".fm-paper")).toContainText("客厅长五米");
});

test("malformed storage recovers safely and quota errors do not fake a saved copy", async ({
  page,
}) => {
  await page.addInitScript(
    (key) =>
      localStorage.setItem(
        key,
        JSON.stringify({
          page: 999,
          selected: -1,
          cart: [{ product: 100, qty: -1 }],
          layout: [null],
          receipt: { total: -500 },
          budget: 0,
          favorites: ["bad"],
        }),
      ),
    key,
  );
  await page.goto("/inspiration/forme");
  await expect(page.locator(".fm-page-0")).toBeVisible();
  await nav(page, "采购清单");
  await expect(
    page.getByRole("heading", { name: "还没有加入采购物件。" }),
  ).toBeVisible();
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k.startsWith("designbuddy.samples."))
        throw new DOMException("full", "QuotaExceededError");
      return set.call(this, k, v);
    };
  });
  await nav(page, "场景灵感");
  await page.getByLabel("项目名称", { exact: true }).fill("无法持久化");
  await expect(page.getByRole("status")).toContainText("浏览器存储不可用");
  await page.getByRole("button", { name: /做同款/ }).click();
  await expect(page).toHaveURL(/\/forme$/);
});

for (const width of [320, 375, 768, 1440])
  test(`all 24 pages have no outer overflow at ${width}px`, async ({
    page,
  }) => {
    await seed(page);
    await page.setViewportSize({ width, height: 950 });
    await page.goto("/inspiration/forme");
    const buttons = page
      .getByRole("navigation", { name: "FORME 页面目录" })
      .getByRole("button");
    for (let i = 0; i < 24; i++) {
      await buttons.nth(i).click();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        `page ${i + 1}`,
      ).toBeLessThanOrEqual(width);
    }
  });
