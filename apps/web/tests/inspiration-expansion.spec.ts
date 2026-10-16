import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { unzipSync, strFromU8 } from "fflate";
const newIds = ["museum", "city", "handbook", "nature"];
const allIds = ["travel", "luma", "research", "chishan", ...newIds];
async function exportFile(page: Page, name: string) {
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name, exact: true }).click();
  return readFile((await (await event).path())!);
}
async function museumPage(page: Page, i: number) {
  await page
    .getByRole("combobox", { name: "浏览展馆页面" })
    .selectOption(String(i));
  await expect(page.locator(".museum-site")).toHaveAttribute(
    "data-museum-page",
    String(i),
  );
}

test("original eight entries still have two real works per original format and a visible actual museum cover", async ({
  page,
}) => {
  await page.goto("/inspiration");
  await expect(page.locator(".sample-card")).toHaveCount(19);
  const cover = page.locator(".preview-museum .museum-cover");
  await expect(cover).toBeVisible();
  expect((await cover.boundingBox())!.width).toBeGreaterThan(100);
  await expect(page.locator(".preview-museum img")).toBeVisible();
  for (const category of ["原型", "幻灯片", "文档", "图片"]) {
    await page
      .getByRole("group", { name: "作品类型" })
      .getByRole("button", { name: category, exact: true })
      .click();
    await expect(page.locator(".sample-card")).toHaveCount(
      category === "原型" ? 8 : 2,
    );
  }
  await page.getByRole("button", { name: "全部", exact: true }).click();
  await page.getByRole("textbox", { name: "搜索作品" }).fill("拾光");
  await expect(page.locator(".sample-card")).toHaveCount(1);
  await page.locator(".sample-card>button").click();
  await expect(page).toHaveURL(/\/museum$/);
  await expect(page.locator(".museum-site")).toBeVisible();
});

test("museum: 20 related business pages, collection links, filters and no runtime errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/inspiration/museum");
  await expect(page.locator(".museum-prototype option")).toHaveCount(20);
  const images = new Set<string>();
  for (let i = 0; i < 20; i++) {
    await museumPage(page, i);
    await expect(page.locator(".museum-section h1")).toBeVisible();
    await expect
      .poll(() =>
        page
          .locator(".museum-site img")
          .evaluateAll((imgs) =>
            imgs.every(
              (img) =>
                (img as HTMLImageElement).complete &&
                (img as HTMLImageElement).naturalWidth >= 400,
            ),
          ),
      )
      .toBe(true);
    (
      await page
        .locator(".museum-site img")
        .evaluateAll((imgs) => imgs.map((img) => (img as HTMLImageElement).src))
    ).forEach((src) => images.add(src));
  }
  expect(images.size).toBe(5);
  expect(errors).toEqual([]);
  await museumPage(page, 1);
  await page.getByRole("button", { name: "建筑", exact: true }).click();
  await expect(page.locator(".museum-cards article")).toHaveCount(2);
  await page.getByRole("textbox", { name: "搜索展览" }).fill("城市");
  await expect(page.locator(".museum-cards article")).toHaveCount(1);
  await page
    .getByRole("button", { name: "收藏展览城市的切片", exact: true })
    .click();
  await museumPage(page, 18);
  await expect(page.locator(".museum-cards article")).toHaveCount(1);
  await museumPage(page, 3);
  await page.locator(".museum-object-grid>button").nth(2).click();
  await expect(page.locator(".museum-section h1")).toContainText("海岸的坐标");
  await page.getByRole("button", { name: "查看关联展览", exact: true }).click();
  await expect(page.locator(".museum-section h1")).toHaveText("海岸的坐标");
});

