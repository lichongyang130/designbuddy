import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
const nav = (page: Page, i: number) =>
  page
    .getByRole("navigation", { name: "ATELIER 页面目录" })
    .getByRole("button")
    .nth(i)
    .click();
const key = "designbuddy.samples.v2.atelier.sample";
async function file(page: Page, name: string) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name, exact: true }).click();
  return readFile((await (await pending).path())!);
}
test("ATELIER is a distinct 24-page work with five dedicated loaded images", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/inspiration");
  await page
    .getByRole("textbox", { name: "搜索作品", exact: true })
    .fill("ATELIER");
  await expect(page.locator(".sample-card")).toHaveCount(1);
  await page.locator(".sample-card>button").click();
  await expect(page).toHaveURL(/\/atelier$/);
  await expect(
    page
      .getByRole("navigation", { name: "ATELIER 页面目录" })
      .getByRole("button"),
  ).toHaveCount(24);
  const headings = new Set<string>();
  for (let i = 0; i < 24; i++) {
    await nav(page, i);
    headings.add(await page.locator(".at-page h1").innerText());
    expect((await page.locator(".at-page").innerText()).length).toBeGreaterThan(
      100,
    );
  }
  expect(headings.size).toBe(24);
  for (const i of [0, 3, 13, 15, 21]) {
    await nav(page, i);
    await expect
      .poll(() =>
        page
          .locator(".at-page img")
          .evaluateAll((imgs) =>
            imgs.every(
              (img) =>
                (img as HTMLImageElement).complete &&
                (img as HTMLImageElement).naturalWidth > 400,
            ),
          ),
      )
      .toBe(true);
  }
  expect(errors).toEqual([]);
});
test("configuration changes real quote math, drawings and persists after refresh", async ({
  page,
}) => {
  await page.goto("/inspiration/atelier");
  await nav(page, 3);
  await page.getByRole("button", { name: "选用羊毛羊绒", exact: true }).click();
  await nav(page, 5);
  await page.getByRole("button", { name: "青果领", exact: true }).click();
  await nav(page, 7);
  await page.getByLabel("绣字内容（最多 12 字符）").fill("CY");
  await nav(page, 17);
  await page.getByLabel("套装件数").fill("2");
  await page.getByLabel("示例折扣百分比").fill("10");
  await expect(page.getByTestId("atelier-total")).toHaveText("¥10,494.00");
  await page.reload();
  await expect(page.getByTestId("atelier-total")).toHaveText("¥10,494.00");
  const csv = (await file(page, "下载费用 CSV")).toString("utf8");
  expect(csv).toContain("10494");
  expect(csv).toContain("羊毛羊绒");
  await nav(page, 4);
  await page.getByRole("button", { name: /酒红/ }).click();
  await expect(page.locator(".at-technical svg path").first()).toHaveAttribute(
    "d",
    /M/,
  );
  await expect(page.locator(".at-technical svg g").first()).toHaveAttribute(
    "fill",
    "#75252d",
  );
});
test("measurement and contact checks gate snapshots; frozen receipt and sequential production remain honest", async ({
  page,
}) => {
  await page.goto("/inspiration/atelier");
  await nav(page, 19);
  await expect(
    page.getByRole("button", { name: "生成本地演示单", exact: true }),
  ).toBeDisabled();
  await nav(page, 9);
  await page.getByLabel("胸围（cm）", { exact: true }).fill("10");
  await expect(page.getByText("请复核这个数值")).toBeVisible();
  await page.getByLabel("胸围（cm）", { exact: true }).fill("94");
  await page.getByRole("checkbox").check();
  await nav(page, 16);
  await page.getByLabel("客户称呼").fill("示例客户");
  await page.getByLabel("联系邮箱或电话").fill("atelier@example.test");
  await page.getByRole("checkbox").check();
  await nav(page, 19);
  await page
    .getByRole("button", { name: "生成本地演示单", exact: true })
    .click();
  await expect(page.locator(".at-receipt")).toContainText("LOCAL-");
  await expect(page.locator(".at-receipt")).toContainText("¥4,409.60");
  await nav(page, 17);
  await page.getByLabel("套装件数").fill("2");
  await nav(page, 19);
  await expect(page.locator(".at-receipt")).toContainText("¥4,409.60");
  await expect(page.locator(".at-receipt")).toContainText("1 件");
  await nav(page, 20);
  await expect(
    page.getByRole("button", { name: "标记完成：裁片准备" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "标记完成：规格复核" }).click();
  await expect(
    page.getByRole("button", { name: "标记完成：裁片准备" }),
  ).toBeEnabled();
  await nav(page, 19);
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "取消本地演示单", exact: true })
    .click();
  await nav(page, 20);
  await expect(
    page.getByRole("button", { name: "标记完成：裁片准备" }),
  ).toBeDisabled();
  await page.reload();
  await expect(page.locator(".at-page")).toContainText("已取消，进度冻结");
});
test("undo, redo, named versions and independent copies restore actual state", async ({
  page,
}) => {
  await page.goto("/inspiration/atelier");
  await nav(page, 1);
  await page.getByLabel("项目名称", { exact: true }).fill("秋日个人档案");
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(page.getByLabel("项目名称", { exact: true })).toHaveValue(
    "属于自己的第一套西装",
  );
  await page.getByRole("button", { name: "重做", exact: true }).click();
  await page.getByLabel("版本名称", { exact: true }).fill("第一次沟通");
  await page.getByRole("button", { name: "保存版本", exact: true }).click();
  await page.getByLabel("项目名称", { exact: true }).fill("临时修改");
  page.once("dialog", (d) => d.accept());
  await page.getByLabel("恢复命名版本", { exact: true }).selectOption("0");
  await expect(page.getByLabel("项目名称", { exact: true })).toHaveValue(
    "秋日个人档案",
  );
  await page.getByRole("button", { name: /做同款/ }).click();
  await expect(page).toHaveURL(/atelier\/draft\//);
  await expect(page.getByLabel("恢复命名版本")).toContainText("0/6");
  await page.getByLabel("项目名称", { exact: true }).fill("独立副本");
  await page.goto("/inspiration/atelier");
  await nav(page, 1);
  await expect(page.getByLabel("项目名称", { exact: true })).toHaveValue(
    "秋日个人档案",
  );
});
test("ease, layout coordinates, date arithmetic, intention and fitting records have real behavior", async ({
  page,
}) => {
  await page.goto("/inspiration/atelier");
  await nav(page, 10);
  await page.getByLabel("胸部松量").fill("14");
  await expect(page.locator(".at-ease").first()).toContainText("106");
  await nav(page, 12);
  await page.getByLabel("水平位置").fill("160");
  await expect(page.locator(".at-board svg g").first()).toHaveAttribute(
    "transform",
    "translate(160 80)",
  );
  await nav(page, 13);
  await page.getByRole("button", { name: "全麻衬", exact: true }).click();
  await page.getByRole("checkbox").check();
  await nav(page, 14);
  await expect(page.locator(".at-page")).toContainText("2026-12-10");
  await page.getByLabel("希望交付日期").fill("2026-11-10");
  await expect(page.locator(".at-warning")).toContainText("存在交期风险");
  await nav(page, 15);
  await page.getByRole("button", { name: "保存试衣意向", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("未预约");
  await nav(page, 18);
  await page
    .getByLabel("本次试衣观察")
    .fill("坐姿腰部舒适，袖长需要配合衬衫复核。");
  await page.getByRole("button", { name: "保存试衣记录", exact: true }).click();
  await page.reload();
  await expect(page.locator(".at-card")).toContainText("袖长需要配合衬衫复核");
});
test("JSON restore and text export validate input without fake submission", async ({
  page,
}) => {
  await page.goto("/inspiration/atelier");
  await nav(page, 1);
  await page.getByLabel("项目名称", { exact: true }).fill("=1+1");
  await nav(page, 23);
  const json = await file(page, "导出项目 JSON");
  expect(JSON.parse(json.toString()).format).toBe("atelier-project-v1");
  const csv = (await file(page, "下载费用 CSV")).toString();
  expect(csv).toContain("'=1+1");
  await page.getByLabel("从项目 JSON 恢复").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"format":"other"}'),
  });
  await expect(page.getByRole("status")).toContainText("不是 ATELIER");
  await nav(page, 1);
  await page.getByLabel("项目名称", { exact: true }).fill("改过的名称");
  await nav(page, 23);
  page.once("dialog", (d) => d.accept());
  await page.getByLabel("从项目 JSON 恢复").setInputFiles({
    name: "project.json",
    mimeType: "application/json",
    buffer: json,
  });
  await nav(page, 1);
  await expect(page.getByLabel("项目名称", { exact: true })).toHaveValue(
    "=1+1",
  );
  await nav(page, 22);
  await page
    .getByRole("button", { name: "导出改衣沟通单", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("至少填写 10");
  await page
    .getByLabel("问题与期望调整")
    .fill("行走时裤脚偏长，希望配合常穿皮鞋复核。");
  expect((await file(page, "导出改衣沟通单")).toString()).toContain(
    "未发送、未受理",
  );
});
test("SVG and 24-chapter HTML embed images/fonts and run offline with escaped user text", async ({
  page,
  context,
}) => {
  test.setTimeout(90000);
  await page.goto("/inspiration/atelier");
  await nav(page, 1);
  await page
    .getByLabel("项目名称", { exact: true })
    .fill("中文 <script>bad</script> 档案");
  await nav(page, 7);
  await page.getByLabel("绣字内容（最多 12 字符）").fill("CY & <tag>");
  await nav(page, 23);
  const svg = (await file(page, "下载技术 SVG")).toString();
  expect(svg).toContain("CY &amp; &lt;tag&gt;");
  expect(svg).toContain("data:font/woff2");
  const html = (await file(page, "导出独立方案 HTML")).toString();
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
  await offline.goto("http://offline.example.test/atelier");
  await offline.evaluate(() => document.fonts.ready);
  expect(
    await offline
      .locator("img")
      .evaluateAll((imgs) =>
        imgs.every(
          (img) =>
            (img as HTMLImageElement).complete &&
            (img as HTMLImageElement).naturalWidth > 0,
        ),
      ),
  ).toBe(true);
  await expect(offline.locator("section")).toHaveCount(24);
  await expect(offline.locator("header h1")).toContainText(
    "<script>bad</script>",
  );
  await offline
    .getByRole("link", { name: "12. 技术规格", exact: true })
    .click();
  await expect(offline).toHaveURL(/#p11$/);
  await offline.screenshot({ path: "../../.cache/atelier/offline.png" });
  await offline.close();
});
test("corrupt state is bounded and storage failure prevents a false saved copy", async ({
  page,
}) => {
  await page.addInitScript(
    ({ key }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          page: 999,
          measures: { chest: -4 },
          order: { id: "fake", total: -1 },
          board: [[NaN, 0]],
          start: "2026-02-31",
        }),
      );
    },
    { key },
  );
  await page.goto("/inspiration/atelier");
  await expect(page.locator(".at-page")).toHaveAttribute("data-page", "0");
  await nav(page, 9);
  await expect(page.getByLabel("胸围（cm）", { exact: true })).toHaveValue(
    "92",
  );
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("quota", "QuotaExceededError");
    };
  });
  await page.getByLabel("胸围（cm）", { exact: true }).fill("95");
  await expect(page.getByRole("status")).toContainText("浏览器存储不可用");
  await page.getByRole("button", { name: /做同款/ }).click();
  await expect(page).toHaveURL(/\/atelier$/);
  await nav(page, 23);
  const saved = JSON.parse((await file(page, "导出项目 JSON")).toString());
  expect(saved.state.measures.chest).toBe(95);
});
for (const width of [320, 375, 768, 1440])
  test(`all 24 ATELIER pages fit ${width}px without outer horizontal overflow`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/inspiration/atelier");
    for (let i = 0; i < 24; i++) {
      await nav(page, i);
      await expect(page.locator(".at-page")).toHaveAttribute(
        "data-page",
        String(i),
      );
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        `page ${i + 1}`,
      ).toBeLessThanOrEqual(width);
    }
    await nav(page, 11);
    await page.screenshot({
      path: `../../.cache/atelier/technical-${width}.png`,
      fullPage: true,
    });
  });

