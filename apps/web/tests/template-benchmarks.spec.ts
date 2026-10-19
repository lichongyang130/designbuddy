import {
  test,
  expect,
  type Download,
  type Page,
  request as requestFactory,
} from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { unzipSync, strFromU8 } from "fflate";
import AxeBuilder from "@axe-core/playwright";
const ids = [
  "pro-review",
  "pro-project",
  "pro-launch",
  "pro-tour",
  "pro-film",
  "pro-cues",
  "pro-cost",
  "pro-config",
];
async function bytes(d: Download) {
  return readFile((await d.path())!);
}
async function download(page: Page, name: string) {
  const wait = page.waitForEvent("download");
  await page.getByRole("button", { name, exact: true }).click();
  return bytes(await wait);
}
test("collection exposes nine benchmarks and a truthful full inventory", async ({
  page,
}) => {
  await page.goto("/inspiration");
  await expect(page.locator(".sample-card")).toHaveCount(54);
  await page.getByRole("button", { name: "查看本批 9 类标杆" }).click();
  await expect(page.locator(".sample-card")).toHaveCount(9);
  await page
    .getByRole("button", { name: "能力与缺口清单", exact: true })
    .click();
  const panel = page.getByRole("region", { name: "模板能力与缺口清单" });
  await expect(panel).toContainText("当前登记 54 项");
  await expect(panel.locator("tbody").first().locator("tr")).toHaveCount(54);
  await expect(panel.locator("tbody").nth(1).locator("tr")).toHaveCount(130);
});
for (const width of [1440, 390])
  for (const id of ids)
    test(`${id}: real content, no page errors or horizontal overflow at ${width}`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/inspiration/" + id);
      await expect(page.locator(".bench-hero h1")).toBeVisible();
      await expect(
        page.getByRole("textbox", { name: "项目 / 品牌名称" }),
      ).toBeVisible();
      await expect(page.locator(".bench-boundary")).toBeVisible();
      await page
        .getByRole("textbox", { name: "项目 / 品牌名称" })
        .fill("我的标杆方案");
      await page.reload();
      await expect(
        page.getByRole("textbox", { name: "项目 / 品牌名称" }),
      ).toHaveValue("我的标杆方案");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      expect(errors).toEqual([]);
    });
