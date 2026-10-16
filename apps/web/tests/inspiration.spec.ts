import { test, expect, type Page, type Download } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { unzipSync, strFromU8 } from "fflate";

const ids = ["travel", "luma", "research", "chishan"];
const shells = [".roam-site", ".deck-stage", ".report-pages", ".brand-canvas"];
async function file(download: Download) {
  return readFile((await download.path())!);
}
async function exportFile(page: Page, name: string) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name, exact: true }).click();
  return file(await pending);
}
async function travelPage(page: Page, index: number) {
  await page
    .getByRole("combobox", { name: "浏览业务页面" })
    .selectOption(String(index));
  await expect(page.locator(".roam-site")).toHaveAttribute(
    "data-travel-page",
    String(index),
  );
}

test("community preserves eight original works and adds five playable media samples", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/inspiration");
  await expect(page.locator(".sample-card")).toHaveCount(19);
  for (const selector of [
    ".travel-cover",
    ".luma-slide",
    ".report-paper",
    ".brand-artwork",
  ])
    await expect(page.locator(".sample-preview " + selector)).toHaveCount(
      selector === ".travel-cover" ? 1 : 2,
    );
  expect(
    await page
      .locator(".samples-grid")
      .evaluate(
        (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
      ),
  ).toBe(3);
  for (const category of ["原型", "幻灯片", "文档", "图片"]) {
    await page
      .getByRole("group", { name: "作品类型" })
      .getByRole("button", { name: category, exact: true })
      .click();
    await expect(page.locator(".sample-card")).toHaveCount(
      category === "原型" ? 8 : 2,
    );
  }
  const types = page.getByRole("group", { name: "作品类型" });
  await expect(types.getByRole("button")).toHaveText([
    "全部",
    "原型",
    "幻灯片",
    "文档",
    "图片",
    "HyperFrames",
    "视频",
    "音频",
    "实时产物",
    "WebGL",
  ]);
  for (const category of ["HyperFrames", "视频", "音频", "实时产物", "WebGL"]) {
    const button = types.getByRole("button", { name: category, exact: true });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(types.locator('[aria-pressed="true"]')).toHaveCount(1);
    await expect(page.locator(".sample-card")).toHaveCount(1);
    await expect(page.locator(".samples-empty")).toHaveCount(0);
  }
  await types.getByRole("button", { name: "全部", exact: true }).click();
  await expect(page.locator(".sample-card")).toHaveCount(19);
  await page.getByRole("button", { name: "全部", exact: true }).click();
  await page.getByRole("textbox", { name: "搜索作品" }).fill("LUMA");
  await expect(page.locator(".sample-card")).toHaveCount(1);
  await page.getByRole("textbox", { name: "搜索作品" }).fill("不存在的作品");
  await expect(page.getByRole("status")).toContainText("没有找到匹配的作品");
});

test("travel: all 20 business pages load with nine independent local photos", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const images = new Set<string>();
  await page.goto("/inspiration/travel");
  await expect(page.locator(".prototype-switch option")).toHaveCount(20);
  for (let i = 0; i < 20; i++) {
    await travelPage(page, i);
    await expect(
      page.locator(i ? ".roam-section h1" : ".travel-cover h2"),
    ).toBeVisible();
    await expect
      .poll(() =>
        page
          .locator(".roam-site img")
          .evaluateAll((imgs) =>
            imgs.every(
              (el) =>
                (el as HTMLImageElement).complete &&
                (el as HTMLImageElement).naturalWidth >= 400,
            ),
          ),
      )
      .toBe(true);
    (
      await page
        .locator(".roam-site img")
        .evaluateAll((imgs) => imgs.map((el) => (el as HTMLImageElement).src))
    ).forEach((src) => images.add(src));
  }
  expect(images.size).toBe(9);
  expect(errors).toEqual([]);
});

