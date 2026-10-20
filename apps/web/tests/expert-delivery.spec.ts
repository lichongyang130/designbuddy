import { unzipSync, strFromU8 } from "fflate";
import sharp from "sharp";
import { test, expect, type Page } from "@playwright/test";
import { wordExample } from "../../../shared/wordDocument";
import { mkdir } from "node:fs/promises";
const panel = (page: Page) =>
  page.getByRole("region", { name: "专家制作与交付", exact: true });
const desk = (page: Page) =>
  page.getByRole("region", { name: "真实技能执行台" });
async function ask(page: Page, goal: string) {
  await page.goto("/");
  await page.getByRole("textbox", { name: "任务描述", exact: true }).fill(goal);
  await page.getByRole("button", { name: "开始任务", exact: true }).click();
  await expect(page).toHaveURL(/\/tasks\//);
}
const sse =
  'data: {"choices":[{"delta":{"content":"这是咨询回答，不宣称调用工具。"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n';

test("consultation stays chat while actual deliverables enter a persisted expert plan without automatic paid calls", async ({
  page,
}) => {
  let chats = 0,
    executions = 0;
  await page.route("**/api/chat", (route) => {
    chats++;
    return route.fulfill({ contentType: "text/event-stream", body: sse });
  });
  page.on("request", (r) => {
    if (
      /\/execute$|\/word-draft$|\/api\/generation$/.test(r.url()) &&
      r.method() === "POST"
    )
      executions++;
  });
  await ask(page, "如何制作PPT汇报");
  await expect(page.locator(".task-reply-markdown")).toContainText("咨询回答");
  expect(chats).toBe(1);
  await expect(panel(page)).toHaveCount(0);
  await ask(page, "帮我制作一份可编辑PPTX汇报");
  await expect(panel(page)).toContainText("主责：汇报提案专家");
  const evidence = page.getByRole("region", {
    name: "专家制作计划",
    exact: true,
  });
  await evidence.getByText("专业方法、检查要求与边界", { exact: true }).click();
  await expect(evidence).toContainText("专家配置");
  expect(executions).toBe(0);
  expect(chats).toBe(1);
  const taskId = page.url().split("/").at(-1)!;
  const first = await (
    await page.request.get(`/api/expert-task-plans?taskId=${taskId}`)
  ).json();
  expect(first.plans).toHaveLength(1);
  await page.reload();
  await expect(panel(page)).toContainText("主责：汇报提案专家");
  const restored = await (
    await page.request.get(`/api/expert-task-plans?taskId=${taskId}`)
  ).json();
  expect(restored.plans[0].id).toBe(first.plans[0].id);
  expect(executions).toBe(0);
});

test("Word expert executes real source-bound input and exposes DOCX PDF and version evidence inside the task", async ({
  page,
}) => {
  test.setTimeout(90000);
  await ask(page, "根据实际原稿生成可编辑Word报告");
  await expect(panel(page)).toContainText("主责：文档整理专家");
  await desk(page).getByLabel("准备方式", { exact: true }).selectOption("json");
  await desk(page)
    .getByLabel("上传Word结构化JSON", { exact: true })
    .setInputFiles({
      name: "source-bound.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(wordExample())),
    });
  await desk(page)
    .getByRole("button", { name: "将Word文稿准备为输入", exact: true })
    .click();
  await expect(
    desk(page).getByRole("button", { name: "上传并执行技能", exact: true }),
  ).toBeDisabled();
  await desk(page)
    .getByRole("checkbox", { name: /我同意上传材料/ })
    .check();
  await desk(page)
    .getByRole("button", { name: "上传并执行技能", exact: true })
    .click();
  await expect(
    desk(page).getByRole("button", { name: "下载 document.docx", exact: true }),
  ).toBeVisible({ timeout: 60000 });
  await expect(
    desk(page).getByRole("button", { name: "下载 document.pdf", exact: true }),
  ).toBeVisible();
  await expect(panel(page)).toContainText("V1");
  await expect(panel(page)).toContainText("已关联真实运行");
  const taskId = page.url().split("/").at(-1)!;
  const history = await (
    await page.request.get(`/api/expert-task-plans?taskId=${taskId}`)
  ).json();
  expect(history.executions).toHaveLength(1);
  expect(history.executions[0].inputHash).toHaveLength(64);
  await mkdir("../../docs/verification/expert-execution-2026-10-20", {
    recursive: true,
  });
  await page.screenshot({
    path: "../../docs/verification/expert-execution-2026-10-20/word-real-delivery.png",
    fullPage: true,
  });
  await page.reload();
  await expect(
    desk(page).getByRole("button", { name: "下载 document.docx", exact: true }),
  ).toBeVisible();
  await expect(
    desk(page).getByRole("checkbox", { name: /我同意上传材料/ }),
  ).not.toBeChecked();
  await desk(page)
    .getByRole("button", { name: "载入此版本输入并继续修改", exact: true })
    .click();
  await desk(page)
    .getByRole("button", { name: "编辑已载入的实际结构化稿", exact: true })
    .click();
  const json = desk(page).getByRole("textbox", {
    name: "实际Word结构化内容",
    exact: true,
  });
  const revised = JSON.parse(await json.inputValue());
  revised.title = "用户实际修改后的第二版标题";
  await json.fill(JSON.stringify(revised));
  await desk(page)
    .getByRole("button", { name: "将Word文稿准备为输入", exact: true })
    .click();
  await desk(page)
    .getByRole("checkbox", { name: /我同意上传材料/ })
    .check();
  await desk(page)
    .getByRole("button", { name: "上传并执行技能", exact: true })
    .click();
  await expect(panel(page)).toContainText("V2");
  await expect(
    desk(page).getByRole("button", { name: "下载 document.docx", exact: true }),
  ).toBeVisible({ timeout: 60000 });
  const after = await (
    await page.request.get(`/api/expert-task-plans?taskId=${taskId}`)
  ).json();
  expect(after.executions[0].parentId).toBe(after.executions[1].id);
  expect(after.executions[0].inputHash).not.toBe(after.executions[1].inputHash);
  const run = await (
    await page.request.get(`/api/skill-runs/${after.executions[0].runId}`)
  ).json();
  const docx = run.artifacts.find(
    (a: { name: string }) => a.name === "document.docx",
  );
  const bytes = await (
    await page.request.get(`/api/skill-runs/${run.id}/artifacts/${docx.id}`)
  ).body();
  expect(strFromU8(unzipSync(bytes)["word/document.xml"])).toContain(
    "用户实际修改后的第二版标题",
  );
});

test("changing structured text or skill parameters revokes approval, including AI-generated content", async ({
  page,
}) => {
  await ask(page, "生成一份可编辑Word报告");
  await expect(desk(page)).toBeVisible();
  await desk(page)
    .getByRole("button", {
      name: "载入本类型原创示例（不上传、不执行）",
      exact: true,
    })
    .click();
  await desk(page)
    .getByRole("button", { name: "将Word文稿准备为输入", exact: true })
    .click();
  await desk(page)
    .getByRole("checkbox", { name: /我同意上传材料/ })
    .check();
  await desk(page)
    .getByLabel("文档类型", { exact: true })
    .selectOption("project-plan");
  await expect(
    desk(page).getByRole("checkbox", { name: /我同意上传材料/ }),
  ).not.toBeChecked();
  await expect(
    desk(page).getByRole("button", { name: "上传并执行技能", exact: true }),
  ).toBeDisabled();
});

test("follow-up delivery changes update the actual task plan rather than replying that a nonexistent edit is finished", async ({
  page,
}) => {
  let chats = 0;
  await page.route("**/api/chat", (route) => {
    chats++;
    return route.fulfill({ contentType: "text/event-stream", body: sse });
  });
  await ask(page, "生成项目计划");
  await expect(panel(page)).toContainText("主责：产品需求专家");
  await page
    .getByRole("textbox", { name: "继续描述任务", exact: true })
    .fill("保留原稿，不编造负责人和截止日期");
  await page.getByRole("button", { name: "发送消息", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "专家制作计划" }),
  ).toContainText("不编造负责人");
  await expect(page.locator(".task-notice")).toContainText(
    "尚未修改文件或调用模型",
  );
  expect(chats).toBe(0);
});

