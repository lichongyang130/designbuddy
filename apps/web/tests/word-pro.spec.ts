import { test, expect } from "@playwright/test";
import { wordExample } from "../../../shared/wordDocument";
import { readFile } from "node:fs/promises";
test("Word template opens actual pages and source-bound repair history without uploading, then renders initial/final PDFs as canvases", async ({
  page,
}) => {
  const writes: string[] = [],
    errors: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && /skill-runs|templates/.test(r.url()))
      writes.push(r.url());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/inspiration");
  await page.getByRole("button", { name: "文档", exact: true }).click();
  const card = page.locator('[data-sample="word-pro"]');
  await expect(card).toBeVisible();
  await card.getByRole("button").click();
  await expect(page).toHaveURL(/inspiration\/word-pro$/);
  await expect(
    page.getByRole("region", { name: "Word质量与修复记录" }),
  ).toContainText("1轮");
  await expect(
    page
      .getByRole("complementary", { name: "Word页面缩略图" })
      .getByRole("button"),
  ).toHaveCount(
    (
      await (
        await page.request.get(
          "/word-examples/word-pro/business-report/word-quality-report.json",
        )
      ).json()
    ).renderer.pageCount,
  );
  await page.getByRole("button", { name: "查看Word第3页" }).click();
  await expect(page.locator(".word-actual-page")).toHaveAttribute(
    "src",
    /business-report\/pages\/03.jpg/,
  );
  await page
    .getByRole("button", { name: "初始版PDF对照", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "实际PDF页面预览" }),
  ).toContainText("PDF 第 1 /", { timeout: 45000 });
  await expect(
    page.getByRole("button", { name: "下一页PDF", exact: true }),
  ).toBeEnabled({ timeout: 45000 });
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "下一页PDF", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "实际PDF页面预览" }),
  ).toContainText("PDF 第 2 /");
  await page
    .getByRole("button", {
      name: "项目方案 · 目标/范围/交付/风险/验收",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("region", { name: "Word质量与修复记录" }),
  ).toContainText("0轮");
  await expect(
    page.getByRole("link", { name: "下载可编辑Word", exact: true }),
  ).toHaveAttribute("href", /project-plan\/document.docx$/);
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});
test("Word content form validates real sections; preparation and type/content changes revoke execution consent, preserving per-type drafts", async ({
  page,
}) => {
  await page.goto("/inspiration/word-pro");
  const form = page.getByRole("group", { name: "Word专业文稿准备" });
  await expect(form).toBeVisible();
  await form.getByRole("button", { name: "将Word文稿准备为输入" }).click();
  await expect(form.getByRole("alert")).toContainText("标题");
  await form
    .getByLabel("文档标题", { exact: true })
    .fill("来源可追踪的测试报告");
  await form.getByLabel("实际材料来源", { exact: true }).fill("原创UI测试材料");
  await form.getByLabel("来源定位", { exact: true }).fill("用户在此填写的原稿");
  for (const label of ["执行摘要", "分析与依据", "建议与行动"])
    await form
      .getByLabel(label, { exact: true })
      .fill(label + "：待确认真实业务事实，不伪造数据。");
  await form.getByRole("button", { name: "将Word文稿准备为输入" }).click();
  await expect(form.getByRole("status")).toContainText("尚未上传");
  const consent = page.getByRole("checkbox", {
      name: /我同意上传材料至应用后台并执行/,
    }),
    run = page.getByRole("button", { name: "上传并执行技能", exact: true });
  await consent.check();
  await expect(run).toBeEnabled();
  await form.getByLabel("文档标题", { exact: true }).fill("标题修改");
  await expect(consent).not.toBeChecked();
  await expect(run).toBeDisabled();
  await form
    .getByLabel("文档类型", { exact: true })
    .selectOption("project-plan");
  await expect(form.getByLabel("目标与背景", { exact: true })).toBeVisible();
  await form.getByLabel("目标与背景", { exact: true }).fill("另一个类型的草稿");
  await form
    .getByLabel("文档类型", { exact: true })
    .selectOption("business-report");
  await expect(form.getByLabel("执行摘要", { exact: true })).toHaveValue(
    /待确认真实业务事实/,
  );
});
test("actual browser upload -> Word Worker -> downloadable native DOCX / PDF / report persists after refresh and supports safe PDF preview", async ({
  page,
}) => {
  test.setTimeout(150000);
  await page.goto("/inspiration/word-pro");
  const form = page.getByRole("group", { name: "Word专业文稿准备" });
  await form.getByLabel("准备方式", { exact: true }).selectOption("json");
  const d = wordExample("project-plan");
  d.title = "浏览器实际Word交付测试";
  await form
    .getByLabel("上传Word结构化JSON", { exact: true })
    .setInputFiles({
      name: "browser-word.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(d)),
    });
  await form.getByRole("button", { name: "将Word文稿准备为输入" }).click();
  await page
    .getByRole("checkbox", { name: /我同意上传材料至应用后台并执行/ })
    .check();
  const queuedPromise = page.waitForResponse(
    (r) =>
      /\/api\/skill-runs$/.test(r.url()) && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "上传并执行技能", exact: true })
    .click();
  const response = await queuedPromise;
  expect(response.status()).toBe(202);
  const queued = await response.json();
  await expect
    .poll(
      async () => {
        const r = await page.request.get(`/api/skill-runs/${queued.id}`);
        return (await r.json()).status;
      },
      { timeout: 110000, intervals: [1000, 1500] },
    )
    .toBe("succeeded");
  await expect(page.locator(".skill-run-result")).toContainText(
    "草稿执行完成 · 未商业验收",
    { timeout: 10000 },
  );
  const run = await (
      await page.request.get(`/api/skill-runs/${queued.id}`)
    ).json(),
    a = run.artifacts.find((x: any) => x.name === "word-quality-report.json"),
    q = await (
      await page.request.get(`/api/skill-runs/${queued.id}/artifacts/${a.id}`)
    ).json();
  expect(q.contentPreserved).toBe(true);
  expect(q.commercialApproval).toBe(false);
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "下载 document.docx", exact: true })
    .click();
  const download = await downloadPromise,
    b = await readFile((await download.path())!);
  expect(b.subarray(0, 2).toString()).toBe("PK");
  await page
    .getByRole("button", { name: "预览 document.pdf", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "实际PDF页面预览" }),
  ).toContainText("PDF 第 1 /", { timeout: 45000 });
  await expect(page.locator(".skill-artifact-preview canvas")).toBeVisible();
  await page.reload();
  await expect(page.locator(".skill-run-result")).toContainText(
    "browser-word.json",
  );
  await expect(
    page.getByRole("button", { name: "下载 document.pdf", exact: true }),
  ).toBeVisible();
});
test("invalid Word request fails honestly with no artifacts or fake preview", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/inspiration/word-pro");
  const form = page.getByRole("group", { name: "Word专业文稿准备" });
  await form.getByLabel("准备方式", { exact: true }).selectOption("json");
  const d = wordExample();
  d.blocks[0].refs = ["nonexistent"];
  await form
    .getByLabel("上传Word结构化JSON", { exact: true })
    .setInputFiles({
      name: "invalid-word.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(d)),
    });
  await form.getByRole("button", { name: "将Word文稿准备为输入" }).click();
  await page
    .getByRole("checkbox", { name: /我同意上传材料至应用后台并执行/ })
    .check();
  await page
    .getByRole("button", { name: "上传并执行技能", exact: true })
    .click();
  await expect(page.locator(".skill-run-result")).toContainText("执行失败", {
    timeout: 30000,
  });
  await expect(page.locator(".skill-run-result")).toContainText("来源");
  await expect(
    page.locator(".skill-run-result .skill-artifact-list"),
  ).toHaveCount(0);
});
test("Word gallery, thumbnails and form stay usable at 390 and 320 pixels without horizontal page overflow", async ({
  page,
}) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/inspiration/word-pro");
    await expect(
      page.getByRole("button", { name: "查看Word第4页" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "查看Word第4页" }).click();
    await expect(page.locator(".word-actual-page")).toHaveAttribute(
      "src",
      /04.jpg/,
    );
    await page
      .getByRole("region", { name: "每轮检查与修复依据" })
      .locator("summary")
      .first()
      .click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("group", { name: "Word专业文稿准备" }),
    ).toBeVisible();
  }
  await page.screenshot({
    path: "../../.cache/word-mobile.png",
    fullPage: true,
  });
});
test("corrupt Word evidence fails visibly without invented pages; retry returns validated local metadata", async ({
  page,
}) => {
  await page.route(
    "**/word-examples/word-pro/business-report/word-quality-report.json",
    (r) =>
      r.fulfill({
        json: {
          schemaVersion: 1,
          renderer: {
            pageCount: 999,
            pages: [{ file: "https://invalid.example/track.jpg" }],
          },
        },
      }),
  );
  await page.goto("/inspiration/word-pro");
  await expect(page.getByRole("alert")).toContainText("无效");
  await expect(page.locator(".word-actual-page")).toHaveCount(0);
  await page.unroute(
    "**/word-examples/word-pro/business-report/word-quality-report.json",
  );
  await page.getByRole("button", { name: "重试读取Word证据" }).click();
  await expect(page.locator(".word-actual-page")).toBeVisible();
});