test("ATELIER snapshots survive account login and restore in a separate browser", async ({
  page,
  browser,
}) => {
  const username = "atelier_" + crypto.randomUUID().slice(0, 8),
    password = "atelier-test-only-2026";
  async function login(p: Page, register: boolean) {
    await p.getByRole("button", { name: "工作区状态", exact: true }).click();
    const dialog = p.getByRole("dialog", { name: "后台连接与账号" });
    await dialog.getByLabel("服务器用户名").fill(username);
    await dialog.getByLabel("服务器密码").fill(password);
    await dialog
      .getByRole("button", {
        name: register ? "注册并保留访客数据" : "登录账号",
        exact: true,
      })
      .click();
    await expect(
      dialog.getByRole("button", { name: "退出服务器账号" }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "关闭服务器窗口" }).click();
  }
  await page.goto("/inspiration/atelier");
  await login(page, true);
  await nav(page, 1);
  await page.getByLabel("项目名称", { exact: true }).fill("跨浏览器订制档案");
  await nav(page, 9);
  await page.getByLabel("胸围（cm）", { exact: true }).fill("96");
  await page.getByRole("button", { name: "保存到服务器", exact: true }).click();
  await expect(page.locator(".template-cloud")).toContainText("已保存到服务器");
  const second = await browser.newContext();
  try {
    const other = await second.newPage();
    await other.goto("http://127.0.0.1:5173/inspiration");
    await login(other, false);
    await other
      .getByRole("button", { name: "服务器作品", exact: true })
      .click();
    const library = other.getByRole("dialog", { name: "服务器作品" });
    await expect(library).toContainText("ATELIER");
    other.once("dialog", (d) => d.accept());
    await library
      .getByRole("button", { name: "恢复并打开", exact: true })
      .click();
    await expect(other).toHaveURL(/\/atelier$/);
    await expect(other.getByLabel("胸围（cm）", { exact: true })).toHaveValue(
      "96",
    );
    await nav(other, 1);
    await expect(other.getByLabel("项目名称", { exact: true })).toHaveValue(
      "跨浏览器订制档案",
    );
  } finally {
    await second.close();
  }
});
