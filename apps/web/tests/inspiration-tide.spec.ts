import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
const configs = [
  {
    id: "tide",
    prefix: "td",
    title: "TIDE",
    field: "项目名称",
    initial: "海风相聚计划",
    json: "项目 JSON",
    csv: "费用 CSV",
    svg: "示意 SVG",
    html: "24 章离线 HTML",
    upload: "导入 TIDE 项目",
    images: [0, 4, 11, 18, 17],
  },
] as const;
type Id = "tide";
const nav = async (page: Page, _id: Id, n: number) => {
  await page
    .getByRole("navigation", { name: "TIDE 页面目录" })
    .getByRole("button")
    .nth(n)
    .click();
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
      await nav(page, c.id, 8);
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

async function member(page: Page) {
  await nav(page, "tide", 3);
  await page.getByLabel("会员称呼", { exact: true }).fill("本地讨论人");
  await nav(page, "tide", 6);
  await page.getByLabel("我知道这只是本地意向，不是出航批准").check();
}
test("TIDE: booking guards, overlapping boats, monthly quota and cancellation are real", async ({
  page,
}) => {
  await page.goto("/inspiration/tide");
  await nav(page, "tide", 6);
  await expect(
    page.getByRole("button", { name: "保存时间意向" }),
  ).toBeDisabled();
  await member(page);
  await page.getByRole("button", { name: "保存时间意向" }).click();
  await expect(
    page.getByRole("button", { name: "保存时间意向" }),
  ).toBeDisabled();
  await expect(page.locator(".td-warning")).toContainText("重叠");
  await page.getByLabel("开始时间", { exact: true }).fill("11:00");
  await page.getByRole("button", { name: "保存时间意向" }).click();
  await page.getByLabel("开始时间", { exact: true }).fill("13:00");
  await page.getByRole("button", { name: "保存时间意向" }).click();
  await page.getByLabel("意向日期", { exact: true }).fill("2026-11-08");
  await expect(
    page.getByRole("button", { name: "保存时间意向" }),
  ).toBeDisabled();
  await expect(page.locator(".td-warning")).toContainText("时数超出");
  await page.getByLabel("意向日期", { exact: true }).fill("2026-12-08");
  await expect(
    page.getByRole("button", { name: "保存时间意向" }),
  ).toBeEnabled();
  await page.getByLabel("开始时间", { exact: true }).fill("17:00");
  await expect(
    page.getByRole("button", { name: "保存时间意向" }),
  ).toBeDisabled();
  await nav(page, "tide", 15);
  await expect(page.locator(".td-stat").nth(1)).toContainText("6 h");
  await expect(page.locator(".td-stat").nth(2)).toContainText("0 h");
  await nav(page, "tide", 13);
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "取消意向 周末学习意向" })
    .first()
    .click();
  await nav(page, "tide", 15);
  await expect(page.locator(".td-stat").nth(2)).toContainText("2 h");
  await page.reload();
  await expect(page.locator(".td-stat").nth(1)).toContainText("4 h");
});
test("TIDE: monthly charges, resources and frozen discussion do not mutate together", async ({
  page,
}) => {
  await page.goto("/inspiration/tide");
  await member(page);
  await page.getByRole("button", { name: "保存时间意向" }).click();
  await nav(page, "tide", 19);
  await page.getByLabel("清洁袋物料（个）").fill("3");
  await page.getByLabel("手套物料（双）").fill("2");
  await nav(page, "tide", 20);
  await expect(page.getByTestId("tide-total")).toHaveText("¥1,680.10");
  await nav(page, "tide", 22);
  await page.getByRole("button", { name: "冻结本地讨论稿" }).click();
  await expect(page.locator(".td-review strong")).toHaveText("¥1,680.10");
  await nav(page, "tide", 2);
  await page.getByRole("button", { name: "选择Coast / 常行" }).click();
  await nav(page, "tide", 20);
  await expect(page.getByTestId("tide-total")).toHaveText("¥2,210.10");
  await page.getByLabel("核算月份", { exact: true }).fill("2026-12");
  await expect(page.getByTestId("tide-total")).toHaveText("¥1,277.30");
  await nav(page, "tide", 22);
  await expect(
    page.getByRole("button", { name: "冻结本地讨论稿" }),
  ).toBeDisabled();
  await expect(page.locator(".td-review strong")).toHaveText("¥1,680.10");
  await expect(page.locator(".td-review")).toContainText("2026-11");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "撤回讨论稿" }).click();
  await page.reload();
  await expect(page.locator(".td-review")).toContainText("本地已撤回");
});
test("TIDE: non-geographic diagram coordinates, distances and manual conditions respond without navigation claims", async ({
  page,
}) => {
  await page.goto("/inspiration/tide");
  await nav(page, "tide", 8);
  await expect(page.locator(".td-stat").first()).toContainText("7 NM");
  await expect(page.locator(".td-stat").first()).toContainText("12.96 km");
  await expect(page.locator(".td-stat").nth(1)).toContainText("105 min");
  await page.getByLabel("算术参考速度（kn）").fill("7");
  await expect(page.locator(".td-stat").nth(1)).toContainText("60 min");
  await page.getByLabel("横向示意位置").fill("50");
  await expect(page.locator(".td-chart svg g").first()).toHaveAttribute(
    "transform",
    "translate(320 272)",
  );
  await nav(page, "tide", 9);
  await page.getByLabel("手填风速（kn）").fill("0");
  await page
    .getByLabel("观测来源与时间")
    .fill("仅用于计划讨论，未核对官方资料");
  await expect(page.locator(".td-weather")).toContainText("不提供安全可航结论");
  await page.reload();
  await expect(page.getByLabel("手填风速（kn）")).toHaveValue("0");
});
test("TIDE: sequential learning, independent logs and weighted pace are not certification", async ({
  page,
}) => {
  await page.goto("/inspiration/tide");
  await nav(page, "tide", 11);
  await expect(
    page.locator(".td-course li").nth(1).getByRole("button"),
  ).toBeDisabled();
  await page.locator(".td-course li").nth(0).getByRole("button").click();
  await expect(
    page.locator(".td-course li").nth(1).getByRole("button"),
  ).toBeEnabled();
  await nav(page, "tide", 12);
  await page
    .getByLabel("本次学习笔记")
    .fill("下次向实际教练询问现场准备要求。");
  await page.getByRole("button", { name: "保存学习笔记" }).click();
  await page.getByLabel("本次学习笔记").fill("还未保存的不同文字");
  await page.reload();
  await expect(page.locator(".td-note")).toContainText("下次向实际教练");
  await nav(page, "tide", 14);
  await page
    .getByLabel("航行观察", { exact: true })
    .fill("手工计时记录，距离来自个人记录而非 GPS。");
  await page.getByRole("button", { name: "保存手动航行日志" }).click();
  await expect(page.locator(".td-note")).toContainText("7 NM / 120 min");
  await expect(page.locator(".td-note")).toContainText("3.5 kn");
  await nav(page, "tide", 16);
  await page.getByRole("button", { name: "记录个人练习" }).click();
  await page.getByLabel("练习距离（海里）").fill("3");
  await page.getByLabel("练习用时（分钟）").fill("90");
  await page.getByRole("button", { name: "记录个人练习" }).click();
  await expect(page.locator(".td-note h3")).toHaveText("整体 2.5 kn");
  await nav(page, "tide", 15);
  await expect(page.locator(".td-stat").nth(1)).toContainText("0 h");
});
test("TIDE: crew, event bounds, maintenance notes, equipment and unverified contact TXT work locally", async ({
  page,
}) => {
  await page.goto("/inspiration/tide");
  await nav(page, "tide", 7);
  await page.getByLabel("同行者称呼").fill("新增观察者");
  await page.getByRole("button", { name: "添加同行者" }).click();
  await expect(page.locator(".td-list article")).toHaveCount(3);
  await nav(page, "tide", 17);
  await page.getByRole("button", { name: "选择航海书籍圆桌" }).click();
  await page.getByLabel("活动意向人数").fill("9");
  await expect(
    page.getByRole("button", { name: "保存岸上活动意向" }),
  ).toBeDisabled();
  await page.getByLabel("活动意向人数").fill("8");
  await page.getByRole("button", { name: "保存岸上活动意向" }).click();
  await expect(page.getByRole("status")).toContainText("未报名");
  await nav(page, "tide", 18);
  await page
    .getByLabel("维护观察说明")
    .fill("观察到绳索外观存在磨损线索，待专业人员复核。");
  await page.getByRole("button", { name: "保存维护观察" }).click();
  await expect(page.getByRole("status")).toContainText("未报修");
  await page.getByRole("button", { name: "仅关闭个人跟踪" }).click();
  await expect(page.locator(".td-note")).toContainText("不表示技师已维修");
  await nav(page, "tide", 10);
  await page.getByRole("checkbox").first().check();
  await nav(page, "tide", 21);
  await expect(
    page.getByRole("button", { name: "导出联络 TXT" }),
  ).toBeDisabled();
  await page.getByLabel("适用地区与场地").fill("示例地区，未核验");
  await page
    .getByLabel("真实场地联系人（自行核验）")
    .fill("请填写现场实际联系人");
  await page
    .getByLabel("当地应急联络信息（自行核验）")
    .fill("请核实当地实际应急渠道");
  const txt = (await file(page, "导出联络 TXT")).toString();
  expect(txt).toContain("未核验号码、未拨号、未发送求救或定位");
  await page.reload();
  await expect(page.getByLabel("适用地区与场地")).toHaveValue(
    "示例地区，未核验",
  );
});
