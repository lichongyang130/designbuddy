import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
const configs = [
  {
    id: "roots",
    prefix: "rt",
    title: "ROOTS",
    field: "花园项目名称",
    initial: "一米之外的小花园",
    json: "导出项目 JSON",
    csv: "导出预算 CSV",
    svg: "下载平面 SVG",
    html: "导出离线方案 HTML",
    upload: "恢复项目 JSON",
    images: [0, 4, 6, 17, 19],
  },
  {
    id: "daylight",
    prefix: "dl",
    title: "DAYLIGHT",
    field: "项目名称",
    initial: "明亮的一周",
    json: "项目 JSON",
    csv: "预约 CSV",
    svg: "座位 SVG",
    html: "24 章离线 HTML",
    upload: "导入 DAYLIGHT 项目",
    images: [0, 4, 5, 6, 13],
  },
] as const;
type Id = (typeof configs)[number]["id"];
const nav = async (page: Page, id: Id, n: number) => {
  if (id === "roots")
    await page
      .getByRole("navigation", { name: "ROOTS 页面目录" })
      .getByRole("button")
      .nth(n)
      .click();
  else await page.getByLabel("DAYLIGHT 页面目录").selectOption(String(n));
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

test("ROOTS: geometric volume, bag rounding, rainfall cap, budget and refresh are connected", async ({
  page,
}) => {
  await page.goto("/inspiration/roots");
  await nav(page, "roots", 10);
  await page.getByLabel("种植床宽（m）").fill("3");
  await expect(page.locator(".rt-stat")).toContainText("900 L");
  await nav(page, "roots", 11);
  await page.getByLabel("容器数量").fill("0");
  await nav(page, "roots", 12);
  await page.getByLabel("每袋容量（L）").fill("40");
  await expect(page.locator(".rt-stat").nth(0)).toContainText("900 L");
  await expect(page.locator(".rt-stat").nth(1)).toContainText("23 袋");
  await expect(page.locator(".rt-stat").nth(2)).toContainText("630 kg");
  await nav(page, "roots", 14);
  await page.getByLabel("集水面（m²）").fill("10");
  await page.getByLabel("情景降雨（mm）").fill("20");
  await page.getByLabel("收集效率（%）").fill("50");
  await page.getByLabel("储水桶容量（L）").fill("60");
  await expect(page.locator(".rt-rain")).toContainText("60 L");
  await nav(page, "roots", 20);
  const total = await page.locator(".rt-total strong").innerText();
  await page.reload();
  await expect(page.locator(".rt-total strong")).toHaveText(total);
  const csv = (await file(page, "导出预算 CSV")).toString();
  expect(csv).toContain('"基质 / 40 L","23","56","1288"');
});
test("ROOTS: plant filter, coordinates, light mismatch, frozen review and sequential phases", async ({
  page,
}) => {
  await page.goto("/inspiration/roots");
  await nav(page, "roots", 5);
  await page.getByLabel("植物光照筛选").selectOption("2");
  await expect(page.locator(".rt-cards .rt-card")).toHaveCount(3);
  await page.getByRole("button", { name: "研究肾蕨 →", exact: true }).click();
  await expect(page.locator(".rt-page")).toHaveAttribute("data-page", "6");
  await nav(page, "roots", 9);
  await page.getByLabel("水平坐标（cm）").fill("140");
  await expect(
    page.locator('.rt-plan svg g[transform="translate(140 210)"]'),
  ).toHaveCount(1);
  await nav(page, "roots", 3);
  await page.getByLabel("观察到的直射日照（小时）").fill("0");
  await nav(page, "roots", 8);
  await expect(page.locator(".rt-cards .is-warning")).toHaveCount(2);
  await nav(page, "roots", 22);
  await expect(
    page.getByRole("button", { name: "确认本地方案快照" }),
  ).toBeDisabled();
  await page.getByLabel("评审人称呼").fill("本地讨论人");
  await page.getByRole("button", { name: "确认本地方案快照" }).click();
  const frozen = await page.locator(".rt-paper strong").innerText();
  await nav(page, "roots", 7);
  await page.getByLabel("迷迭香数量").fill("10");
  await nav(page, "roots", 22);
  await expect(page.locator(".rt-paper strong")).toHaveText(frozen);
  await expect(page.locator(".rt-paper")).toContainText("迷迭香×2");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "撤回评审" }).click();
  await expect(page.locator(".rt-paper")).toContainText("已撤回");
  await nav(page, "roots", 21);
  await expect(
    page.locator(".rt-phases li").nth(1).getByRole("button"),
  ).toBeDisabled();
  await page.locator(".rt-phases li").nth(0).getByRole("button").click();
  await expect(
    page.locator(".rt-phases li").nth(1).getByRole("button"),
  ).toBeEnabled();
});
test("ROOTS: care log retains an independent observation and checklist", async ({
  page,
}) => {
  await page.goto("/inspiration/roots");
  await nav(page, "roots", 19);
  await page.getByLabel("检查排水出口").check();
  await page.getByLabel("本次养护观察").fill("雨后观察盆底出口，排水通畅。");
  await page.getByRole("button", { name: "保存养护记录" }).click();
  await page.getByLabel("本次养护观察").fill("暂时还未保存的文字");
  await page.getByLabel("检查排水出口").uncheck();
  await page.reload();
  await expect(page.locator(".rt-card")).toContainText("雨后观察盆底出口");
  await expect(page.locator(".rt-card")).toContainText("检查 1/4");
});