test("travel: complete search-to-reservation workflow, discount, persistence and cancellation", async ({
  page,
}) => {
  await page.goto("/inspiration/travel");
  await page.getByRole("textbox", { name: "目的地关键词" }).fill("山城");
  await page.getByRole("button", { name: "寻找一段慢时光 ↗" }).click();
  await expect(page.locator(".roam-listings article")).toHaveCount(1);
  await page
    .getByRole("button", { name: "收藏托斯卡纳山城", exact: true })
    .click();
  await page.getByRole("button", { name: "查看目的地 →" }).click();
  await expect(page.locator(".roam-section h1")).toHaveText("托斯卡纳山城");
  await page.getByRole("button", { name: "找住宿", exact: true }).click();
  await page.getByRole("button", { name: "查看住宿 →" }).click();
  await page.getByRole("button", { name: "选择喜欢的房型" }).click();
  await page
    .locator(".roam-room-list article")
    .nth(1)
    .getByRole("button")
    .click();
  await page.getByRole("button", { name: "选择日期 →" }).click();
  await page.getByRole("spinbutton", { name: "入住晚数" }).fill("3");
  await page.getByRole("button", { name: "填写出行人" }).click();
  await page.getByRole("textbox", { name: "出行人称呼" }).fill("演示旅人");
  await page
    .getByRole("textbox", { name: "联系邮箱" })
    .fill("demo@example.com");
  await page.getByRole("button", { name: "确认出行信息" }).click();
  await page.getByRole("textbox", { name: "体验优惠码" }).fill("ROAM100");
  await expect(page.locator(".roam-book-box strong")).toHaveText("合计 ¥ 2660");
  await page.getByRole("button", { name: "继续模拟支付" }).click();
  await expect(
    page.getByRole("button", { name: "确认模拟预订" }),
  ).toBeDisabled();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "确认模拟预订" }).click();
  await page.getByRole("button", { name: "查看我的订单" }).click();
  await page.reload();
  await expect(page.locator(".roam-order-detail")).toContainText("演示旅人");
  await expect(page.locator(".roam-order-detail")).toContainText("2660");
  await page.getByRole("button", { name: "取消演示订单" }).click();
  await expect(page.locator(".roam-order-detail")).toContainText(
    "已取消（演示）",
  );
  const backup = JSON.parse((await exportFile(page, "导出行程")).toString());
  expect(backup.orderStatus).toBe("已取消（演示）");
  expect(backup.favorites).toEqual([0]);
});

test("travel: filtering, itinerary reordering/deletion and local consultation", async ({
  page,
}) => {
  await page.goto("/inspiration/travel");
  await travelPage(page, 4);
  await page.getByRole("button", { name: "人文", exact: true }).click();
  await expect(page.locator(".roam-listings article")).toHaveCount(2);
  await travelPage(page, 10);
  await page.getByRole("textbox", { name: "新行程地点" }).fill("晚间广场");
  await page.getByRole("button", { name: "加入行程", exact: true }).click();
  await page.getByRole("button", { name: "上移晚间广场", exact: true }).click();
  await expect(page.locator(".roam-itinerary h3").nth(2)).toHaveText(
    "晚间广场",
  );
  await page.getByRole("button", { name: "删除晚间广场", exact: true }).click();
  await expect(page.locator(".roam-itinerary article")).toHaveCount(3);
  await travelPage(page, 19);
  await page.getByRole("textbox", { name: "咨询内容" }).fill("测试取消政策");
  await page.getByRole("button", { name: "保存咨询草稿" }).click();
  await expect(page.getByRole("status")).toContainText("没有发送给客服");
  await page.reload();
  await expect(page.getByRole("textbox", { name: "咨询内容" })).toHaveValue(
    "测试取消政策",
  );
});

