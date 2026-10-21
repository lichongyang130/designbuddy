import { test, expect } from "@playwright/test";

const longText = Array.from({ length: 30 }, (_, i) => `第${i + 1}项要求：请根据实际资料整理任务目标、已有材料、执行步骤与交付要求，不要遗漏重要信息。`).join("\n");
async function fits(input: import("@playwright/test").Locator) {
  await expect(input).toHaveCSS("overflow-y", "hidden");
  await expect(input).toHaveCSS("max-height", "none");
  await expect.poll(() => input.evaluate(el => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
}
for (const width of [320, 375, 768, 1440]) {
  test(`homepage grows downward for long prompts and shrinks after deletion at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await page.goto("/");
    const input = page.getByRole("textbox", { name: "任务描述", exact: true });
    const shell = page.locator(".composer-shell");
    const height = (await input.boundingBox())!.height;
    const top = await shell.evaluate(el => el.getBoundingClientRect().top + window.scrollY);
    await input.fill(longText); await fits(input);
    expect((await input.boundingBox())!.height).toBeGreaterThan(height + 400);
    // A long prompt may pull the card up to the top of the column, but it must
    // never be pushed above it or off the screen.
    const grownTop = await shell.evaluate(el => el.getBoundingClientRect().top);
    expect(grownTop).toBeLessThanOrEqual(top + 1);
    expect(grownTop).toBeGreaterThan(0);
    const box = (await input.boundingBox())!, controls = (await page.locator(".composer-controls").boundingBox())!;
    expect(controls.y).toBeGreaterThanOrEqual(box.y + box.height - 1);
    const footer = (await page.locator(".composer-footer").boundingBox())!, examples = (await page.locator(".home-suggestion-bar").boundingBox())!;
    expect(examples.y).toBeGreaterThan(footer.y + footer.height);
    await expect(input).toHaveValue(longText);
    // A short draft is never taller than the empty box (the placeholder can wrap
    // to two lines on a phone), and clearing returns to exactly that height.
    await input.fill("短需求"); await fits(input);
    expect((await input.boundingBox())!.height).toBeLessThanOrEqual(height + 0.5);
    await input.fill(""); await fits(input);
    expect((await input.boundingBox())!.height).toBeCloseTo(height, 0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

test("programmatic prompt insertion and viewport reflow resize without hiding any text", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto("/");
  const input = page.getByRole("textbox", { name: "任务描述", exact: true });
  const initial = (await input.boundingBox())!.height;
  await page.locator(".home-suggestion").first().click();
  await fits(input); await expect(input).toBeFocused();
  const prompt = await input.inputValue();
  const desktop = (await input.boundingBox())!.height;
  expect(desktop).toBeGreaterThan(initial);
  await page.setViewportSize({ width: 375, height: 900 }); await fits(input);
  expect((await input.boundingBox())!.height).toBeGreaterThan(desktop);
  await expect(input).toHaveValue(prompt);
  await page.setViewportSize({ width: 1440, height: 1000 }); await fits(input);
  expect((await input.boundingBox())!.height).toBeCloseTo(desktop, 0);
});

test("long unbroken text and blank lines expand, Shift+Enter and IME never auto-submit", async ({ page }) => {
  await page.goto("/"); const input = page.getByRole("textbox", { name: "任务描述", exact: true });
  await input.fill("https://example.com/" + "abc123".repeat(300)); await fits(input);
  await input.fill("首行" + "\n".repeat(20) + "末行"); await fits(input);
  const height = (await input.boundingBox())!.height;
  await input.press("ControlOrMeta+End"); await input.press("Shift+Enter"); await fits(input);
  expect((await input.boundingBox())!.height).toBeGreaterThan(height);
  await input.dispatchEvent("keydown", { key: "Enter", code: "Enter", isComposing: true });
  await expect(page).toHaveURL(/\/$/);
  await page.getByLabel("任务权限", { exact: true }).selectOption("仅本地");
  await input.press("Enter"); await expect(page).toHaveURL(/\/tasks\//);
  await expect(page.getByRole("textbox", { name: "继续描述任务" })).not.toHaveAttribute("data-auto-resize", "true");
});
