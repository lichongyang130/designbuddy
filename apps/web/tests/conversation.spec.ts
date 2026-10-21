import { test, expect, type Page } from "@playwright/test";
import { setMode, setPermission } from "./helpers/home";

const answer = "你好！我是 **WorkBuddy**，你的 AI 搭档。\n\n我可以协助你整理资料、写作、分析问题和设计页面。\n\n1. **我该叫什么？** 你可以给我起一个名字。\n2. **该怎么称呼你？** 告诉我你喜欢的称呼。\n\n请告诉我接下来想完成什么任务。";
const sse = (text = answer) => `data: ${JSON.stringify({ model: "test-chat-model", choices: [{ delta: { content: text }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`;
async function ask(page: Page, text = "自我介绍") {
  await page.goto("/");
  await page.getByRole("textbox", { name: "任务描述", exact: true }).fill(text);
  await page.getByRole("button", { name: "开始任务", exact: true }).click();
  await expect(page).toHaveURL(/\/tasks\//);
}

test("homepage submission shows one conversational request, real progress and Markdown", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let calls = 0;
  await page.route("**/api/chat", async (route) => { calls++; await gate; await route.fulfill({ contentType: "text/event-stream", body: sse() }); });
  await ask(page);
  await expect(page.getByRole("main", { name: "任务对话" })).toBeVisible();
  await expect(page.locator(".task-user-message")).toHaveText("自我介绍");
  await expect(page.locator(".task-progress summary")).toContainText("正在思考");
  await expect(page.getByRole("button", { name: "停止生成", exact: true })).toBeVisible();
  release();
  await expect(page.locator(".task-progress summary")).toContainText("已完成");
  await expect(page.locator(".task-reply-markdown strong").first()).toHaveText("WorkBuddy");
  await expect(page.locator(".task-reply-markdown ol li")).toHaveCount(2);
  await expect(page.locator(".task-reply-meta")).toContainText("test-chat-model");
  expect(calls).toBe(1);
  await page.reload();
  await expect(page.locator(".task-reply-markdown")).toContainText("你的 AI 搭档");
  expect(calls).toBe(1);
  await expect(page.locator(".home-buddy, .top-promo")).toHaveCount(0);
});

test("streamed chunks update progressively, ignore private reasoning, and stop cleanly", async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      if (String(input).endsWith("/api/chat")) {
        const encoder = new TextEncoder();
        return new Response(new ReadableStream({ start(controller) {
          const reasoning = `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: "PRIVATE_REASONING_MUST_NOT_APPEAR" } }] })}\n\n`;
          const content = `data: ${JSON.stringify({ model: "stream-test", choices: [{ delta: { content: "正在逐步返回的中文回复。" } }] })}\n\n`;
          const bytes = encoder.encode(reasoning + content);
          // Split inside the UTF-8 data, as real network reads can do.
          controller.enqueue(bytes.slice(0, bytes.length - 14));
          const chunkTimer = setTimeout(() => controller.enqueue(bytes.slice(bytes.length - 14)), 80);
          const doneTimer = setTimeout(() => { controller.enqueue(encoder.encode("data: [DONE]\n\n")); controller.close(); }, 15_000);
          init?.signal?.addEventListener("abort", () => { clearTimeout(chunkTimer); clearTimeout(doneTimer); controller.error(new DOMException("Aborted", "AbortError")); }, { once: true });
        } }), { headers: { "Content-Type": "text/event-stream" } });
      }
      return original(input, init);
    };
  });
  await ask(page, "测试流式回复");
  await expect(page.locator(".task-reply-markdown")).toContainText("正在逐步返回的中文回复。");
  await expect(page.locator(".task-progress summary")).toContainText("正在回复");
  await expect(page.locator("body")).not.toContainText("PRIVATE_REASONING_MUST_NOT_APPEAR");
  await page.getByRole("button", { name: "停止生成", exact: true }).click();
  await expect(page.locator(".task-progress summary")).toContainText("已停止");
  await expect(page.locator(".task-message-error")).toContainText("收到的内容已保留");
  await page.reload();
  await expect(page.locator(".task-progress summary")).toContainText("已停止");
  await expect(page.locator(".task-reply-markdown")).toContainText("中文回复");
});

test("failure and retry do not duplicate the question or fake completion", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/chat", (route) => ++calls === 1
    ? route.fulfill({ status: 503, json: { error: "测试服务未配置" } })
    : route.fulfill({ contentType: "text/event-stream", body: sse() }));
  await ask(page);
  await expect(page.locator(".task-progress summary")).toContainText("回复失败");
  await expect(page.getByRole("alert")).toContainText("测试服务未配置");
  await page.getByRole("button", { name: "重新生成", exact: true }).click();
  await expect(page.locator(".task-progress summary")).toContainText("已完成");
  await expect(page.locator(".task-user-message")).toHaveCount(1);
  await expect(page.locator(".task-assistant-message")).toHaveCount(1);
  expect(calls).toBe(2);
});