test("an incompatible manually locked expert is not silently replaced", async ({
  page,
}) => {
  await page.goto("/experts/brand");
  await page.getByRole("button", { name: "用于当前任务", exact: true }).click();
  await page
    .getByRole("textbox", { name: "任务描述", exact: true })
    .fill("生成可编辑Word报告");
  await page.getByRole("button", { name: "开始任务", exact: true }).click();
  await expect(panel(page).getByRole("alert")).toContainText("当前专家未绑定");
  await expect(desk(page)).toHaveCount(0);
  await panel(page)
    .getByRole("button", { name: "明确允许按成果重新分配主责", exact: true })
    .click();
  await expect(panel(page)).toContainText("主责：文档整理专家");
});

test("custom expert receives a real server binding and remains the named lead, with explicit executor delegation", async ({
  page,
}) => {
  const name = `财务核对${Date.now()}`;
  let id = "";
  try {
    await page.goto("/experts/create");
    await page.getByLabel("专家名称", { exact: true }).fill(name);
    await page
      .getByLabel("职责描述", { exact: true })
      .fill("只核对原始数据，不猜测金额。");
    await page
      .getByRole("combobox", { name: "后台能力模板", exact: true })
      .selectOption("data");
    await page.getByRole("button", { name: "保存专家", exact: true }).click();
    await expect(page).toHaveURL(/\/experts\/[a-f0-9-]+$/);
    id = page.url().split("/").at(-1)!;
    await expect(page.getByLabel("自建专家执行状态")).toContainText(
      "已绑定后台制作能力",
    );
    await page
      .getByRole("button", { name: "用于当前任务", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "任务描述", exact: true })
      .fill("分析CSV表格并生成表格报告");
    await page.getByRole("button", { name: "开始任务", exact: true }).click();
    await expect(panel(page)).toContainText(`主责：${name}`);
    await expect(panel(page)).toContainText("执行角色 data");
    await expect(
      desk(page).getByRole("combobox", { name: "执行技能", exact: true }),
    ).toHaveValue("table.analyze");
  } finally {
    if (id)
      expect(
        (
          await page.request.delete(`/api/expert-bindings/${id}`, {
            headers: { Origin: new URL(page.url()).origin },
          })
        ).status(),
      ).toBe(200);
  }
});