test("slides: 20 actual SVG slides, keyboard navigation, editing and presentation mode", async ({
  page,
}) => {
  await page.goto("/inspiration/luma");
  await expect(page.locator(".deck-thumbnails>button")).toHaveCount(20);
  const contents = new Set<string>();
  for (let i = 0; i < 20; i++) {
    await page.locator(".deck-thumbnails>button").nth(i).click();
    await expect(page.locator(".deck-stage svg")).toHaveAttribute(
      "data-slide",
      String(i),
    );
    await expect(page.locator(".deck-stage svg")).toHaveAttribute(
      "viewBox",
      "0 0 960 540",
    );
    contents.add((await page.locator(".deck-stage svg").textContent()) || "");
  }
  expect(contents.size).toBe(20);
  await page.keyboard.press("Home");
  await expect(page.locator(".deck-stage svg")).toHaveAttribute(
    "data-slide",
    "0",
  );
  await page.getByRole("button", { name: "编辑此页文字" }).click();
  await page
    .getByRole("textbox", { name: "幻灯片标题", exact: true })
    .fill("我的影像提案");
  await page
    .getByRole("textbox", { name: "演讲备注", exact: true })
    .fill("第一页演讲备注");
  await page.reload();
  await expect(page.locator(".deck-stage svg")).toContainText("我的影像提案");
  await expect(
    page.getByRole("textbox", { name: "演讲备注", exact: true }),
  ).toHaveValue("第一页演讲备注");
  await page.getByRole("button", { name: "全屏演示", exact: true }).click();
  await expect(page.locator(".is-presenting")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".deck-stage svg")).toHaveAttribute(
    "data-slide",
    "1",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator(".is-presenting")).toHaveCount(0);
});

test("PPTX export contains 20 editable slides, raster pictures and notes, not screenshots", async ({
  page,
}) => {
  await page.goto("/inspiration/luma");
  await page.getByRole("button", { name: "编辑此页文字" }).click();
  await page
    .getByRole("textbox", { name: "幻灯片标题", exact: true })
    .fill("导出文字测试");
  await page
    .getByRole("textbox", { name: "演讲备注", exact: true })
    .fill("这段备注也要保留");
  const entries = unzipSync(await exportFile(page, "导出 PPTX"));
  const slides = Object.keys(entries).filter((k) =>
    /^ppt\/slides\/slide\d+\.xml$/.test(k),
  );
  expect(slides).toHaveLength(20);
  const first = strFromU8(entries["ppt/slides/slide1.xml"]);
  expect(first).toContain("导出文字测试");
  expect(first).toContain("<p:sp>");
  expect(first).toContain("<p:pic>");
  expect(strFromU8(entries["ppt/notesSlides/notesSlide1.xml"])).toContain(
    "这段备注也要保留",
  );
  expect(strFromU8(entries["ppt/notesSlides/notesSlide1.xml"])).toContain(
    "NASA",
  );
  const photos = Object.keys(entries).filter(
    (k) => k.startsWith("ppt/media/") && !k.endsWith("/"),
  );
  expect(photos.length).toBeGreaterThanOrEqual(5);
  expect(photos.every((k) => /\.(jpg|jpeg|png)$/i.test(k))).toBe(true);
  expect(slides.every((k) => !strFromU8(entries[k]).includes("NaN"))).toBe(
    true,
  );
});

