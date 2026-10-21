import { test, expect } from "@playwright/test";

/**
 * Homepage: one input, three examples, recent work.
 *
 * The old page stacked mode tabs, a shortcut row, a plugin rail, two
 * recommendation blocks and a live example gallery above the fold. Those are
 * gone on purpose — these tests keep them gone, and keep the three things that
 * remain honest (examples never send, the draft decides the mode, history is
 * reachable).
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("one composer, three examples, nothing else competing with the input", async ({ page }) => {
  await expect(page.getByRole("heading", { name: /DesignBuddy 让工作更高效/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "开始任务" })).toBeDisabled();

  const sidebar = await page.locator(".app-sidebar").boundingBox();
  const composer = await page.locator(".composer-shell").boundingBox();
  expect(sidebar?.width).toBe(239);
  expect(composer!.x).toBeGreaterThan(sidebar!.width);
  expect(composer!.width).toBeGreaterThan(650);

  // The blocks that made the page feel like a catalogue are gone.
  await expect(page.getByRole("tab")).toHaveCount(0);
  for (const selector of [
    ".home27-mode-row",
    ".home27-shortcuts",
    ".home27-shortcut",
    ".home27-scenes",
    ".home27-scene",
    ".home27-more-scenes",
    ".home27-explore",
    ".home-example-library",
    ".home-plugins-rail",
    ".home-plugin-picks",
  ]) {
    await expect(page.locator(selector)).toHaveCount(0);
  }

  await expect(page.locator(".home-suggestion")).toHaveCount(3);
  await expect(page.locator(".main-workspace")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.locator(".app-sidebar")).toHaveCSS("background-color", "rgb(242, 242, 242)");
});

test("an example fills a complete prompt and never sends it", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && /\/api\/(chat|generation)$/.test(request.url())) requests.push(request.url());
  });

  const input = page.getByRole("textbox", { name: "任务描述", exact: true });
  await page.locator(".home-suggestion").first().click();

  const value = await input.inputValue();
  expect((value.match(/\p{Script=Han}/gu) || []).length).toBeGreaterThanOrEqual(200);
  expect(value).toContain("质量与交付要求：");
  await expect(input).toBeFocused();
  await expect(page.getByRole("button", { name: "开始任务" })).toBeEnabled();
  await expect(page).toHaveURL(/\/$/);
  expect(requests).toEqual([]);
});

test("the draft decides the mode, and the chip says what will be produced", async ({ page }) => {
  const input = page.getByRole("textbox", { name: "任务描述", exact: true });
  const mode = page.getByRole("combobox", { name: "任务模式" });

  await input.fill("帮我修一个 React 组件的 bug");
  await expect(mode).toHaveValue("code");

  await input.fill("这个季度的销售整理成汇报PPT");
  await expect(mode).toHaveValue("office");
  await expect(page.locator(".composer-intent")).toHaveText(/将生成 PPT/);
  await expect(page.getByRole("button", { name: "生成演示文稿" })).toBeEnabled();

  // A hand-picked mode wins over the guess for the rest of the draft.
  await mode.selectOption("design");
  await input.fill("帮我把这个季度的销售整理成汇报PPT");
  await expect(mode).toHaveValue("design");

  // Clearing the draft gives inference back.
  await input.fill("");
  await input.fill("写一段产品介绍");
  await expect(mode).toHaveValue("office");
  await expect(page.locator(".composer-intent")).toHaveCount(0);
});

test("model selection, Escape and outside click", async ({ page }) => {
  const trigger = page.getByRole("button", { name: "选择大模型", exact: true });
  await trigger.click();
  await page.getByRole("option", { name: /GLM-5.3-Flash/ }).click();
  await expect(trigger).toContainText("GLM-5.3-Flash");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await trigger.click();
  await page.getByRole("button", { name: "返回 DesignBuddy 首页" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("text attachment can be read and removed", async ({ page }) => {
  await page.locator('input.visually-hidden-input[type="file"]').setInputFiles({
    name: "brief.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("首页设计说明"),
  });
  await expect(page.locator(".attachment-chip")).toContainText("brief.txt ✓");
  await page.getByRole("button", { name: "移除附件 brief.txt" }).click();
  await expect(page.locator(".attachment-chip")).toHaveCount(0);
});

test("workspace and policy live behind 更多设置 and still reach the task", async ({ page }) => {
  const prompt = page.getByRole("textbox", { name: "任务描述" });
  await prompt.fill("测试首页需求");

  // Hidden by default: the two selects are noise for the 90% who keep defaults.
  await expect(page.getByLabel("工作空间", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "更多设置", exact: true }).click();
  await page.getByLabel("工作空间", { exact: true }).selectOption("个人空间");
  await page.getByLabel("任务权限").selectOption("仅本地");

  await page.getByRole("button", { name: "开始任务" }).click();
  await expect(page).toHaveURL(/\/tasks\//);
  const saved = await page.evaluate(() =>
    Object.values(localStorage).find((value) => value.includes("测试首页需求")),
  );
  expect(saved).toContain("个人空间");
  expect(saved).toContain("仅本地");
  expect(saved).toContain("办公提效需求");
});

test("Chinese IME never submits the draft", async ({ page }) => {
  const prompt = page.getByRole("textbox", { name: "任务描述" });
  await prompt.fill("测试首页需求");
  await prompt.dispatchEvent("keydown", { key: "Enter", code: "Enter", isComposing: true });
  await expect(page).toHaveURL(/\/$/);
  await prompt.press("Shift+Enter");
  await expect(page).toHaveURL(/\/$/);
});

for (const width of [320, 375, 768, 1440]) {
  test(`no horizontal overflow or clipped model menu at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole("textbox", { name: "任务描述" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

    await page.getByRole("button", { name: "更多设置", exact: true }).click();
    for (const select of await page.locator(".footer-select").all()) {
      const box = (await select.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
    await page.getByRole("button", { name: "更多设置", exact: true }).click();

    await page.getByRole("button", { name: "选择大模型", exact: true }).click();
    const box = await page.getByRole("dialog").boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(900);
  });
}