test("local-only and identity changes never auto-submit a production plan or carry previous account execution rights", async ({
  page,
}) => {
  let plans = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().endsWith("/api/expert-task-plans"))
      plans++;
  });
  await page.goto("/");
  await page.getByLabel("任务权限", { exact: true }).selectOption("仅本地");
  await page
    .getByRole("textbox", { name: "任务描述", exact: true })
    .fill("生成可编辑Word报告");
  await page.getByRole("button", { name: "开始任务", exact: true }).click();
  await expect(page.getByText(/仅本地模式：不会打开后台执行台/)).toBeVisible();
  expect(plans).toBe(0);
  await page.getByLabel("任务权限", { exact: true }).selectOption("默认权限");
  await expect(panel(page)).toContainText("主责：文档整理专家");
  await page.evaluate(() =>
    window.dispatchEvent(new Event("designbuddy:server-identity")),
  );
  await expect(
    page.getByText(/服务端身份已变化，已关闭此任务的执行入口/),
  ).toBeVisible();
  await expect(panel(page)).toHaveCount(0);
});

test("optional Word writer prepares an editable schema only after explicit external consent (controlled model response fixture)", async ({
  page,
}) => {
  let calls = 0,
    executions = 0;
  await page.route("**/word-draft", (route) => {
    calls++;
    expect(route.request().postDataJSON().externalConsent).toBe(true);
    return route.fulfill({
      json: { document: wordExample(), model: "controlled-ui-fixture" },
    });
  });
  page.on("request", (r) => {
    if (r.url().endsWith("/execute")) executions++;
  });
  await ask(page, "生成可编辑Word报告");
  const writer = page.locator(".word-task-draft");
  await writer.locator("summary").click();
  await writer.getByLabel("文档标题", { exact: true }).fill("合成材料验证");
  await writer.getByLabel("目标读者", { exact: true }).fill("测试审阅者");
  await writer.getByLabel("真实原稿名称", { exact: true }).fill("facts.txt");
  await writer
    .getByLabel("实际提供的原稿全文", { exact: true })
    .fill("合成样例，没有真实客户或业务数字。");
  const button = writer.getByRole("button", {
    name: "按专家方法准备正文（一次模型调用）",
    exact: true,
  });
  await expect(button).toBeDisabled();
  expect(calls).toBe(0);
  await writer.getByRole("checkbox").check();
  await button.click();
  await expect(
    writer.getByRole("textbox", { name: "专家Word结构化正文", exact: true }),
  ).toBeVisible();
  expect(calls).toBe(1);
  expect(executions).toBe(0);
  await expect(writer.getByRole("checkbox")).not.toBeChecked();
  await writer
    .getByRole("button", { name: "将审阅后的正文准备为排版输入", exact: true })
    .click();
  await expect(desk(page)).toContainText("expert-word-draft.json");
  await expect(
    desk(page).getByRole("checkbox", { name: /我同意上传材料/ }),
  ).not.toBeChecked();
});