test("report: 20 substantive A4 pages, no default clipping, directory, editing and comments", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/inspiration/research");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".report-paper")).toHaveCount(20);
  const clipped = await page.locator(".paper-content").evaluateAll((nodes) =>
    nodes
      .map((el, i) => ({
        page: i + 1,
        overflow: el.scrollHeight - el.clientHeight,
      }))
      .filter((x) => x.overflow > 2),
  );
  expect(clipped).toEqual([]);
  for (let i = 0; i < 20; i++) {
    expect(
      (
        await page
          .locator(".report-paper")
          .nth(i)
          .locator(".paper-paragraph")
          .allTextContents()
      ).join("").length,
    ).toBeGreaterThan(100);
    await page.locator(".report-toc nav button").nth(i).click();
    await expect(page.locator(".report-toc nav button").nth(i)).toHaveAttribute(
      "aria-current",
      "page",
    );
  }
  await page.getByRole("textbox", { name: "搜索文档目录" }).fill("摘要");
  await expect(page.locator(".report-toc nav button")).toHaveCount(1);
  await page.locator(".report-toc nav button").click();
  await page.getByRole("button", { name: "编辑与批注", exact: true }).click();
  await page
    .getByRole("textbox", { name: "章节标题", exact: true })
    .fill("我的摘要");
  await page
    .getByRole("textbox", { name: "章节正文", exact: true })
    .fill("已编辑的研究方法摘要。\n\n第二个实质段落。");
  await page
    .getByRole("textbox", { name: "新增页面批注", exact: true })
    .fill("请复核图像来源");
  await page.getByRole("button", { name: "添加批注", exact: true }).click();
  await page.reload();
  await expect(page.locator(".paper-1 h2")).toHaveText("我的摘要");
  await page.getByRole("button", { name: "编辑与批注", exact: true }).click();
  await expect(page.locator(".report-editor article")).toContainText(
    "请复核图像来源",
  );
  await page.getByRole("button", { name: "关闭文档编辑", exact: true }).click();
  await page.getByRole("button", { name: "连续阅读", exact: true }).click();
  await expect(page.locator(".report-pages")).toHaveClass(/is-continuous/);
  const before = (await page.locator(".report-paper").first().boundingBox())!
    .width;
  await page.getByRole("combobox", { name: "文档缩放" }).selectOption("125");
  expect(
    (await page.locator(".report-paper").first().boundingBox())!.width,
  ).toBeGreaterThan(before);
  const backup = JSON.parse(
    (await exportFile(page, "下载文稿备份")).toString(),
  );
  expect(backup.sections).toHaveLength(20);
  expect(backup.sections[1].title).toBe("我的摘要");
  expect(backup.comments[0].text).toBe("请复核图像来源");
});

test("report print produces exactly 20 A4 PDF pages without sidebar or clipping", async ({
  page,
}) => {
  await page.goto("/inspiration/research");
  await page.evaluate(() => document.fonts.ready);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".app-sidebar")).not.toBeVisible();
  const clipped = await page.locator(".paper-content").evaluateAll((nodes) =>
    nodes
      .map((el, i) => ({
        page: i + 1,
        overflow: el.scrollHeight - el.clientHeight,
      }))
      .filter((x) => x.overflow > 2),
  );
  expect(clipped).toEqual([]);
  const pdf = await page.pdf({
    preferCSSPageSize: true,
    printBackground: true,
  });
  expect((pdf.toString("latin1").match(/\/Type \/Page\b/g) || []).length).toBe(
    20,
  );
});

test("artwork: 20 independent compositions, correct native aspect ratios, pan, zoom and favorites", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/inspiration/chishan");
  await expect(page.locator(".brand-filmstrip>button")).toHaveCount(20);
  const artworks = new Set<string>();
  for (let i = 0; i < 20; i++) {
    await page.locator(".brand-filmstrip>button").nth(i).click();
    await expect(page.locator(".brand-canvas svg")).toHaveAttribute(
      "data-artboard",
      String(i + 1),
    );
    artworks.add(await page.locator(".brand-canvas svg").innerHTML());
    const box = (await page.locator(".brand-canvas-art").boundingBox())!,
      canvas = (await page.locator(".brand-canvas").boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(canvas.width);
    expect(box.height).toBeLessThanOrEqual(canvas.height);
  }
  expect(artworks.size).toBe(20);
  await page.getByRole("textbox", { name: "画板主文案" }).fill("新的品牌文案");
  await expect(page.locator(".brand-canvas svg")).toContainText("新的品牌文案");
  await page.getByRole("button", { name: "☆ 收藏此画板", exact: true }).click();
  await page.getByRole("button", { name: "★ 收藏", exact: true }).click();
  await expect(page.locator(".brand-filmstrip>button")).toHaveCount(1);
  await page.getByRole("button", { name: "原尺寸", exact: true }).click();
  await expect(page.locator(".brand-canvas-toolbar")).toContainText("100%");
  expect(
    Math.round((await page.locator(".brand-canvas-art").boundingBox())!.width),
  ).toBe(1200);
  const canvas = (await page.locator(".brand-canvas").boundingBox())!;
  const x = canvas.x + canvas.width / 2,
    y = canvas.y + canvas.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 35, y + 25);
  await page.mouse.up();
  await expect(page.locator(".brand-canvas-art")).toHaveAttribute(
    "style",
    /translate\(35px, 25px\)/,
  );
  await page.getByRole("button", { name: "适合窗口", exact: true }).click();
  await expect(page.locator(".brand-canvas-art")).toHaveAttribute(
    "style",
    /translate\(0px, 0px\)/,
  );
  await page.reload();
  await expect(page.getByRole("textbox", { name: "画板主文案" })).toHaveValue(
    "新的品牌文案",
  );
});

