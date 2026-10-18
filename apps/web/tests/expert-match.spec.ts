import { expect, test, type Page } from "@playwright/test";
const dataMatch = { kind: "match", expertId: "data", collaboratorIds: [], reason: "需要核对报销表的金额与口径，而不是做视觉设计。", responsibilities: ["核对金额与字段口径", "找出重复与缺失记录"], missing: ["报销原始明细"] };
const slideMatch = { kind: "match", expertId: "slides", collaboratorIds: [], reason: "目标是面向管理层的产品演示。", responsibilities: ["组织逐页汇报内容"], missing: [] };
const sse = 'data: {"choices":[{"delta":{"content":"已收到任务规范。"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n';
const trigger = (page: Page) => page.locator(".home-expert-trigger");
const input = (page: Page) => page.getByRole("textbox", { name: "任务描述", exact: true });
async function enable(page: Page) {
  await trigger(page).click();
  await page.getByRole("button", { name: "允许并开启自动匹配", exact: true }).click();
  await input(page).click();
}
async function captureChat(page: Page) {
  const bodies: any[] = [];
  await page.route("**/api/chat", async route => { bodies.push(route.request().postDataJSON()); await route.fulfill({ contentType: "text/event-stream", body: sse }); });
  return bodies;
}

test("explicit consent gates network; only readable attachment excerpts are sent and disabling stops matching", async ({ page }) => {
  const requests: any[] = [];
  await page.route("**/api/expert-match", async route => { requests.push(route.request().postDataJSON()); await route.fulfill({ json: dataMatch }); });
  await page.goto("/");
  await input(page).fill("整理设计部门的报销表");
  await page.locator('input.visually-hidden-input[type="file"]').setInputFiles([
    { name: "numbers.csv", mimeType: "text/csv", buffer: Buffer.from("部门,金额\n设计,100") },
    { name: "private.pdf", mimeType: "application/pdf", buffer: Buffer.from("UNREAD-PDF-CONTENT") },
  ]);
  await expect(page.locator(".attachment-list")).toContainText("numbers.csv ✓");
  await page.waitForTimeout(1100);
  expect(requests).toHaveLength(0);
  await enable(page);
  await expect(trigger(page)).toContainText("推荐：数据分析专家");
  expect(requests).toHaveLength(1);
  expect(requests[0].consent).toBe(true);
  expect(requests[0].attachmentContext).toContain("设计,100");
  expect(requests[0].attachmentContext).not.toMatch(/private.pdf|UNREAD/);
  expect(requests[0].experts.find((p: any) => p.id === "data").checks).toContain("不将相关性写成因果，不编造缺失数据");
  await trigger(page).click();
  await expect(page.getByLabel("专家匹配详情")).toContainText(dataMatch.reason);
  await page.getByRole("button", { name: "关闭自动匹配", exact: true }).click();
  await input(page).fill("修改后的报销表需求");
  await page.waitForTimeout(1100);
  expect(requests).toHaveLength(1);
  expect(await page.evaluate(() => localStorage.getItem("designbuddy.expert-match-consent.v1"))).toBeNull();
});

test("auto recommendation really carries methods, checks and responsibilities into execution", async ({ page }) => {
  await page.route("**/api/expert-match", route => route.fulfill({ json: dataMatch }));
  const chats = await captureChat(page);
  await page.goto("/");
  await input(page).fill("整理设计部门的报销表，核对金额，不要做图");
  await enable(page);
  await expect(trigger(page)).toContainText("推荐：数据分析专家");
  expect(chats).toHaveLength(0);
  await page.getByRole("button", { name: "开始任务", exact: true }).click();
  await expect.poll(() => chats.length).toBe(1);
  const text = chats[0].messages.at(-1).content;
  for (const part of ["推荐专家：数据分析专家", "工作方法", "统计粒度", "交付核验", "核对金额与字段口径", "不是外部工具授权"]) expect(text).toContain(part);
  await expect(page.locator(".task-user-message")).toHaveText("整理设计部门的报销表，核对金额，不要做图");
});