test("marketing expert chains actual uploaded pixels, restores its result, and reuses real inputs for a separately confirmed revision", async ({
  page,
}) => {
  test.setTimeout(90000);
  await ask(page, "用实际图片制作营销海报");
  await expect(panel(page)).toContainText("主责：营销物料专家");
  const bytes = await sharp({
    create: { width: 120, height: 80, channels: 3, background: "#467853" },
  })
    .png()
    .toBuffer();
  await panel(page).getByLabel("实际图片", { exact: true }).setInputFiles({
    name: "synthetic-sample.png",
    mimeType: "image/png",
    buffer: bytes,
  });
  await panel(page)
    .getByLabel("海报标题", { exact: true })
    .fill("合成样例活动");
  await panel(page)
    .getByRole("button", { name: "下一步：确认", exact: true })
    .click();
  await panel(page)
    .getByRole("button", { name: "确认并执行", exact: true })
    .click();
  await expect(
    panel(page).getByRole("link", { name: "poster-portrait.png", exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await expect(
    panel(page).getByRole("link", { name: "image-480w.webp", exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await page.reload();
  await expect(
    panel(page).getByRole("link", { name: "poster-portrait.png", exact: true }),
  ).toBeVisible();
  await panel(page)
    .getByRole("button", { name: "基于此版本继续修改", exact: true })
    .click();
  await expect(panel(page).getByLabel("海报标题", { exact: true })).toHaveValue(
    "合成样例活动",
  );
  await panel(page)
    .getByLabel("海报标题", { exact: true })
    .fill("实际修改后的海报标题");
  await panel(page)
    .getByRole("button", { name: "下一步：确认", exact: true })
    .click();
  await panel(page)
    .getByRole("button", { name: "确认并执行", exact: true })
    .click();
  await expect(panel(page)).toContainText("V2");
  await expect(
    panel(page).getByRole("link", { name: "image-480w.webp", exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await page.screenshot({
    path: "../../docs/verification/expert-execution-2026-10-20/marketing-real-delivery.png",
    fullPage: true,
  });
});

test("explicit homepage skill selection carries an executable ID instead of only inserting its name into chat", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "任务描述", exact: true })
    .fill("核对这份实际材料");
  await page.getByRole("button", { name: "添加附件", exact: true }).click();
  await page.getByRole("menuitem", { name: "技能", exact: true }).click();
  await page
    .getByRole("button", { name: "表格清洗与统计", exact: true })
    .click();
  await page.getByRole("button", { name: "开始任务", exact: true }).click();
  await expect(panel(page)).toContainText("主责：数据分析专家");
  await expect(
    panel(page).getByRole("combobox", { name: "制作场景", exact: true }),
  ).toHaveValue("table.analyze");
  await expect(
    desk(page).getByRole("combobox", { name: "执行技能", exact: true }),
  ).toHaveValue("table.analyze");
});

for (const width of [390, 1440])
  test(`production plan is readable without horizontal overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await ask(page, "生成项目计划");
    await expect(panel(page)).toContainText("主责：产品需求专家");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    if (width === 390) {
      await mkdir("../../docs/verification/expert-execution-2026-10-20", {
        recursive: true,
      });
      await page.screenshot({
        path: "../../docs/verification/expert-execution-2026-10-20/mobile-plan.png",
        fullPage: true,
      });
    }
  });