test("museum complete booking, immutable reservation, rescheduling and cancellation", async ({
  page,
}) => {
  await page.goto("/inspiration/museum");
  await page
    .getByRole("button", { name: "浏览所有展览 ↗", exact: true })
    .click();
  await page
    .getByRole("button", { name: "打开展览城市的切片", exact: true })
    .click();
  await page.getByRole("button", { name: "预约本展览 →", exact: true }).click();
  await page.getByRole("combobox", { name: "展馆预约人数" }).selectOption("2");
  await page
    .getByRole("button", { name: "选择预约日期 →", exact: true })
    .click();
  await page.getByLabel("展馆参观日期").fill("2026-11-22");
  await page
    .getByRole("button", { name: "选择入场场次 →", exact: true })
    .click();
  await page.locator(".museum-slots button").nth(1).click();
  await page
    .getByRole("button", { name: "填写访客信息 →", exact: true })
    .click();
  await page.getByRole("textbox", { name: "访客称呼" }).fill("演示访客");
  await page
    .getByRole("textbox", { name: "访客邮箱" })
    .fill("visitor@example.com");
  await page
    .getByRole("button", { name: "核对预约内容 →", exact: true })
    .click();
  await expect(page.locator(".museum-review aside strong")).toHaveText("¥ 160");
  await page.getByRole("button", { name: "进入模拟预约", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "确认模拟预约", exact: true }),
  ).toBeDisabled();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "确认模拟预约", exact: true }).click();
  await page.getByRole("button", { name: "查看电子凭证", exact: true }).click();
  await expect(page.locator(".museum-pass")).toContainText("非入场凭证");
  await page.reload();
  await expect(page.locator(".museum-pass")).toContainText("2026-11-22");
  await museumPage(page, 8);
  await page.getByRole("combobox", { name: "展馆预约人数" }).selectOption("6");
  await museumPage(page, 16);
  await expect(page.locator(".museum-order")).toContainText("2人");
  await page.getByRole("button", { name: "管理预约", exact: true }).click();
  await page
    .getByRole("button", { name: "选择新的参观日期", exact: true })
    .click();
  await page.getByLabel("展馆参观日期").fill("2026-11-25");
  await page
    .getByRole("button", { name: "选择入场场次 →", exact: true })
    .click();
  await page.locator(".museum-slots button").nth(2).click();
  await page.getByRole("button", { name: "返回确认改期", exact: true }).click();
  await page.getByRole("button", { name: "确认改期", exact: true }).click();
  await expect(page.locator(".museum-manage")).toContainText("2026-11-25");
  await page.getByRole("button", { name: "取消演示预约", exact: true }).click();
  await expect(page.locator(".museum-manage")).toContainText("已取消（演示）");
  const backup = JSON.parse(
    (await exportFile(page, "导出演示预约")).toString(),
  );
  expect(backup.reservation.quantity).toBe(2);
  expect(backup.reservation.total).toBe(160);
  expect(backup.reservation.date).toBe("2026-11-25");
  expect(backup.reservation.slot).toBe(2);
  expect(backup.reservation.status).toBe("已取消（演示）");
});

test("museum consultation stays local and persists after reload", async ({
  page,
}) => {
  await page.goto("/inspiration/museum");
  await museumPage(page, 19);
  await page
    .getByRole("textbox", { name: "展馆咨询草稿" })
    .fill("请核对参观条件");
  await page.getByRole("button", { name: "保存咨询草稿", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("未发送给任何场馆");
  await page.reload();
  await expect(page.getByRole("textbox", { name: "展馆咨询草稿" })).toHaveValue(
    "请核对参观条件",
  );
});

test("WALK has 20 independent scenes, bounded Chinese text, editing, notes and editable PPTX", async ({
  page,
}) => {
  await page.goto("/inspiration/city");
  const content = new Set<string>();
  await expect(page.locator(".deck-thumbnails>button")).toHaveCount(20);
  for (let i = 0; i < 20; i++) {
    await page.locator(".deck-thumbnails>button").nth(i).click();
    await expect(page.locator(".deck-stage svg")).toHaveAttribute(
      "data-slide",
      String(i),
    );
    content.add(await page.locator(".deck-stage svg").innerHTML());
    const bad = await page
      .locator(".deck-stage svg text")
      .evaluateAll((nodes) =>
        nodes.flatMap((n) => {
          const b = (n as SVGGraphicsElement).getBBox();
          return b.x + b.width > 962 || b.y + b.height > 542
            ? [n.textContent]
            : [];
        }),
      );
    expect(bad).toEqual([]);
  }
  expect(content.size).toBe(20);
  await page.keyboard.press("Home");
  await page.getByRole("button", { name: "编辑此页文字", exact: true }).click();
  await page
    .getByRole("textbox", { name: "幻灯片标题", exact: true })
    .fill("漫步提案导出测试");
  await page
    .getByRole("textbox", { name: "演讲备注", exact: true })
    .fill("本提案不提供真实活动预约");
  await page.getByRole("button", { name: "全屏演示", exact: true }).click();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".deck-stage svg")).toHaveAttribute(
    "data-slide",
    "1",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator(".is-presenting")).toHaveCount(0);
  const entries = unzipSync(await exportFile(page, "导出 PPTX"));
  expect(
    Object.keys(entries).filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k)),
  ).toHaveLength(20);
  const slide = strFromU8(entries["ppt/slides/slide1.xml"]);
  expect(slide).toContain("漫步提案导出测试");
  expect(slide).toContain("<p:sp>");
  expect(slide).toContain("<p:pic>");
  expect(slide).not.toContain("LUMA");
  expect(strFromU8(entries["ppt/notesSlides/notesSlide1.xml"])).toContain(
    "本提案不提供真实活动预约",
  );
  expect(strFromU8(entries["ppt/notesSlides/notesSlide1.xml"])).toContain(
    "CC BY-SA 4.0",
  );
});