test("simple work is sent without forcing an expert", async ({ page }) => {
  await page.route("**/api/expert-match", route => route.fulfill({ json: { kind: "general", reason: "单句礼貌改写可以直接完成。" } }));
  const chats = await captureChat(page);
  await page.goto("/"); await input(page).fill("把这句话改得礼貌一些：快点给我。"); await enable(page);
  await expect(trigger(page)).toHaveText("直接处理即可");
  await page.getByRole("button", { name: "开始任务", exact: true }).click();
  await expect.poll(() => chats.length).toBe(1);
  expect(chats[0].messages.at(-1).content).not.toContain("推荐专家");
});

for (const custom of [false, true]) {
  test(`one essential clarification preserves draft and reaches execution (${custom ? "custom" : "option"})`, async ({ page }) => {
    const requests: any[] = [];
    await page.route("**/api/expert-match", async route => {
      const body = route.request().postDataJSON(); requests.push(body);
      await route.fulfill({ json: body.answer ? slideMatch : { kind: "clarify", question: "你希望最终做成什么？", options: ["介绍文案", "演示PPT", "宣传图片", "产品网页"] } });
    });
    const chats = await captureChat(page);
    await page.goto("/"); await input(page).fill("帮我做一个产品介绍"); await enable(page);
    await expect(trigger(page)).toHaveText("需要确认需求");
    await page.getByRole("button", { name: "开始任务", exact: true }).click();
    await expect(page).toHaveURL(/\/$/); expect(chats).toHaveLength(0);
    await trigger(page).click();
    if (custom) {
      await page.getByRole("textbox", { name: "专家匹配补充需求" }).fill("给老板看的八页PPT");
      await page.getByRole("button", { name: "确认需求", exact: true }).click();
    } else await page.getByRole("button", { name: "演示PPT", exact: true }).click();
    await expect(trigger(page)).toContainText("推荐：汇报提案专家");
    await expect(input(page)).toHaveValue("帮我做一个产品介绍");
    expect(requests.at(-1).answer).toContain(custom ? "给老板看的八页PPT" : "演示PPT");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "开始任务", exact: true }).click();
    await expect.poll(() => chats.length).toBe(1);
    expect(chats[0].messages.at(-1).content).toContain("已确认的任务要求");
    expect(chats[0].messages.at(-1).content).toContain(custom ? "给老板看的八页PPT" : "演示PPT");
  });
}

test("manual selection locks across typing/mode changes and can return to auto", async ({ page }) => {
  let count = 0;
  await page.route("**/api/expert-match", route => { count++; return route.fulfill({ json: dataMatch }); });
  await page.goto("/"); await input(page).fill("核对报销表"); await enable(page);
  await expect(trigger(page)).toContainText("推荐：数据分析专家");
  await trigger(page).click(); await page.getByRole("button", { name: "使用推荐并锁定", exact: true }).click();
  await expect(trigger(page)).toContainText("数据分析专家");
  await trigger(page).click();
  await expect(page.getByLabel("专家匹配详情")).toContainText("已手动指定");
  await page.keyboard.press("Escape");
  await input(page).fill("帮我设计一张宣传海报");
  await page.getByRole("tab", { name: "设计制作", exact: true }).click();
  await page.waitForTimeout(1100);
  await expect(trigger(page)).toContainText("数据分析专家");
  expect(count).toBe(1);
  await trigger(page).click(); await page.getByRole("button", { name: "恢复自动匹配", exact: true }).click();
  await expect.poll(() => count).toBe(2);
  await expect(trigger(page)).toContainText("推荐：数据分析专家");
});

