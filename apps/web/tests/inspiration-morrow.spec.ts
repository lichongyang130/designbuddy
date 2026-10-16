import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
const configs = [
  {
    id: "morrow",
    prefix: "mr",
    title: "MORROW",
    field: "项目名称",
    initial: "每周的晨间仪式",
    json: "项目 JSON",
    csv: "费用 CSV",
    svg: "配方 SVG",
    html: "24 章离线 HTML",
    upload: "导入 MORROW 项目",
    images: [0, 2, 3, 18, 19],
  },
] as const;
type Id = "morrow";
const nav = async (page: Page, _id: Id, n: number) => {
  await page.getByLabel("MORROW 页面目录").selectOption(String(n));
};
async function file(page: Page, name: string) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name, exact: true }).click();
  return readFile((await (await pending).path())!);
}
for (const c of configs) {
  const key = `designbuddy.samples.v2.${c.id}.sample`;
  test(`${c.title}: distinct catalog, 24 substantive pages and five loaded images`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/inspiration");
    await page
      .getByRole("textbox", { name: "搜索作品", exact: true })
      .fill(c.title);
    await expect(page.locator(".sample-card")).toHaveCount(1);
    await page.locator(".sample-card>button").click();
    await expect(page).toHaveURL(new RegExp("/" + c.id + "$"));
    const headings = new Set<string>();
    for (let i = 0; i < 24; i++) {
      await nav(page, c.id, i);
      headings.add(await page.locator(`.${c.prefix}-page h1`).innerText());
      expect(
        (await page.locator(`.${c.prefix}-page`).innerText()).length,
      ).toBeGreaterThan(100);
    }
    expect(headings.size).toBe(24);
    const sources = new Set<string>();
    for (const i of c.images) {
      await nav(page, c.id, i);
      const imgs = page.locator(`.${c.prefix}-page img`);
      await expect(imgs).not.toHaveCount(0);
      await expect
        .poll(() =>
          imgs.evaluateAll((xs) =>
            xs.every(
              (x) =>
                (x as HTMLImageElement).complete &&
                (x as HTMLImageElement).naturalWidth > 400,
            ),
          ),
        )
        .toBe(true);
      for (const src of await imgs.evaluateAll((xs) =>
        xs.map((x) => (x as HTMLImageElement).src),
      ))
        sources.add(src);
    }
    expect(sources.size).toBe(5);
    expect(errors).toEqual([]);
  });
  test(`${c.title}: undo, redo, named versions and isolated copies`, async ({
    page,
  }) => {
    await page.goto("/inspiration/" + c.id);
    await nav(page, c.id, 1);
    await page.getByLabel(c.field, { exact: true }).fill("独立个人方案");
    await page.getByRole("button", { name: "撤销", exact: true }).click();
    await expect(page.getByLabel(c.field, { exact: true })).toHaveValue(
      c.initial,
    );
    await page.getByRole("button", { name: "重做", exact: true }).click();
    await page.getByLabel("版本名称", { exact: true }).fill("首次确认");
    await page.getByRole("button", { name: "保存版本", exact: true }).click();
    await page.getByLabel(c.field, { exact: true }).fill("暂时修改");
    page.once("dialog", (d) => d.accept());
    await page.getByLabel("恢复命名版本").selectOption("0");
    await expect(page.getByLabel(c.field, { exact: true })).toHaveValue(
      "独立个人方案",
    );
    await page.getByRole("button", { name: /做同款/ }).click();
    await expect(page).toHaveURL(new RegExp(c.id + "/draft/"));
    await expect(page.getByLabel("恢复命名版本")).toContainText("0/6");
    await page.getByLabel(c.field, { exact: true }).fill("只修改副本");
    await page.goto("/inspiration/" + c.id);
    await nav(page, c.id, 1);
    await expect(page.getByLabel(c.field, { exact: true })).toHaveValue(
      "独立个人方案",
    );
    await page.reload();
    await expect(page.getByLabel(c.field, { exact: true })).toHaveValue(
      "独立个人方案",
    );
  });
  test(`${c.title}: JSON import, CSV injection guard, escaped SVG and complete offline HTML`, async ({
    page,
    context,
  }) => {
    test.setTimeout(90000);
    await page.goto("/inspiration/" + c.id);
    await nav(page, c.id, 1);
    await page.getByLabel(c.field, { exact: true }).fill("=1+1");
    await nav(page, c.id, 23);
    const json = await file(page, c.json);
    expect(JSON.parse(json.toString()).format).toBe(c.id + "-project-v1");
    expect((await file(page, c.csv)).toString()).toContain("'=1+1");
    await page.getByLabel(c.upload).setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"format":"wrong"}'),
    });
    await expect(page.getByRole("status")).toContainText("不是 " + c.title);
    page.once("dialog", (d) => d.accept());
    await page.getByLabel(c.upload).setInputFiles({
      name: "project.json",
      mimeType: "application/json",
      buffer: json,
    });
    await nav(page, c.id, 1);
    await page
      .getByLabel(c.field, { exact: true })
      .fill("中文 <script>bad</script> 方案");
    await nav(page, c.id, 23);
    const svg = (await file(page, c.svg)).toString();
    expect(svg).toContain("<svg");
    expect(svg).toContain("data:font/woff2");
    const html = (await file(page, c.html)).toString();
    expect(html).toContain("&lt;script&gt;bad&lt;/script&gt;");
    expect(html.match(/<section id="p/g)?.length).toBe(24);
    expect(html.match(/<img src="data:image/g)?.length).toBe(5);
    expect(html).toContain("SIL OPEN FONT LICENSE");
    const offline = await context.newPage();
    await offline.route("**/*", (r) =>
      r.request().isNavigationRequest()
        ? r.fulfill({ contentType: "text/html", body: html })
        : r.abort(),
    );
    await offline.goto("http://offline.example.test/" + c.id);
    await offline.evaluate(() => document.fonts.ready);
    await expect(offline.locator("header h1")).toContainText(
      "<script>bad</script>",
    );
    await expect(offline.locator("section")).toHaveCount(24);
    expect(
      await offline
        .locator("img")
        .evaluateAll((xs) =>
          xs.every(
            (x) =>
              (x as HTMLImageElement).complete &&
              (x as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    ).toBe(true);
    await offline.locator("nav a").nth(9).click();
    await expect(offline).toHaveURL(/#p9$/);
    await offline.screenshot({ path: `../../.cache/${c.id}/offline.png` });
    await offline.close();
  });
  test(`${c.title}: malformed state bounded; failed storage does not pretend copy was saved`, async ({
    page,
  }) => {
    await page.addInitScript(
      ({ key }) =>
        localStorage.setItem(
          key,
          JSON.stringify({
            page: 999,
            width: -1,
            seats: ["x"],
            bookings: [{ id: "bad", resource: 999 }],
            review: { name: "bad", total: -1 },
            invoice: { total: -1 },
          }),
        ),
      { key },
    );
    await page.goto("/inspiration/" + c.id);
    await expect(page.locator(`.${c.prefix}-page`)).toHaveAttribute(
      "data-page",
      "0",
    );
    await nav(page, c.id, 1);
    await page.evaluate(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException("quota", "QuotaExceededError");
      };
    });
    await page.getByLabel(c.field, { exact: true }).fill("未保存也可备份");
    await expect(page.getByRole("status")).toContainText("浏览器存储不可用");
    await page.getByRole("button", { name: /做同款/ }).click();
    await expect(page).toHaveURL(new RegExp("/" + c.id + "$"));
    await nav(page, c.id, 23);
    expect(
      JSON.parse((await file(page, c.json)).toString()).state.project,
    ).toBe("未保存也可备份");
  });
  for (const width of [320, 375, 768, 1440])
    test(`${c.title}: all 24 pages fit ${width}px`, async ({ page }) => {
      test.setTimeout(90000);
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/inspiration/" + c.id);
      for (let i = 0; i < 24; i++) {
        await nav(page, c.id, i);
        await expect(page.locator(`.${c.prefix}-page`)).toHaveAttribute(
          "data-page",
          String(i),
        );
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
          `page ${i + 1}`,
        ).toBeLessThanOrEqual(width);
      }
      await nav(page, c.id, 0);
      if (width <= 375)
        expect(
          (await page.locator(".sample-top>div:nth-child(2)").boundingBox())!
            .width,
        ).toBeGreaterThan(160);
      await page.screenshot({
        path: `../../.cache/${c.id}/home-${width}.png`,
        fullPage: true,
      });
      await nav(page, c.id, 9);
      await page.screenshot({
        path: `../../.cache/${c.id}/layout-${width}.png`,
        fullPage: true,
      });
    });
  test(`${c.title}: actual account login and separate-browser server recovery`, async ({
    page,
    browser,
  }) => {
    const username = c.id + "_" + crypto.randomUUID().slice(0, 8),
      password = "sample-test-only-2026";
    async function login(p: Page, register: boolean) {
      await p.getByRole("button", { name: "工作区状态", exact: true }).click();
      const d = p.getByRole("dialog", { name: "后台连接与账号" });
      await d.getByLabel("服务器用户名").fill(username);
      await d.getByLabel("服务器密码").fill(password);
      await d
        .getByRole("button", {
          name: register ? "注册并保留访客数据" : "登录账号",
          exact: true,
        })
        .click();
      await expect(
        d.getByRole("button", { name: "退出服务器账号" }),
      ).toBeVisible();
      await d.getByRole("button", { name: "关闭服务器窗口" }).click();
    }
    await page.goto("/inspiration/" + c.id);
    await login(page, true);
    await nav(page, c.id, 1);
    await page.getByLabel(c.field, { exact: true }).fill("跨浏览器 " + c.title);
    await page
      .getByRole("button", { name: "保存到服务器", exact: true })
      .click();
    await expect(page.locator(".template-cloud")).toContainText(
      "已保存到服务器",
    );
    const second = await browser.newContext();
    try {
      const p = await second.newPage();
      await p.goto("http://127.0.0.1:5173/inspiration");
      await login(p, false);
      await p.getByRole("button", { name: "服务器作品", exact: true }).click();
      const d = p.getByRole("dialog", { name: "服务器作品" });
      await expect(d).toContainText(c.title);
      p.once("dialog", (d) => d.accept());
      await d.getByRole("button", { name: "恢复并打开", exact: true }).click();
      await expect(p).toHaveURL(new RegExp("/" + c.id + "$"));
      await expect(p.getByLabel(c.field, { exact: true })).toHaveValue(
        "跨浏览器 " + c.title,
      );
    } finally {
      await second.close();
    }
  });
}

test("MORROW: blend weights gate new items and preserve frozen cart configurations", async ({
  page,
}) => {
  await page.goto("/inspiration/morrow");
  await nav(page, "morrow", 4);
  await page.getByLabel("启用自定义拼配").check();
  await page.getByLabel("DAWN / 晨光 比例（%）").fill("50");
  await expect(page.locator(".mr-warning")).toContainText("110%");
  await nav(page, "morrow", 6);
  await expect(
    page.getByRole("button", { name: "加入单次清单" }),
  ).toBeDisabled();
  await nav(page, "morrow", 4);
  await page.getByLabel("EMBER / 余温 比例（%）").fill("10");
  await nav(page, "morrow", 6);
  await page.getByLabel("每袋规格").selectOption("1");
  await page.getByRole("button", { name: "加入单次清单" }).click();
  await nav(page, "morrow", 10);
  await expect(page.locator(".mr-basket")).toContainText("50/40/10%");
  await expect(page.locator(".mr-basket")).toContainText("¥153.90");
  await nav(page, "morrow", 4);
  await page.getByLabel("启用自定义拼配").uncheck();
  await nav(page, "morrow", 3);
  await page.getByLabel("当前单豆").selectOption("2");
  await nav(page, "morrow", 10);
  await expect(page.locator(".mr-basket")).toContainText("50/40/10%");
  await page.reload();
  await expect(page.locator(".mr-basket")).toContainText("¥307.80");
});
test("MORROW: exact pour totals, chronological chart validation and independent brew records", async ({
  page,
}) => {
  await page.goto("/inspiration/morrow");
  await nav(page, "morrow", 8);
  await page.getByLabel("配方咖啡粉（g）").fill("20");
  await page.getByLabel("粉水比（1 : x）").fill("15");
  await expect(page.locator(".mr-recipe")).toContainText("300");
  await expect(page.locator(".mr-recipe ol")).toContainText("60 ml");
  await expect(page.locator(".mr-recipe ol")).toContainText("132 ml");
  await expect(page.locator(".mr-recipe ol")).toContainText("108 ml");
  await nav(page, "morrow", 9);
  await page.getByLabel("第一段结束（秒）").fill("20");
  await expect(
    page.getByRole("button", { name: "导出注水 SVG" }),
  ).toBeDisabled();
  await expect(page.locator(".mr-warning")).toContainText("递增");
  await page.getByLabel("第一段结束（秒）").fill("100");
  await expect(page.locator(".mr-chart svg polyline")).toHaveAttribute(
    "points",
    /60,330/,
  );
  await nav(page, "morrow", 14);
  await page
    .getByLabel("本次冲煮观察")
    .fill("本次手动配方观察：香气清楚，记录实际注水。");
  await page.getByRole("button", { name: "保存这杯笔记" }).click();
  await nav(page, "morrow", 8);
  await page.getByLabel("配方咖啡粉（g）").fill("25");
  await nav(page, "morrow", 14);
  await expect(page.locator(".mr-note")).toContainText("20g / 1:15");
  await nav(page, "morrow", 17);
  await expect(page.locator(".mr-stock")).toContainText("500 g");
});
test("MORROW: four dated cycles, per-cycle rotation, skip and pause affect only subscription quote", async ({
  page,
}) => {
  await page.goto("/inspiration/morrow");
  await nav(page, "morrow", 12);
  await page.getByRole("button", { name: "生成四期计划" }).click();
  await expect(page.locator(".mr-cycles article")).toHaveCount(4);
  await expect(page.getByLabel("第 4 期日期")).toHaveValue("2026-12-14");
  await nav(page, "morrow", 20);
  await page.getByLabel("费用口径").selectOption("1");
  await expect(page.getByTestId("morrow-total")).toHaveText("¥725.04");
  await nav(page, "morrow", 12);
  await page.getByLabel("本地跳过第 2 期").check();
  await nav(page, "morrow", 20);
  await expect(page.getByTestId("morrow-total")).toHaveText("¥543.78");
  await nav(page, "morrow", 16);
  await page.getByLabel("轮换单豆").selectOption("2");
  await page.getByRole("button", { name: "替换所选期咖啡" }).click();
  await nav(page, "morrow", 12);
  await expect(page.locator(".mr-cycles article").nth(0)).toContainText(
    "EMBER",
  );
  await expect(page.locator(".mr-cycles article").nth(2)).toContainText("DAWN");
  await nav(page, "morrow", 20);
  await expect(page.getByTestId("morrow-total")).toHaveText("¥522.58");
  await nav(page, "morrow", 13);
  await page.getByRole("button", { name: "暂停本地计划" }).click();
  await nav(page, "morrow", 20);
  await expect(page.getByTestId("morrow-total")).toHaveText("¥0.00");
  await nav(page, "morrow", 13);
  await page.getByRole("button", { name: "恢复本地计划" }).click();
  await nav(page, "morrow", 20);
  await expect(page.getByTestId("morrow-total")).toHaveText("¥522.58");
  await page.reload();
  await expect(page.getByTestId("morrow-total")).toHaveText("¥522.58");
});
test("MORROW: cart shipping threshold, discount and immutable confirmation are calculated", async ({
  page,
}) => {
  await page.goto("/inspiration/morrow");
  await nav(page, "morrow", 6);
  await page.getByLabel("每期袋数").fill("3");
  await page.getByRole("button", { name: "加入单次清单" }).click();
  await nav(page, "morrow", 20);
  await expect(page.getByTestId("morrow-total")).toHaveText("¥248.04");
  await page.getByLabel("咖啡示例折扣（%）").fill("20");
  await expect(page.getByTestId("morrow-total")).toHaveText("¥214.33");
  await nav(page, "morrow", 11);
  await page.getByLabel("收件称呼").fill("晨间讨论人");
  await nav(page, "morrow", 22);
  await page.getByRole("button", { name: "冻结讨论确认稿" }).click();
  await expect(page.locator(".mr-review>strong")).toHaveText("¥214.33");
  await nav(page, "morrow", 19);
  await page.getByLabel("礼盒需求（个）").fill("2");
  await nav(page, "morrow", 20);
  await expect(page.getByTestId("morrow-total")).toHaveText("¥235.53");
  await nav(page, "morrow", 22);
  await expect(page.locator(".mr-review>strong")).toHaveText("¥214.33");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "撤回讨论稿" }).click();
  await expect(page.locator(".mr-review")).toContainText("本地已撤回");
});
test("MORROW: inventory prevents negative stock and plans never imply received coffee", async ({
  page,
}) => {
  await page.goto("/inspiration/morrow");
  await nav(page, "morrow", 17);
  await page.getByLabel("库存记录类型").selectOption("1");
  await page.getByLabel("库存记录数量（g）").fill("600");
  await page.getByLabel("库存记录说明").fill("试图超出当前库存");
  await page.getByRole("button", { name: "保存库存记录" }).click();
  await expect(page.getByRole("status")).toContainText("未扣除");
  await expect(page.locator(".mr-stock")).toContainText("500 g");
  await page.getByLabel("库存记录数量（g）").fill("100");
  await page.getByRole("button", { name: "保存库存记录" }).click();
  await expect(page.locator(".mr-stock")).toContainText("400 g");
  await nav(page, "morrow", 12);
  await page.getByRole("button", { name: "生成四期计划" }).click();
  await nav(page, "morrow", 7);
  await expect(page.locator(".mr-stat").nth(1)).toContainText("400 g");
  await expect(page.locator(".mr-stat").nth(2)).toContainText("11.11 天");
  await page.reload();
  await expect(page.locator(".mr-stat").nth(1)).toContainText("400 g");
});
test("MORROW: preference matching, roast date differences, private tasting and unsent request TXT", async ({
  page,
}) => {
  await page.goto("/inspiration/morrow");
  await nav(page, "morrow", 1);
  await page.getByLabel("果香偏好").fill("2");
  await page.getByLabel("甜感偏好").fill("4");
  await page.getByLabel("醇厚偏好").fill("5");
  await expect(page.locator(".mr-note")).toContainText("EMBER");
  await nav(page, "morrow", 18);
  await expect(page.locator(".mr-page h3")).toHaveText("13 天");
  await page.getByLabel("观察日期").fill("2026-10-31");
  await expect(page.locator(".mr-page h3")).toHaveText("日期顺序待复核");
  await nav(page, "morrow", 15);
  await page
    .getByLabel("品鉴说明")
    .fill("自己的观察：甜感与口感都有清楚的变化。");
  await page.getByRole("button", { name: "保存个人品鉴" }).click();
  await expect(page.locator(".mr-page aside")).toContainText("4.0 / 5");
  await nav(page, "morrow", 21);
  await expect(
    page.getByRole("button", { name: "导出售后 TXT" }),
  ).toBeDisabled();
  await page
    .getByLabel("售后问题与期望")
    .fill("需要向真实商家确认研磨方式与包装说明。");
  expect((await file(page, "导出售后 TXT")).toString()).toContain(
    "未发送、未受理、未退款、未鉴定",
  );
});