test("DAYLIGHT: shared capacity and independent rooms enforce real half-hour conflicts; cancellation releases capacity", async ({
  page,
}) => {
  await page.goto("/inspiration/daylight");
  await nav(page, "daylight", 4);
  await page.getByLabel("预约主题", { exact: true }).fill("八人专注");
  await page.getByLabel("参与人数", { exact: true }).fill("8");
  await page.getByRole("button", { name: "保存本地预约", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "保存本地预约", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("参与人数", { exact: true }).fill("4");
  await expect(
    page.getByRole("button", { name: "保存本地预约", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "保存本地预约", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "保存本地预约", exact: true }),
  ).toBeDisabled();
  await nav(page, "daylight", 5);
  await page.getByLabel("预约主题", { exact: true }).fill("独占讨论");
  await page.getByRole("button", { name: "保存本地预约", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "保存本地预约", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("开始时间", { exact: true }).fill("10:00");
  await expect(
    page.getByRole("button", { name: "保存本地预约", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("开始时间", { exact: true }).fill("19:30");
  await expect(
    page.getByRole("button", { name: "保存本地预约", exact: true }),
  ).toBeDisabled();
  await nav(page, "daylight", 10);
  await expect(page.locator(".dl-booking-list article")).toHaveCount(3);
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "取消预约 独占讨论", exact: true })
    .click();
  await nav(page, "daylight", 5);
  await page.getByLabel("开始时间", { exact: true }).fill("09:00");
  await expect(
    page.getByRole("button", { name: "保存本地预约", exact: true }),
  ).toBeEnabled();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "保存本地预约", exact: true }),
  ).toBeEnabled();
});
test("DAYLIGHT: booking fees, service quantities, explicit pass mode and frozen invoice do not double charge", async ({
  page,
}) => {
  await page.goto("/inspiration/daylight");
  await nav(page, "daylight", 5);
  await page.getByRole("button", { name: "保存本地预约", exact: true }).click();
  await nav(page, "daylight", 13);
  await page.getByLabel("咖啡需求（杯）").fill("2");
  await page.getByLabel("黑白打印（页）").fill("10");
  await page.getByLabel("储物柜使用（日）").fill("1");
  await nav(page, "daylight", 11);
  await expect(page.getByTestId("daylight-total")).toHaveText("¥237.44");
  await nav(page, "daylight", 22);
  await page.getByRole("button", { name: "冻结费用快照" }).click();
  await expect(page.locator(".dl-invoice>strong")).toHaveText("¥237.44");
  await nav(page, "daylight", 7);
  await page.getByRole("button", { name: "选择人日通行" }).click();
  await page.getByLabel("计划团队人数").fill("2");
  await page.getByLabel("计划天数").fill("3");
  await nav(page, "daylight", 11);
  await page.getByLabel("费用计费口径").selectOption("1");
  await expect(page.getByTestId("daylight-total")).toHaveText("¥1,212.64");
  await nav(page, "daylight", 22);
  await expect(page.locator(".dl-invoice>strong")).toHaveText("¥237.44");
  await page.reload();
  await expect(page.locator(".dl-invoice>strong")).toHaveText("¥237.44");
});
test("DAYLIGHT: team seating is unique, occupied seats protected, member removal clears dependent guests", async ({
  page,
}) => {
  await page.goto("/inspiration/daylight");
  await nav(page, "daylight", 9);
  await page.getByRole("button", { name: "座位 2 阿青", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已有成员");
  await page.getByRole("button", { name: "座位 4 空位", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "座位 1 空位", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "座位 4 小林", exact: true }),
  ).toBeVisible();
  await nav(page, "daylight", 18);
  await page.getByLabel("访客称呼").fill("访客甲");
  await page.getByRole("button", { name: "保存访客计划" }).click();
  await expect(page.locator(".dl-note")).toContainText("访客甲");
  await nav(page, "daylight", 8);
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "移除成员 小林", exact: true })
    .click();
  await nav(page, "daylight", 9);
  await expect(
    page.getByRole("button", { name: "座位 4 空位", exact: true }),
  ).toBeVisible();
  await nav(page, "daylight", 18);
  await expect(page.locator(".dl-note")).toHaveCount(0);
});
test("DAYLIGHT: local check-in, activity capacity, helpdesk and feedback disclose actual scope", async ({
  page,
}) => {
  await page.goto("/inspiration/daylight");
  await nav(page, "daylight", 6);
  await page.getByLabel("耳机监听").check();
  await page.getByRole("button", { name: "保存本地预约", exact: true }).click();
  await nav(page, "daylight", 12);
  await page.getByRole("button", { name: "记录本地签到" }).click();
  await expect(page.getByRole("button", { name: "本地已签到" })).toBeDisabled();
  await nav(page, "daylight", 14);
  await page.getByRole("button", { name: "选择这个活动" }).nth(1).click();
  await page.getByLabel("活动意向人数").fill("9");
  await expect(
    page.getByRole("button", { name: "保存活动意向" }),
  ).toBeDisabled();
  await page.getByLabel("活动意向人数").fill("8");
  await page.getByRole("button", { name: "保存活动意向" }).click();
  await expect(page.getByRole("status")).toContainText("没有真实报名");
  await nav(page, "daylight", 17);
  await page.getByRole("button", { name: "保存本地工单" }).click();
  await expect(page.getByRole("status")).toContainText("至少填写 8");
  await page
    .getByLabel("问题描述")
    .fill("会议室投影接口接触不稳定，需要现场复核。");
  await page.getByRole("button", { name: "保存本地工单" }).click();
  await expect(page.getByRole("status")).toContainText("未发送");
  await page.getByRole("button", { name: "手动标记完成" }).click();
  await nav(page, "daylight", 21);
  await page
    .getByLabel("体验说明")
    .fill("安静区域适合阅读，讨论仍需单独预约。");
  await page.getByRole("button", { name: "保存个人体验" }).click();
  await page.reload();
  await expect(page.locator(".dl-page aside")).toContainText("4.0 / 5");
  await nav(page, "daylight", 17);
  await expect(page.locator(".dl-note")).toContainText("手动完成");
});
test("DAYLIGHT: real timestamp timer survives refresh and energy uses power × time", async ({
  page,
}) => {
  await page.goto("/inspiration/daylight");
  await page.clock.install();
  await nav(page, "daylight", 16);
  await page.getByLabel("专注时长（分钟）").fill("1");
  await page.getByRole("button", { name: "开始专注" }).click();
  const deadline = await page.evaluate(
    () =>
      JSON.parse(
        localStorage.getItem("designbuddy.samples.v2.daylight.sample")!,
      ).focusEnd,
  );
  await page.clock.fastForward(10000);
  await expect(page.locator(".dl-timer strong")).toHaveText(/00:[45]\d/);
  await page.reload();
  await expect(page.locator(".dl-timer strong")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(
          localStorage.getItem("designbuddy.samples.v2.daylight.sample")!,
        ).focusEnd,
    ),
  ).toBe(deadline);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const [m, sec] = document
          .querySelector(".dl-timer strong")!
          .textContent!.split(":")
          .map(Number);
        const end = JSON.parse(
          localStorage.getItem("designbuddy.samples.v2.daylight.sample")!,
        ).focusEnd;
        return Math.abs(
          m * 60 + sec - Math.max(0, Math.ceil((end - Date.now()) / 1000)),
        );
      }),
    )
    .toBeLessThanOrEqual(1);
  await page.clock.fastForward(60000);
  await expect(page.locator(".dl-timer")).toContainText("已到时间");
  await page.getByRole("button", { name: "停止计时" }).click();
  await expect(page.locator(".dl-timer strong")).toHaveText("1:00");
  await nav(page, "daylight", 20);
  await page.getByLabel("设备数量").fill("4");
  await page.getByLabel("单设备功率（W）").fill("100");
  await page.getByLabel("使用时间（h）").fill("5");
  await page.getByLabel("照明负荷（W）").fill("200");
  await expect(page.locator(".dl-stat").first()).toContainText("3 kWh");
  await expect(page.locator(".dl-stat").nth(1)).toContainText("¥3.60");
});
test("DAYLIGHT: ICS timezone, escaping, UTF-8 folding, stable UID and cancellation are real", async ({
  page,
}) => {
  await page.goto("/inspiration/daylight");
  await nav(page, "daylight", 5);
  await page
    .getByLabel("预约主题", { exact: true })
    .fill("中文讨论，会议;内容" + "长标题".repeat(18));
  await page.getByRole("button", { name: "保存本地预约", exact: true }).click();
  await nav(page, "daylight", 15);
  await expect(page.locator(".dl-agenda article")).toHaveCount(1);
  const first = (await file(page, "导出东京时区 ICS")).toString();
  expect(first).toContain("BEGIN:VCALENDAR\r\nVERSION:2.0");
  expect(first).toContain("DTSTART;TZID=Asia/Tokyo:20261102T090000");
  expect(first).toContain("DTEND;TZID=Asia/Tokyo:20261102T100000");
  expect(first).toContain("TZID:Asia/Tokyo");
  expect(first).toContain("会议\\;内容");
  expect(first).toContain("\r\n ");
  for (const line of first.split("\r\n"))
    expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
  const second = (await file(page, "导出东京时区 ICS")).toString();
  expect(second.match(/UID:(.+)/)?.[1]).toBe(first.match(/UID:(.+)/)?.[1]);
  await nav(page, "daylight", 10);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /取消预约 / }).click();
  await nav(page, "daylight", 15);
  expect((await file(page, "导出东京时区 ICS")).toString()).not.toContain(
    "BEGIN:VEVENT",
  );
});