test("stale async response cannot overwrite newer requirements or run a stale expert", async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  let requests = 0;
  await page.route("**/api/expert-match", async route => {
    requests++;
    if (requests === 1) { await pending; await route.fulfill({ json: dataMatch }).catch(() => {}); }
    else await route.fulfill({ json: { kind: "general", reason: "礼貌改写不需要专家。" } });
  });
  const chats = await captureChat(page);
  await page.goto("/"); await input(page).fill("核对报销表"); await enable(page);
  await expect.poll(() => requests).toBe(1);
  await input(page).fill("把你好改得礼貌一点");
  await expect(trigger(page)).not.toContainText("数据分析专家");
  await expect(trigger(page)).toHaveText("直接处理即可");
  release(); await page.waitForTimeout(150);
  await expect(trigger(page)).toHaveText("直接处理即可");
  await page.getByRole("button", { name: "开始任务", exact: true }).click();
  await expect.poll(() => chats.length).toBe(1);
  expect(chats[0].messages.at(-1).content).not.toContain("推荐专家");
});

test("failure is honest, rule suggestion is opt-in, retry is possible and sending remains available", async ({ page }) => {
  let count = 0;
  await page.route("**/api/expert-match", route => { count++; return route.fulfill({ status: 502, json: { error: "AI 服务尚未配置" } }); });
  const chats = await captureChat(page);
  await page.goto("/"); await input(page).fill("核对报销表"); await enable(page);
  await expect(trigger(page)).toHaveText("暂未完成匹配"); await trigger(page).click();
  await expect(page.getByLabel("专家匹配详情")).toContainText("本地规则建议 · 非模型匹配");
  await page.getByRole("button", { name: "重试匹配", exact: true }).click();
  await expect.poll(() => count).toBe(2);
  await expect(trigger(page)).toHaveText("暂未完成匹配");
  await page.keyboard.press("Escape"); await page.getByRole("button", { name: "开始任务", exact: true }).click();
  await expect.poll(() => chats.length).toBe(1);
  expect(chats[0].messages.at(-1).content).not.toContain("推荐专家");
});