test("local policy sends no AI request; follow-ups respect Chinese IME and carry context", async ({ page }) => {
  const payloads: Array<{ messages: Array<{ role: string; content: string }> }> = [];
  await page.route("**/api/chat", (route) => { payloads.push(route.request().postDataJSON()); return route.fulfill({ contentType: "text/event-stream", body: sse("收到，请继续。") }); });
  await page.goto("/");
  await page.getByRole("textbox", { name: "任务描述", exact: true }).fill("仅本地测试");
  await setPermission(page, "仅本地");
  await page.getByRole("button", { name: "开始任务", exact: true }).click();
  await expect(page.locator(".task-progress summary")).toContainText("仅本地");
  expect(payloads).toHaveLength(0);
  await page.getByLabel("任务权限", { exact: true }).selectOption("默认权限");
  await page.getByRole("button", { name: "重新生成", exact: true }).click();
  await expect(page.locator(".task-progress summary")).toContainText("已完成");
  const composer = page.getByRole("textbox", { name: "继续描述任务", exact: true });
  await composer.fill("继续回答");
  await composer.dispatchEvent("keydown", { key: "Enter", code: "Enter", isComposing: true });
  expect(payloads).toHaveLength(1);
  await composer.press("Enter");
  await expect(page.locator(".task-assistant-message")).toHaveCount(2);
  await expect(page.locator(".task-progress summary").last()).toContainText("已完成");
  expect(payloads[1].messages.map((item) => item.role)).toEqual(["user", "assistant", "user"]);
  expect(payloads[1].messages.at(-1)?.content).toBe("继续回答");
});

test("design mode still saves generated files and opens the editor explicitly", async ({ page }) => {
  await page.route("**/api/generation", (route) => route.fulfill({ json: { model: "design-test", files: [{ path: "index.html", content: "<!doctype html><html><body><h1>生成的页面</h1></body></html>", language: "html" }] } }));
  await page.goto("/");
  await setMode(page, "设计制作");
  await page.getByRole("textbox", { name: "任务描述", exact: true }).fill("设计一个首页");
  await page.getByRole("button", { name: "开始任务", exact: true }).click();
  await expect(page.locator(".task-progress summary")).toContainText("已完成");
  await expect(page.locator(".task-reply-markdown")).toContainText("1 个项目文件");
  await page.getByRole("button", { name: "打开生成的项目", exact: true }).click();
  await expect(page).toHaveURL(/\/editor\//);
});

test("unexpected end of stream keeps the partial answer and reports interruption", async ({ page }) => {
  await page.route("**/api/chat", (route) => route.fulfill({ contentType: "text/event-stream", body: `data: ${JSON.stringify({ choices: [{ delta: { content: "部分回复" } }] })}\n\n` }));
  await ask(page);
  await expect(page.locator(".task-reply-markdown")).toContainText("部分回复");
  await expect(page.locator(".task-progress summary")).toContainText("回复失败");
  await expect(page.getByRole("alert")).toContainText("完成前中断");
});

test("reply feedback, search and task history work without executing Markdown HTML", async ({ page }) => {
  await page.route("**/api/chat", (route) => route.fulfill({ contentType: "text/event-stream", body: sse(`${answer}\n\n<script>window.badTaskScript=true</script>\n\n![remote](https://not-requested.example/image.png)`) }));
  let remoteRequests = 0;
  await page.route("https://not-requested.example/**", (route) => { remoteRequests++; return route.abort(); });
  await ask(page);
  await expect(page.locator(".task-progress summary")).toContainText("已完成");
  await page.getByRole("button", { name: "赞同回复", exact: true }).click();
  await expect(page.getByRole("button", { name: "赞同回复", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => "badTaskScript" in window)).toBe(false);
  expect(remoteRequests).toBe(0);
  await page.getByRole("button", { name: "搜索对话", exact: true }).click();
  await page.getByRole("textbox", { name: "查找对话内容", exact: true }).fill("搭档");
  await expect(page.locator(".task-search")).toContainText("1 条匹配");
  await page.getByRole("button", { name: "任务历史", exact: true }).click();
  await expect(page.getByRole("complementary", { name: "最近任务" })).toContainText("自我介绍");
});

for (const width of [320, 375, 768, 1018, 1440]) {
  test(`conversation has usable fixed composer and no overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/api/chat", (route) => route.fulfill({ contentType: "text/event-stream", body: sse() }));
    await ask(page);
    await expect(page.locator(".task-progress summary")).toContainText("已完成");
    await expect(page.getByRole("textbox", { name: "继续描述任务", exact: true })).toBeVisible();
    const composer = await page.locator(".task-composer").boundingBox();
    expect(composer!.x + composer!.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