test("handbook: 20 distinct substantial chapters, complete A4 print, persisted paragraph edits and notes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/inspiration/handbook");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".handbook-paper")).toHaveCount(20);
  const clipped = () =>
    page.locator(".paper-content").evaluateAll((nodes) =>
      nodes
        .map((n, i) => ({
          page: i + 1,
          over: n.scrollHeight - n.clientHeight,
        }))
        .filter((n) => n.over > 2),
    );
  expect(await clipped()).toEqual([]);
  for (let i = 0; i < 20; i++) {
    expect(
      (
        await page
          .locator(".handbook-paper")
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
  await page.emulateMedia({ media: "print" });
  expect(await clipped()).toEqual([]);
  await expect(page.locator(".app-sidebar")).not.toBeVisible();
  const pdf = await page.pdf({
    preferCSSPageSize: true,
    printBackground: true,
  });
  expect((pdf.toString("latin1").match(/\/Type \/Page\b/g) || []).length).toBe(
    20,
  );
  await page.emulateMedia({ media: "screen" });
  await page.locator(".report-toc nav button").nth(2).click();
  await page.getByRole("button", { name: "编辑与批注", exact: true }).click();
  await page
    .getByRole("textbox", { name: "章节正文", exact: true })
    .fill("这是我的出行目标。\n\n这是同行者需要确认的事项。");
  await page
    .getByRole("textbox", { name: "新增页面批注", exact: true })
    .fill("出发前再次核验");
  await page.getByRole("button", { name: "添加批注", exact: true }).click();
  await page.reload();
  await expect(page.locator(".handbook-2")).toContainText("这是我的出行目标");
  const json = JSON.parse((await exportFile(page, "下载文稿备份")).toString());
  expect(json.sections).toHaveLength(20);
  expect(json.sections[2].paragraphs).toEqual([
    "这是我的出行目标。",
    "这是同行者需要确认的事项。",
  ]);
  expect(json.comments[0].text).toBe("出发前再次核验");
  expect(json.photoCredits).toHaveLength(5);
});

test("nature: 20 individual artboards with correct fit and long-caption bounds", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/inspiration/nature");
  await expect(page.locator(".brand-filmstrip>button")).toHaveCount(20);
  const content = new Set<string>();
  for (let i = 0; i < 20; i++) {
    await page.locator(".brand-filmstrip>button").nth(i).click();
    await expect(page.locator(".brand-canvas svg")).toHaveAttribute(
      "data-artboard",
      String(i + 1),
    );
    content.add(await page.locator(".brand-canvas svg").innerHTML());
    const board = (await page.locator(".brand-canvas-art").boundingBox())!,
      canvas = (await page.locator(".brand-canvas").boundingBox())!;
    expect(board.width).toBeLessThanOrEqual(canvas.width);
    expect(board.height).toBeLessThanOrEqual(canvas.height);
    await page
      .getByRole("textbox", { name: "画板主文案" })
      .fill("用一段更长的自然观察文案测试每一个画板的边界与排版");
    const box = await page.locator(".brand-canvas svg").evaluate((svg) => {
      const b = (
        svg.querySelector("[data-caption]") as SVGGraphicsElement
      ).getBBox();
      return {
        right: b.x + b.width,
        bottom: b.y + b.height,
        w: (svg as SVGSVGElement).viewBox.baseVal.width,
        h: (svg as SVGSVGElement).viewBox.baseVal.height,
      };
    });
    expect(box.right).toBeLessThanOrEqual(box.w);
    expect(box.bottom).toBeLessThanOrEqual(box.h);
  }
  expect(content.size).toBe(20);
  await page.getByRole("button", { name: "☆ 收藏此画板", exact: true }).click();
  await page.getByRole("button", { name: "★ 收藏", exact: true }).click();
  await expect(page.locator(".brand-filmstrip>button")).toHaveCount(1);
  await page.getByRole("button", { name: "原尺寸", exact: true }).click();
  expect(
    Math.round((await page.locator(".brand-canvas-art").boundingBox())!.width),
  ).toBe(1200);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "★ 已收藏画板", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("nature SVG/PNG/ZIP exports use new actual artwork and embedded images", async ({
  page,
}) => {
  await page.goto("/inspiration/nature");
  const svg = (await exportFile(page, "下载可编辑 SVG")).toString();
  expect(svg).toContain("野生来信");
  expect(svg).not.toContain("CHISHAN");
  expect(svg).toContain('href="data:image/webp;base64,');
  expect(svg).toContain("CC BY-SA 4.0");
  const png = await exportFile(page, "下载原尺寸 PNG");
  expect(png.subarray(1, 4).toString()).toBe("PNG");
  expect(png.readUInt32BE(16)).toBe(1200);
  expect(png.readUInt32BE(20)).toBe(1600);
  const entries = unzipSync(await exportFile(page, "下载20张 SVG"));
  expect(Object.keys(entries).filter((k) => k.endsWith(".svg"))).toHaveLength(
    20,
  );
  expect(Object.keys(entries)).toContain("01-野生来信主海报.svg");
});

for (const id of newIds) {
  test(`${id}: same-format copy is isolated, survives refresh and appears in my copies`, async ({
    page,
  }) => {
    await page.goto("/inspiration/" + id);
    await page
      .getByRole("button", { name: "做同款 · 保留此类型", exact: true })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/inspiration/${id}/draft/[\\w-]+$`),
    );
    const url = page.url();
    if (id === "museum") await museumPage(page, 1);
    if (id === "city")
      await page.locator(".deck-thumbnails>button").nth(1).click();
    if (id === "handbook")
      await page.locator(".report-toc nav button").nth(1).click();
    if (id === "nature")
      await page.locator(".brand-filmstrip>button").nth(1).click();
    await page.reload();
    const records = await page.evaluate((id) => {
      const draft = JSON.parse(
        localStorage.getItem("designbuddy.samples.drafts.v2")!,
      )[0];
      return {
        draft,
        base: JSON.parse(
          localStorage.getItem(`designbuddy.samples.v2.${id}.sample`)!,
        ),
        copy: JSON.parse(
          localStorage.getItem(`designbuddy.samples.v2.${id}.${draft.id}`)!,
        ),
      };
    }, id);
    const position = ["museum", "handbook"].includes(id) ? "page" : "index";
    expect(records.draft.sample).toBe(id);
    expect(records.base[position]).toBe(0);
    expect(records.copy[position]).toBe(1);
    await page.getByRole("button", { name: "← 社区", exact: true }).click();
    await page
      .getByRole("button", { name: "我的副本（1）", exact: true })
      .click();
    await expect(page.locator(".sample-card")).toHaveCount(1);
    await page.locator(".sample-card>button").click();
    await expect(page).toHaveURL(url);
  });
}

test("all eight collections have 44 disjoint photography sources and readable attribution", async ({
  page,
}) => {
  const urls = new Set<string>();
  for (const id of allIds) {
    await page.goto("/inspiration/" + id);
    await page.locator(".sample-credits summary").click();
    const links = await page
      .locator(".sample-credits a")
      .evaluateAll((nodes) => nodes.map((n) => (n as HTMLAnchorElement).href));
    expect(links).toHaveLength(id === "travel" ? 9 : 5);
    for (const url of links) {
      expect(urls.has(url)).toBe(false);
      urls.add(url);
    }
  }
  expect(urls.size).toBe(44);
});

test("new formats recover from invalid saved state and reservation JSON", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/inspiration");
  for (const id of newIds) {
    await page.evaluate(
      (id) =>
        localStorage.setItem(
          `designbuddy.samples.v2.${id}.sample`,
          JSON.stringify({
            page: 999,
            index: null,
            exhibition: -50,
            object: 999,
            ticket: 9,
            quantity: 0,
            slot: 9,
            favorites: [null, -1, 999],
            titles: null,
            bodies: { 0: null },
            comments: [null],
            captions: null,
            accent: "bad",
            reservation: "{bad json",
          }),
        ),
      id,
    );
    await page.goto("/inspiration/" + id);
    await expect(page.locator(".sample-top")).toBeVisible();
  }
  expect(errors).toEqual([]);
});

for (const width of [320, 375, 768, 1440]) {
  test(`expanded samples and fourteen-card community fit ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const id of ["", ...newIds]) {
      await page.goto("/inspiration" + (id ? "/" + id : ""));
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
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