test("local-only always prevents matching even with saved consent, explicit fallback saves full contract locally", async ({ page }) => {
  let requests = 0;
  await page.addInitScript(() => localStorage.setItem("designbuddy.expert-match-consent.v1", "allowed"));
  await page.route("**/api/expert-match", route => { requests++; return route.fulfill({ json: dataMatch }); });
  const chats = await captureChat(page);
  await page.goto("/"); await page.getByLabel("任务权限", { exact: true }).selectOption("仅本地");
  await input(page).fill("核对报销表"); await trigger(page).click();
  await expect(page.getByLabel("专家匹配详情")).toContainText("仅本地模式不会向模型发送");
  await page.getByRole("button", { name: "使用本地建议并锁定", exact: true }).click();
  await page.keyboard.press("Escape"); await page.getByRole("button", { name: "开始任务", exact: true }).click();
  await expect(page).toHaveURL(/\/tasks\//);
  await expect(page.locator(".task-reply-markdown")).toContainText("没有发送 AI 网络请求");
  expect(requests).toBe(0); expect(chats).toHaveLength(0);
  const contents = await page.evaluate(() => Object.values(localStorage).join("\n"));
  expect(contents).toContain("交付核验"); expect(contents).toContain("数据分析专家");
});

test("invalid model output fails closed instead of assigning invented experts", async ({ page }) => {
  await page.route("**/api/expert-match", route => route.fulfill({ json: { ...dataMatch, expertId: "not-in-catalog" } }));
  await page.goto("/"); await input(page).fill("核对报销表"); await enable(page);
  await expect(trigger(page)).toHaveText("暂未完成匹配");
  await trigger(page).click(); await expect(page.getByLabel("专家匹配详情")).toContainText("格式不正确");
});

for (const width of [320, 375, 768, 1440]) {
  test(`matching reason/question panel stays within ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.route("**/api/expert-match", route => route.fulfill({ json: dataMatch }));
    await page.goto("/"); await input(page).fill("核对报销表，并分析销售变化"); await enable(page);
    await expect(trigger(page)).toContainText("推荐：数据分析专家"); await trigger(page).click();
    const menu = page.getByRole("dialog", { name: "专家选项", exact: true });
    await expect(menu).toBeVisible();
    const box = (await menu.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width); expect(box.y + box.height).toBeLessThanOrEqual(812);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await menu.getByRole("button", { name: "手动选择专家", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "搜索专家" })).toBeFocused();
    await menu.getByRole("button", { name: "返回匹配详情", exact: true }).click();
    if (width === 1440) await page.screenshot({ path: "../../.cache/expert-match-desktop.png" });
    await page.keyboard.press("Escape"); await expect(trigger(page)).toBeFocused();
  });
}

test("changing a matched draft immediately invalidates its expert even when sending before the next match", async ({ page }) => {
  await page.route("**/api/expert-match", route => route.fulfill({ json: dataMatch }));
  const chats = await captureChat(page);
  await page.goto("/"); await input(page).fill("核对报销表"); await enable(page);
  await expect(trigger(page)).toContainText("推荐：数据分析专家");
  await input(page).fill("你好");
  // Freeze the new debounce but retain a real click/submission path.
  await page.clock.install();
  await page.getByRole("button", { name: "开始任务", exact: true }).click();
  await page.clock.runFor(50);
  await expect.poll(() => chats.length).toBe(1);
  expect(chats[0].messages.at(-1).content).not.toContain("数据分析专家");
});

test("turning local-only on cancels a pending match and never reuses its late result", async ({ page }) => {
  let release!: () => void, called = false;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/expert-match", async route => { called = true; await pending; await route.fulfill({ json: dataMatch }).catch(() => {}); });
  await page.goto("/"); await input(page).fill("核对报销表"); await enable(page);
  await expect.poll(() => called).toBe(true);
  await page.getByLabel("任务权限", { exact: true }).selectOption("仅本地");
  release();
  await expect(trigger(page)).toHaveText("仅本地 · 手动选择");
  await page.getByRole("button", { name: "开始任务", exact: true }).click();
  await expect(page).toHaveURL(/\/tasks\//);
  const task = await page.evaluate(() => Object.entries(localStorage).filter(([k]) => k.startsWith("designbuddy.conversation.v1")).map(([, v]) => v).join("\n"));
  expect(task).not.toContain("推荐专家");
});

test("actual expert task overrides a misleading homepage mode without generating a fake webpage", async ({ page }) => {
  let generated = 0;
  await page.route("**/api/expert-match", route => route.fulfill({ json: dataMatch }));
  await page.route("**/api/generation", route => { generated++; return route.abort(); });
  const chats = await captureChat(page);
  await page.goto("/"); await page.getByRole("tab", { name: "设计制作", exact: true }).click();
  await input(page).fill("整理设计部门的报销表"); await enable(page);
  await expect(trigger(page)).toContainText("推荐：数据分析专家");
  await page.getByRole("button", { name: "开始任务", exact: true }).click();
  await expect.poll(() => chats.length).toBe(1); expect(generated).toBe(0);
});

test("web expert uses the web engine even from office, retaining the contract on follow-up", async ({ page }) => {
  const generated: any[] = [];
  await page.route("**/api/expert-match", route => route.fulfill({ json: { kind: "match", expertId: "developer", collaboratorIds: [], reason: "需要制作企业官网。", responsibilities: ["实现响应式官网"], missing: [] } }));
  await page.route("**/api/generation", route => {
    generated.push(route.request().postDataJSON());
    return route.fulfill({ json: { model: "test-only", files: [{ path: "index.html", content: "<!doctype html><html><body>Test</body></html>", language: "html" }] } });
  });
  await page.goto("/"); await input(page).fill("制作一个介绍咖啡品牌的企业官网，包含菜单和联系信息"); await enable(page);
  await expect(trigger(page)).toContainText("推荐：全栈开发专家");
  await page.getByRole("button", { name: "开始任务", exact: true }).click();
  await expect.poll(() => generated.length).toBe(1);
  await expect(page.locator(".task-progress summary")).toContainText("已完成");
  await page.getByRole("textbox", { name: "继续描述任务" }).fill("把背景调整为浅灰色");
  await page.getByRole("button", { name: "发送消息", exact: true }).click();
  await expect.poll(() => generated.length).toBe(2);
  for (const request of generated) { expect(request.prompt).toContain("本次专家工作规范"); expect(request.prompt).toContain("校验输入、权限"); }
});
