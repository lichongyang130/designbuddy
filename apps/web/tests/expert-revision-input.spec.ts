import { test, expect } from "@playwright/test";
import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";

// UI restoration fixture only. Every execution endpoint is intercepted; no provider call or fake PPTX success.
test("PPT revision restores actual source and image bytes, uses the new task goal, and requires fresh image rights and both consents", async ({
  page,
}) => {
  const runId = randomUUID();
  const source = Buffer.from(
    "本次实际来源：只讨论已提供的试点材料，不编造收入。",
  );
  const png = await sharp({
    create: { width: 40, height: 30, channels: 3, background: "#51725c" },
  })
    .png()
    .toBuffer();
  const original = Buffer.from(
    JSON.stringify({
      schemaVersion: 1,
      brief: {
        goal: "旧版本目标",
        audience: "原始评审组",
        scenario: "business-report",
        theme: "technology",
        slideCount: 8,
        layoutStyle: "adaptive",
      },
      files: [{ name: "actual-source.md", base64: source.toString("base64") }],
      assets: [
        {
          id: "visual-1",
          name: "actual-image.png",
          base64: png.toString("base64"),
          role: "screenshot",
          usage: "evidence",
          alt: "合成截图测试",
          source: "本地合成样例",
          license: "仅测试",
          permissionConfirmed: true,
        },
      ],
    }),
  );
  let submitted: FormData | undefined;
  await page.route("**/api/skill-runtime", async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    json.skills = json.skills.map((s: { id: string }) =>
      s.id === "slides.create" ? { ...s, status: "ready" } : s,
    );
    await route.fulfill({ response, json });
  });
  await page.route("**/api/expert-task-plans", async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    if (json.plan) {
      json.plan.ready = true;
      json.plan.blockers = [];
    }
    await route.fulfill({ response, json });
  });
  await page.route("**/api/skill-runs?taskId=*", async (route) => {
    const taskId = new URL(route.request().url()).searchParams.get("taskId");
    await route.fulfill({
      json: {
        runs: [
          {
            id: runId,
            taskId,
            expertId: "slides",
            skillId: "slides.create",
            version: "fixture",
            status: "succeeded",
            filename: "original-presentation.json",
            inputHash: createHash("sha256").update(original).digest("hex"),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            options: {
              deduplicate: false,
              parameters: { externalConsent: "yes" },
            },
            permissions: [],
            events: [],
            artifacts: [],
          },
        ],
      },
    });
  });
  await page.route(`**/api/skill-runs/${runId}/input`, (route) =>
    route.fulfill({ contentType: "application/octet-stream", body: original }),
  );
  await page.route("**/api/expert-task-plans/*/execute", async (route) => {
    const r = route.request();
    submitted = await new Request(r.url(), {
      method: "POST",
      headers: { "Content-Type": r.headers()["content-type"] },
      body: r.postDataBuffer()!,
    }).formData();
    await route.fulfill({
      status: 400,
      json: { error: "UI restoration fixture: no model or file execution" },
    });
  });
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "任务描述", exact: true })
    .fill("制作PPT，按新目标复核试点材料");
  await page.getByRole("button", { name: "开始任务", exact: true }).click();
  const desk = page.getByRole("region", { name: "真实技能执行台" });
  await desk
    .getByRole("button", { name: "载入此版本输入并继续修改", exact: true })
    .click();
  const composer = desk.getByRole("group", { name: "商业演示需求与多份材料" });
  await expect(
    composer.getByRole("textbox", { name: "演示目标", exact: true }),
  ).toHaveValue("制作PPT，按新目标复核试点材料");
  await expect(
    composer.getByRole("textbox", { name: "受众与决策背景", exact: true }),
  ).toHaveValue("原始评审组");
  await expect(
    composer.getByRole("list", { name: "演示来源清单" }),
  ).toContainText("actual-source.md");
  const image = composer.getByRole("group", {
    name: "素材 actual-image.png",
    exact: true,
  });
  await expect(image.getByRole("checkbox")).not.toBeChecked();
  await expect(desk.getByLabel("本次演示正文处理授权")).toHaveValue("");
  await expect(
    desk.getByRole("checkbox", { name: /我同意上传材料/ }),
  ).not.toBeChecked();
  await composer
    .getByRole("button", { name: "准备演示输入（尚不上传）", exact: true })
    .click();
  await expect(composer.getByRole("alert")).toContainText("本次使用权限");
  expect(submitted).toBeUndefined();
  await image.getByRole("checkbox").check();
  await composer
    .getByRole("button", { name: "准备演示输入（尚不上传）", exact: true })
    .click();
  await expect(composer.getByRole("status")).toContainText("需求与材料已准备");
  await desk.getByLabel("本次演示正文处理授权").selectOption("yes");
  await desk.getByRole("checkbox", { name: /我同意上传材料/ }).check();
  await desk
    .getByRole("button", { name: "上传并执行技能", exact: true })
    .click();
  await expect(desk.getByRole("alert")).toContainText("UI restoration fixture");
  const input = JSON.parse(await (submitted!.get("file") as File).text());
  expect(input.brief.goal).toBe("制作PPT，按新目标复核试点材料");
  expect(Buffer.from(input.files[0].base64, "base64")).toEqual(source);
  expect(Buffer.from(input.assets[0].base64, "base64")).toEqual(png);
  expect(input.assets[0].permissionConfirmed).toBe(true);
});

test("a manually locked consultation expert stays locked after refresh when the follow-up requests a different file outcome", async ({
  page,
}) => {
  await page.route("**/api/chat", (route) =>
    route.fulfill({
      contentType: "text/event-stream",
      body: 'data: {"choices":[{"delta":{"content":"这是普通咨询回答。"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
    }),
  );
  await page.goto("/experts/brand");
  await page.getByRole("button", { name: "用于当前任务", exact: true }).click();
  await page
    .getByRole("textbox", { name: "任务描述", exact: true })
    .fill("你好");
  await page.getByRole("button", { name: "开始任务", exact: true }).click();
  await expect(page.locator(".task-reply-markdown")).toContainText(
    "普通咨询回答",
  );
  await page.reload();
  await page
    .getByRole("textbox", { name: "继续描述任务", exact: true })
    .fill("生成可编辑Word报告");
  await page.getByRole("button", { name: "发送消息", exact: true }).click();
  const panel = page.getByRole("region", {
    name: "专家制作与交付",
    exact: true,
  });
  await expect(panel.getByRole("alert")).toContainText("当前专家未绑定");
  await expect(
    page.getByRole("region", { name: "真实技能执行台" }),
  ).toHaveCount(0);
  await panel
    .getByRole("button", { name: "明确允许按成果重新分配主责", exact: true })
    .click();
  await expect(panel).toContainText("主责：文档整理专家");
});
