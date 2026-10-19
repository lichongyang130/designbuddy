import { test, expect } from "@playwright/test";
test("director template shows real 12 pages, task/evidence/relationship boundaries and synchronized M2 comparison, without auto upload", async ({
  page,
  request,
}) => {
  const writes: string[] = [],
    errors: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && /skill-runs|templates|community/.test(r.url()))
      writes.push(r.url());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/inspiration");
  await page.getByRole("button", { name: "幻灯片", exact: true }).click();
  const card = page.locator('[data-sample="content-director"]');
  await expect(card).toBeVisible();
  await card.getByRole("button").click();
  await expect(page).toHaveURL(/\/inspiration\/content-director$/);
  await expect(page.locator(".leader-report-pages button")).toHaveCount(12);
  await expect(
    page.getByRole("region", { name: "整套论证与节奏" }).getByRole("listitem"),
  ).toHaveCount(12);
  await page.getByRole("button", { name: /^第7页：/ }).click();
  await expect(
    page.getByRole("region", { name: "本页视觉任务单" }),
  ).toContainText("并列结构");
  await expect(
    page.getByRole("region", { name: "本页视觉任务单" }),
  ).toContainText("不表示先后");
  await expect(
    page.getByRole("region", { name: "本页来源与证据" }),
  ).toContainText("source-1");
  await page
    .getByRole("button", { name: "原M2 · 图文对照", exact: true })
    .click();
  await expect(page.locator(".leader-report-pagination p")).toContainText(
    "第 7 / 12 页",
  );
  await expect(page.locator(".leader-report-slide")).toHaveAttribute(
    "src",
    /visual-directions\/consulting\/slides\/07.jpg$/,
  );
  await expect(
    page.getByRole("region", { name: "本页视觉任务单" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "下载可编辑PPTX", exact: true }),
  ).toHaveAttribute(
    "href",
    /visual-directions\/consulting\/presentation.pptx$/,
  );
  await page
    .getByRole("button", { name: "内容导演 · 原生解释", exact: true })
    .click();
  await expect(page.locator(".leader-report-slide")).toHaveAttribute(
    "src",
    /content-director\/slides\/07.jpg$/,
  );
  await page.getByRole("button", { name: /^第10页：/ }).click();
  await expect(
    page.getByRole("region", { name: "本页视觉任务单" }),
  ).toContainText("建议顺序，不表示完成、批准或因果");
  await expect
    .poll(() =>
      page
        .locator(".leader-report-slide")
        .evaluate(
          (e: HTMLImageElement) => e.complete && e.naturalWidth === 960,
        ),
    )
    .toBe(true);
  const pdf = await request.get(
    "/presentation-examples/content-director/presentation.pdf",
  );
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});
test("corrupted director evidence/path fails visibly; retry restores actual exports", async ({
  page,
}) => {
  let invalid = true;
  await page.route("**/content-director/direction-plan.json", async (route) => {
    const r = await route.fetch(),
      body = await r.json();
    if (invalid) body.pages[0].evidenceRefs = ["invented-ref"];
    await route.fulfill({ response: r, json: body });
  });
  await page.goto("/inspiration/content-director");
  await expect(page.getByRole("alert")).toContainText("不安全");
  await expect(page.locator(".leader-report-slide")).toHaveCount(0);
  invalid = false;
  await page.getByRole("button", { name: "重新载入导演案例" }).click();
  await expect(
    page.getByRole("region", { name: "本页视觉任务单" }),
  ).toBeVisible();
});
for (const width of [320, 390])
  test(`director tasks, rhythm and separately authorized generator fit ${width}px`, async ({
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
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/inspiration/content-director");
    await expect(
      page.getByRole("region", { name: "本页视觉任务单" }),
    ).toBeVisible();
    expect(
      await page
        .locator(".director-report")
        .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
    ).toBe(true);
    await page
      .getByRole("button", { name: "用内容导演生成自己的汇报" })
      .click();
    const desk = page.getByRole("region", { name: "真实技能执行台" });
    await expect(desk.getByLabel("内容导演", { exact: true })).toHaveValue(
      "directed",
    );
    await expect(
      desk.getByRole("button", { name: "上传并执行技能" }),
    ).toBeDisabled();
    await expect(
      desk.getByRole("checkbox", { name: /我同意上传材料/ }),
    ).not.toBeChecked();
    expect(posts).toBe(0);
    if (width === 390)
      await page.screenshot({
        path: "../../.cache/director-mobile.png",
        fullPage: true,
      });
  });