test("PPTX and DOCX downloads contain current edits and native editable text", async ({
  page,
}) => {
  await page.goto("/inspiration/pro-review");
  await page.getByRole("textbox", { name: "项目 / 品牌名称" }).fill("本次复盘");
  await page
    .getByRole("textbox", { name: "编辑当前页标题" })
    .fill("需要确认的经营取舍");
  const zip = unzipSync(await download(page, "当前内容 PPTX"));
  expect(strFromU8(zip["ppt/slides/slide1.xml"])).toContain(
    "需要确认的经营取舍",
  );
  expect(
    Object.keys(zip).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)),
  ).toHaveLength(10);
  const pdf = await download(page, "原始样例 PDF（不含修改）");
  expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  await page.goto("/inspiration/pro-project");
  await page
    .getByRole("textbox", { name: "项目 / 品牌名称" })
    .fill("客户实施计划");
  await page
    .getByRole("textbox", { name: "编辑当前页标题" })
    .fill("已经确认的目标");
  const doc = unzipSync(await download(page, "当前内容 DOCX"));
  expect(strFromU8(doc["word/document.xml"])).toContain("客户实施计划");
  expect(strFromU8(doc["word/document.xml"])).toContain("已经确认的目标");
  expect(strFromU8(doc["word/document.xml"])).toContain("变更管理");
  await page.getByRole("button", { name: "查看原始文件实际页图" }).click();
  await expect(page.locator(".bench-rendered-pages img")).toHaveCount(5);
  await expect
    .poll(() =>
      page
        .locator(".bench-rendered-pages img")
        .evaluateAll((imgs) =>
          imgs.every((i) => (i as HTMLImageElement).naturalWidth > 0),
        ),
    )
    .toBe(true);
});
test("campaign exports six distinct SVGs, current PNG and safely escaped user text", async ({
  page,
}) => {
  await page.goto("/inspiration/pro-launch");
  await page
    .getByRole("textbox", { name: "项目 / 品牌名称" })
    .fill("<script>中文标题</script>");
  const svg = (await download(page, "当前画板 SVG")).toString();
  expect(svg).not.toContain("<script>");
  expect(svg).toContain("&lt;");
  expect((await download(page, "当前画板 PNG")).subarray(1, 4).toString()).toBe(
    "PNG",
  );
  const zip = unzipSync(await download(page, "六张 SVG 打包"));
  expect(Object.keys(zip).filter((n) => n.endsWith(".svg"))).toHaveLength(6);
  expect(
    new Set(
      Object.entries(zip)
        .filter(([n]) => n.endsWith(".svg"))
        .map(([, v]) => strFromU8(v)),
    ).size,
  ).toBe(6);
});
test("cost CSV and independent HTML reproduce live cent-based totals", async ({
  page,
}) => {
  await page.goto("/inspiration/pro-cost");
  await expect(page.locator(".bench-total strong")).toHaveText("¥23,786.40");
  await page.getByRole("spinbutton", { name: "策略工时" }).fill("30");
  await expect(page.locator(".bench-total strong")).toHaveText("¥25,045.68");
  const csv = (await download(page, "预算明细 CSV")).toString();
  expect(csv).toContain("25045.68");
  const html = (await download(page, "可独立运行 HTML")).toString();
  expect(html).toContain("data:font/woff2;base64,");
  await page.setContent(html);
  await expect(page.locator("#total")).toContainText("25045.68");
  await page.getByRole("spinbutton", { name: "策略工时" }).fill("24");
  await expect(page.locator("#total")).toContainText("23786.40");
});
test("guide export is self contained and completes all five steps with keyboard", async ({
  page,
}) => {
  await page.goto("/inspiration/pro-tour");
  const html = (await download(page, "当前导览 HTML")).toString();
  expect(html).toContain("data:font/woff2;base64,");
  await page.setContent(html);
  await expect(page.locator("#progress")).toHaveText("1 / 5");
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
  await expect(page.locator("#progress")).toHaveText("5 / 5");
  await expect(page.getByRole("button", { name: "下一步" })).toBeDisabled();
  await page.getByRole("button", { name: "重新开始" }).click();
  await expect(page.locator("#progress")).toHaveText("1 / 5");
});
test("audio exports actual WAVs; film is decodable with a 20-second duration", async ({
  page,
}) => {
  await page.goto("/inspiration/pro-cues");
  expect((await download(page, "当前 WAV")).subarray(0, 4).toString()).toBe(
    "RIFF",
  );
  const zip = unzipSync(await download(page, "五个音效 ZIP"));
  expect(Object.keys(zip).filter((n) => n.endsWith(".wav"))).toHaveLength(5);
  await page.goto("/inspiration/pro-film");
  await expect
    .poll(() =>
      page
        .locator("video")
        .evaluate((v: HTMLVideoElement) =>
          Number.isFinite(v.duration) ? v.duration : 0,
        ),
    )
    .toBe(20);
  await page.locator("video").evaluate((v: HTMLVideoElement) => {
    v.currentTime = 8;
  });
  await expect
    .poll(() =>
      page.locator("video").evaluate((v: HTMLVideoElement) => v.readyState),
    )
    .toBeGreaterThanOrEqual(2);
  await expect
    .poll(() =>
      page
        .locator("video")
        .evaluate((v: HTMLVideoElement) => v.textTracks[0]?.cues?.length || 0),
    )
    .toBe(5);
  expect((await download(page, "固定样片 MP4")).subarray(4, 8).toString()).toBe(
    "ftyp",
  );
  expect((await download(page, "原始字幕 VTT")).toString()).toContain("WEBVTT");
});
test("WebGL config exports geometry and a safe standalone page", async ({
  page,
}) => {
  await page.goto("/inspiration/pro-config");
  const obj = (await download(page, "当前几何 OBJ")).toString();
  expect(obj.split("\n").filter((x) => x.startsWith("v "))).toHaveLength(40);
  const html = (await download(page, "独立 WebGL HTML")).toString();
  expect(html).toContain("canvas.getContext");
  expect(html).toContain("data:font/woff2;base64,");
  await page.setContent(html);
  await expect
    .poll(() => page.locator("#status").textContent())
    .toMatch(/WebGL 已绘制|设备不支持 WebGL/);
  expect(await page.locator("canvas").count()).toBe(1);
});
test("new template cloud save/restore uses the real API", async ({ page }) => {
  await page.goto("/inspiration/pro-cost");
  await page
    .getByRole("textbox", { name: "项目 / 品牌名称" })
    .fill("云端成本版本");
  await expect(
    page.getByRole("button", { name: "保存到服务器", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "保存到服务器", exact: true }).click();
  await expect(page.locator(".template-cloud")).toContainText("已保存到服务器");
  await page
    .getByRole("textbox", { name: "项目 / 品牌名称" })
    .fill("临时本地修改");
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "恢复服务器版本", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "项目 / 品牌名称" }),
  ).toHaveValue("云端成本版本");
});
test("copy preserves edited configuration without mutating the original key", async ({
  page,
}) => {
  await page.goto("/inspiration/pro-tour");
  await page
    .getByRole("textbox", { name: "项目 / 品牌名称" })
    .fill("原始本地方案");
  await page.getByRole("button", { name: "做同款 · 保留此类型" }).click();
  await expect(page).toHaveURL(/\/inspiration\/pro-tour\/draft\//);
  await page
    .getByRole("textbox", { name: "项目 / 品牌名称" })
    .fill("独立副本方案");
  await page.goto("/inspiration/pro-tour");
  await expect(
    page.getByRole("textbox", { name: "项目 / 品牌名称" }),
  ).toHaveValue("原始本地方案");
});
test("benchmark main area has no serious/critical axe violations and a keyboard path", async ({
  page,
}) => {
  test.setTimeout(60000);
  const reports: unknown[] = [];
  for (const id of ids) {
    await page.goto("/inspiration/" + id);
    await expect(page.locator(".bench-main")).toBeVisible();
    const results = await new AxeBuilder({ page })
      .include(".bench-main")
      .analyze();
    reports.push({
      id,
      violations: results.violations,
      incomplete: results.incomplete.map((i) => ({
        id: i.id,
        impact: i.impact,
      })),
      scope:
        ".bench-main subtree and reachable iframe documents; not a whole-site audit",
    });
    expect(
      results.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact || ""),
      ),
    ).toEqual([]);
  }
  await writeFile(
    "../../.cache/template-axe-summary.json",
    JSON.stringify(reports, null, 2),
  );
  await page.goto("/inspiration/pro-launch");
  await page.getByRole("textbox", { name: "项目 / 品牌名称" }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("textbox", { name: "副标题" })).toBeFocused();
});

