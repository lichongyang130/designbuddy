import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "选择大模型", exact: true }).click();
});

test("reference 5 has stacked reasoning rows, model labels, rates and selected check", async ({
  page,
}) => {
  const popup = page.getByRole("dialog", { name: "选择大模型", exact: true });
  await expect(popup).toBeVisible();
  expect((await popup.boundingBox())!.width).toBe(340);
  const reasoning = popup.getByRole("group", { name: "推理模式" });
  const balanced = (await reasoning
    .getByRole("button", { name: /均衡/ })
    .boundingBox())!;
  const extreme = (await reasoning
    .getByRole("button", { name: /极致/ })
    .boundingBox())!;
  expect(extreme.y).toBeGreaterThanOrEqual(balanced.y + balanced.height);
  expect(extreme.x).toBe(balanced.x);
  await expect(popup.getByRole("option")).toHaveCount(7);
  const selected = popup.getByRole("option", { name: /Step-5-Preview/ });
  await expect(selected).toHaveAttribute("aria-selected", "true");
  await expect(selected).toContainText("独家限免");
  await expect(selected.locator(".model-option-check svg")).toHaveCount(1);
  await expect(selected).toContainText("0.00x");
  await expect(
    popup.getByRole("button", { name: "配置自定义模型", exact: true }),
  ).toBeVisible();
});

test("model selection updates the trigger and restores keyboard focus", async ({
  page,
}) => {
  await page.getByRole("option", { name: /GLM-5.3-Flash/ }).click();
  const trigger = page.getByRole("button", { name: "选择大模型", exact: true });
  await expect(trigger).toContainText("GLM-5.3-Flash");
  await expect(trigger).toBeFocused();
  await expect(page.getByRole("dialog", { name: "选择大模型" })).toHaveCount(0);
  await trigger.click();
  await expect(
    page.getByRole("option", { name: /GLM-5.3-Flash/ }),
  ).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("keyboard navigation selects a model without accidental requests", async ({
  page,
}) => {
  const calls: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/(chat|generation)/.test(request.url()))
      calls.push(request.url());
  });
  await expect(
    page.getByRole("option", { name: /Step-5-Preview/ }),
  ).toBeFocused();
  await page.keyboard.press("Home");
  await expect(page.getByRole("option", { name: /Hy4 preview/ })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("option", { name: /Hy3/ })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "选择大模型", exact: true }),
  ).toContainText("Hy3");
  expect(calls).toEqual([]);
});

test("Max and reasoning preferences work; custom model configuration opens settings", async ({
  page,
}) => {
  const toggle = page.getByRole("switch", { name: "Max 模式" });
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: /极致/ }).click();
  await expect(page.getByRole("button", { name: /极致/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: /均衡/ })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page
    .getByRole("button", { name: "配置自定义模型", exact: true })
    .click();
  const settings = page.getByRole("dialog", { name: "设置", exact: true });
  await expect(settings).toBeVisible();
  await expect(
    settings.getByRole("button", { name: "模型", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    settings.getByRole("button", { name: "添加模型", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "选择大模型", exact: true }),
  ).toBeFocused();
});

for (const viewport of [
  { width: 320, height: 480 },
  { width: 375, height: 812 },
  { width: 1024, height: 797 },
  { width: 1440, height: 1000 },
]) {
  test(`menu is reachable and bounded at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const popup = page.getByRole("dialog", { name: "选择大模型", exact: true });
    await expect(popup).toBeVisible();
    await expect
      .poll(async () => {
        const box = (await popup.boundingBox())!;
        return (
          box.x >= 0 &&
          box.y >= 0 &&
          box.x + box.width <= viewport.width &&
          box.y + box.height <= viewport.height
        );
      })
      .toBeTruthy();
    await page.getByRole("option", { name: /GLM-5.3-Flash/ }).click();
    const model = (await page
      .getByRole("button", { name: "选择大模型", exact: true })
      .boundingBox())!;
    const voice = (await page
      .getByRole("button", { name: "语音输入", exact: true })
      .boundingBox())!;
    expect(model.x + model.width).toBeLessThanOrEqual(voice.x);
    expect(voice.x - model.x - model.width).toBeLessThan(20);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(viewport.width);
  });
}