test("artwork exports editable embedded-image SVG, native PNG and a ZIP of 20 SVGs", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/inspiration/chishan");
  const svg = (await exportFile(page, "下载可编辑 SVG")).toString();
  expect(svg).toContain("<svg");
  expect(svg).toContain("<text");
  expect(svg).toContain('width="1200" height="1600"');
  expect(svg).toContain('href="data:image/webp;base64,');
  expect(svg).not.toContain('href="/src/');
  expect(svg).toContain("<metadata>");
  const png = await exportFile(page, "下载原尺寸 PNG");
  expect(png.subarray(1, 4).toString()).toBe("PNG");
  expect(png.readUInt32BE(16)).toBe(1200);
  expect(png.readUInt32BE(20)).toBe(1600);
  const entries = unzipSync(await exportFile(page, "下载20张 SVG"));
  expect(Object.keys(entries).filter((k) => k.endsWith(".svg"))).toHaveLength(
    20,
  );
  expect(strFromU8(entries["摄影素材署名.txt"])).toContain("CC0");
});

for (const [i, id] of ids.entries()) {
  test(`${id}: remix retains format, independent state, refresh and my-copies entry`, async ({
    page,
  }) => {
    await page.goto(`/inspiration/${id}`);
    await page
      .getByRole("button", { name: "做同款 · 保留此类型", exact: true })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/inspiration/${id}/draft/[\\w-]+$`),
    );
    const url = page.url();
    await expect(page.locator(shells[i])).toBeVisible();
    await expect(page.locator(".sample-top small")).toContainText("我的副本");
    if (id === "travel") await travelPage(page, 1);
    if (id === "luma")
      await page.locator(".deck-thumbnails>button").nth(1).click();
    if (id === "research")
      await page.locator(".report-toc nav button").nth(1).click();
    if (id === "chishan")
      await page.locator(".brand-filmstrip>button").nth(1).click();
    await page.reload();
    await expect(page.locator(shells[i])).toBeVisible();
    const isolated = await page.evaluate((id) => {
      const records = JSON.parse(
        localStorage.getItem("designbuddy.samples.drafts.v2") || "[]",
      );
      return [
        JSON.parse(
          localStorage.getItem(`designbuddy.samples.v2.${id}.sample`)!,
        ),
        JSON.parse(
          localStorage.getItem(
            `designbuddy.samples.v2.${id}.${records[0].id}`,
          )!,
        ),
      ];
    }, id);
    const position = id === "travel" || id === "research" ? "page" : "index";
    expect(isolated[0][position]).toBe(0);
    expect(isolated[1][position]).toBe(1);
    const state = await page.evaluate(
      (id) => ({
        original: localStorage.getItem(`designbuddy.samples.v2.${id}.sample`),
        index: JSON.parse(
          localStorage.getItem("designbuddy.samples.drafts.v2") || "[]",
        ),
      }),
      id,
    );
    expect(state.index).toHaveLength(1);
    expect(state.index[0].sample).toBe(id);
    await page.getByRole("button", { name: "← 社区", exact: true }).click();
    await page
      .getByRole("button", { name: "我的副本（1）", exact: true })
      .click();
    await expect(page.locator(".sample-card")).toHaveCount(1);
    await page.locator(".sample-card>button").click();
    await expect(page).toHaveURL(url);
  });
}

test("four photography sets are disjoint and source disclosures include credits/licenses", async ({
  page,
}) => {
  const sources = new Set<string>();
  for (const [i, id] of ids.entries()) {
    await page.goto(`/inspiration/${id}`);
    await page.locator(".sample-credits summary").click();
    const links = await page
      .locator(".sample-credits a")
      .evaluateAll((nodes) => nodes.map((n) => (n as HTMLAnchorElement).href));
    expect(links).toHaveLength(i === 0 ? 9 : 5);
    for (const url of links) {
      expect(sources.has(url)).toBe(false);
      sources.add(url);
    }
    await expect(page.locator(".sample-credits")).toContainText(
      /CC0|CC BY|public domain/,
    );
  }
  expect(sources.size).toBe(24);
});

test("malformed persisted state recovers safely for all four formats", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/inspiration");
  for (const [i, id] of ids.entries()) {
    await page.evaluate(
      (id) =>
        localStorage.setItem(
          `designbuddy.samples.v2.${id}.sample`,
          JSON.stringify({
            index: "bad",
            page: -100,
            city: 700,
            favorites: null,
            stops: {},
            titles: null,
            bodies: { 0: 123 },
            notes: [],
            comments: [null, {}],
            captions: null,
            accent: "bad",
          }),
        ),
      id,
    );
    await page.goto(`/inspiration/${id}`);
    await expect(page.locator(shells[i])).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("old generic workbench routes and missing drafts are honestly unavailable", async ({
  page,
}) => {
  for (const url of [
    "/inspiration/blog/overview",
    "/inspiration/luma/draft/missing",
    "/inspiration/luma/garbage",
  ]) {
    await page.goto(url);
    await expect(
      page.getByRole("heading", { name: "这个旧案例已下架，或副本不存在" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "返回新版社区" }).click();
    await expect(page).toHaveURL(/\/inspiration$/);
  }
});

for (const width of [320, 375, 768, 1024, 1440]) {
  test(`community and all four actual media workspaces fit ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const id of ["", ...ids]) {
      await page.goto(`/inspiration${id ? "/" + id : ""}`);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      await expect(page.locator(".brand-lockup strong")).toHaveText(
        "DesignBuddy",
      );
      if (id)
        await expect(
          page.getByRole("button", {
            name: "做同款 · 保留此类型",
            exact: true,
          }),
        ).toBeVisible();
    }
  });
}