test("all eight new IDs support authorized snapshots, stale CAS and isolation", async ({
  page,
}) => {
  await page.goto("/inspiration/pro-cost");
  await expect(page.locator(".bench-main")).toBeVisible();
  const origin = new URL(page.url()).origin;
  const stranger = await requestFactory.newContext({
    baseURL: origin,
    storageState: { cookies: [], origins: [] },
  });
  try {
    await stranger.post("/api/local/session", {
      headers: { Origin: origin },
      data: {},
    });
    for (const id of ids) {
      const path = `/api/templates/${id}/verification`;
      const response = await page.request.put(path, {
        headers: { Origin: origin },
        data: { revision: 0, state: { title: "server-" + id } },
      });
      expect(response.status()).toBe(200);
      expect((await page.request.get(path)).status()).toBe(200);
      expect(
        (
          await page.request.put(path, {
            headers: { Origin: origin },
            data: { revision: 0, state: { title: "stale" } },
          })
        ).status(),
      ).toBe(409);
      expect((await stranger.get(path)).status()).toBe(404);
    }
  } finally {
    await stranger.dispose();
  }
});

test("standalone HTML loads embedded Chinese fonts with all network requests blocked", async ({
  page,
}) => {
  const requests: string[] = [];
  await page.route("**/*", (route) => {
    requests.push(route.request().url());
    return route.abort();
  });
  for (const [id, file] of [
    ["tour", "pro-tour/guide.html"],
    ["cost", "pro-cost/estimate.html"],
    ["config", "pro-config/configurator.html"],
  ]) {
    const html = await readFile(`public/template-benchmarks/${file}`, "utf8");
    await page.setContent(html);
    const fonts = await page.evaluate(async () => {
      await document.fonts.ready;
      return Array.from(document.fonts).map((face) => ({
        family: face.family,
        status: face.status,
      }));
    });
    expect(
      fonts.some(
        (f) =>
          f.family.replaceAll('"', "") === "Benchmark CJK" &&
          f.status === "loaded",
      ),
    ).toBe(true);
    await page.screenshot({
      path: `../../.cache/offline-${id}.png`,
      fullPage: true,
    });
  }
  expect(requests).toEqual([]);
});
