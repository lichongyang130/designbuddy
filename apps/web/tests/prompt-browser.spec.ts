import { test, expect } from "@playwright/test";

/**
 * The example row replaced the category browser and the six-row recommendation
 * list. What still matters: three at a time, re-ranked by the draft, rotating
 * without repeats, and never sending anything or quietly rewriting the draft.
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("three examples re-rank as the draft changes and never overwrite it", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && /\/api\/(chat|generation)$/.test(request.url())) requests.push(request.url());
  });

  const input = page.getByRole("textbox", { name: "任务描述", exact: true });
  const examples = page.locator(".home-suggestion");
  await expect(examples).toHaveCount(3);

  await input.fill("请保留这段原始需求");
  await expect(input).toHaveValue("请保留这段原始需求");

  // 换一批 rotates the chips but touches nothing else.
  const before = await examples.allTextContents();
  await page.getByRole("button", { name: "换一批", exact: true }).click();
  const after = await examples.allTextContents();
  expect(after).not.toEqual(before);
  await expect(input).toHaveValue("请保留这段原始需求");
  await expect(page).toHaveURL(/\/$/);
  expect(requests).toEqual([]);

  // Clicking one asks before replacing the draft, then inserts the full prompt.
  page.once("dialog", (dialog) => dialog.accept());
  await examples.first().click();
  const value = await input.inputValue();
  expect((value.match(/\p{Script=Han}/gu) || []).length).toBeGreaterThanOrEqual(200);
  expect(value).toContain("质量与交付要求：");
  await expect(input).toBeFocused();
  expect(requests).toEqual([]);
});

test("examples follow the mode the draft implies", async ({ page }) => {
  const input = page.getByRole("textbox", { name: "任务描述", exact: true });

  const mode = page.getByRole("combobox", { name: "任务模式", exact: true });
  await input.fill("做一张品牌海报，需要主视觉和配色");
  await expect(mode).toHaveValue("design");
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator(".home-suggestion").first().click();
  // Whatever the batch, a chip hands over a complete brief, not a stub.
  await expect(input).toHaveValue(/质量与交付要求：/);
  await expect(mode).toHaveValue("design");

  // Clearing the box hands the mode back to inference.
  await input.fill("");
  await input.fill("帮我整理一份会议纪要");
  await expect(mode).toHaveValue("office");
  await expect(page.locator(".home-suggestion")).toHaveCount(3);
});

test("换一批 never repeats within a session", async ({ page }) => {
  const examples = page.locator(".home-suggestion");
  let previous = await examples.allTextContents();
  for (let round = 0; round < 4; round++) {
    await page.getByRole("button", { name: "换一批", exact: true }).click();
    const next = await examples.allTextContents();
    expect(next).toHaveLength(3);
    expect(next.every((title) => !previous.includes(title))).toBe(true);
    previous = next;
  }
  await expect(page).toHaveURL(/\/$/);
});

for (const width of [320, 375, 768, 1440]) {
  test(`examples fit ${width}px without overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const chip of await page.locator(".home-suggestion").all()) {
      const box = (await chip.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(-1);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
      expect(box.height).toBeGreaterThanOrEqual(28);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