test("report warns and blocks its print action when edited content exceeds A4", async ({
  page,
}) => {
  await page.goto("/inspiration/research");
  await page.evaluate(() => {
    (window as any).__printed = false;
    window.print = () => {
      (window as any).__printed = true;
    };
  });
  await page.getByRole("button", { name: "编辑与批注", exact: true }).click();
  await page
    .getByRole("textbox", { name: "章节正文", exact: true })
    .fill("观察记录".repeat(400));
  await expect(page.getByRole("alert")).toContainText("内容超出纸张");
  await page.getByRole("button", { name: "关闭文档编辑", exact: true }).click();
  await page
    .getByRole("button", { name: "打印 / 另存 PDF", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  expect(await page.evaluate(() => (window as any).__printed)).toBe(false);
  await page
    .getByRole("textbox", { name: "章节正文", exact: true })
    .fill("已精简的观察记录。");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "关闭文档编辑", exact: true }).click();
  await page
    .getByRole("button", { name: "打印 / 另存 PDF", exact: true })
    .click();
  expect(await page.evaluate(() => (window as any).__printed)).toBe(true);
});

test("long artwork captions remain inside all 20 native canvases", async ({
  page,
}) => {
  await page.goto("/inspiration/chishan");
  for (let i = 0; i < 20; i++) {
    await page.locator(".brand-filmstrip>button").nth(i).click();
    await page
      .getByRole("textbox", { name: "画板主文案" })
      .fill("这是一个用于检查画板文案长度的完整测试文字".repeat(2));
    const box = await page.locator(".brand-canvas svg").evaluate((svg) => {
      const bounds = (
        svg.querySelector("[data-caption]") as SVGGraphicsElement
      ).getBBox();
      return {
        right: bounds.x + bounds.width,
        bottom: bounds.y + bounds.height,
        w: (svg as SVGSVGElement).viewBox.baseVal.width,
        h: (svg as SVGSVGElement).viewBox.baseVal.height,
      };
    });
    expect(box.right).toBeLessThanOrEqual(box.w);
    expect(box.bottom).toBeLessThanOrEqual(box.h);
  }
});
