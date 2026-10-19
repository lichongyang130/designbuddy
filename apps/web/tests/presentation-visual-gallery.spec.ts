import { test, expect } from "@playwright/test";
import { unzipSync } from "fflate";
const base = "/presentation-examples/visual-directions/";
test("built-in M2 card, three actual decks, synchronized page comparison and native downloads without publishing", async ({
  page,
  request,
}) => {
  const writes: string[] = [],
    errors: string[] = [];
  page.on("request", (r) => {
    if (r.method() !== "GET" && /skill-runs|templates|community/.test(r.url()))
      writes.push(r.url());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/inspiration");
  await page.getByRole("button", { name: "幻灯片", exact: true }).click();
  const card = page.locator('[data-sample="visual-directions"]');
  await expect(card).toBeVisible();
  await card.getByRole("button").click();
  await expect(page).toHaveURL(/\/inspiration\/visual-directions$/);
  await expect(
    page.getByRole("heading", { name: "同一份材料，三种视觉叙事" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("complementary", { name: "选择视觉汇报页" })
      .getByRole("button"),
  ).toHaveCount(12);
  await page.getByRole("button", { name: /^第11页：/ }).click();
  for (const name of ["品牌图文", "科技发布", "咨询极简"]) {
    await page
      .getByRole("region", { name: "选择艺术方向" })
      .getByRole("button", { name: new RegExp(name) })
      .click();
    await expect(page.locator(".leader-report-pagination p")).toContainText(
      "第 11 / 12 页",
    );
    await expect
      .poll(() =>
        page
          .locator(".leader-report-slide")
          .evaluate(
            (e: HTMLImageElement) => e.complete && e.naturalWidth === 960,
          ),
      )
      .toBe(true);
    await expect(page.getByRole("region", { name: "本页讲稿" })).toContainText(
      "证据素材 · 完整显示 · 未自动OCR",
    );
    await expect(
      page.getByRole("region", { name: "素材可追溯记录" }),
    ).toContainText("不是独立版权核验");
  }
  for (const style of ["consulting", "technology-launch", "brand-editorial"]) {
    const pptx = await request.get(`${base}${style}/presentation.pptx`);
    expect(pptx.ok()).toBe(true);
    const zip = unzipSync(await pptx.body());
    expect(
      Object.keys(zip).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)),
    ).toHaveLength(12);
    expect(
      Object.keys(zip).some((n) => /^ppt\/charts\/chart\d+.xml$/.test(n)),
    ).toBe(true);
    const pdf = await request.get(`${base}${style}/presentation.pdf`);
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
  }
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});
test("M2 retry and strict preview path reject corrupted reports instead of fetching arbitrary resources", async ({
  page,
}) => {
  let invalid = true;
  await page.route(
    "**/visual-directions/consulting/report.json",
    async (route) => {
      const r = await route.fetch(),
        body = await r.json();
      if (invalid) body.pages[0].preview = "../../private.png";
      await route.fulfill({ response: r, json: body });
    },
  );
  await page.goto("/inspiration/visual-directions");
  await expect(page.getByRole("alert")).toContainText("路径不安全");
  await expect(page.locator(".leader-report-slide")).toHaveCount(0);
  invalid = false;
  await page.getByRole("button", { name: "重新载入视觉案例" }).click();
  await expect(page.locator(".leader-report-slide")).toBeVisible();
});
test("M2 mobile cards and page navigation do not overflow, and opening the generator never uploads sample assets", async ({
  page,
}) => {
  let posts = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && /skill-runs|skill-plans/.test(r.url()))
      posts++;
  });
  await page.route("**/api/skill-runtime", async (route) => {
    const r = await route.fetch(),
      body = await r.json();
    body.skills = body.skills.map((s: { id: string }) =>
      s.id === "slides.create" ? { ...s, status: "ready" } : s,
    );
    await route.fulfill({ response: r, json: body });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/inspiration/visual-directions");
  await page
    .getByRole("region", { name: "选择艺术方向" })
    .getByRole("button", { name: /品牌图文/ })
    .click();
  await expect(page.locator(".leader-report-slide")).toHaveAttribute(
    "src",
    /brand-editorial\/slides\/01.jpg$/,
  );
  expect(
    await page
      .locator(".visual-gallery")
      .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
  ).toBe(true);
  await page.getByRole("button", { name: "用此风格生成自己的汇报" }).click();
  const desk = page.getByRole("region", { name: "真实技能执行台" });
  await expect(desk.getByLabel("视觉艺术方向")).toHaveValue("brand-editorial");
  await expect(
    desk.getByRole("button", { name: "上传并执行技能" }),
  ).toBeDisabled();
  await expect(desk.getByRole("group", { name: /^素材 / })).toHaveCount(0);
  expect(posts).toBe(0);
  await page.screenshot({
    path: "../../.cache/m2-gallery-mobile.png",
    fullPage: true,
  });
});
