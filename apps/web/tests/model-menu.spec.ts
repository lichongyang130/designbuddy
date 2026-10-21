import { test, expect, type Locator, type Page } from "@playwright/test";
import { modelOptions } from "../../../frontend/workspace/taskModels";
import { resetComposerDefaults } from "./helpers/home";

/**
 * The picker only lists models the product actually ships (currently one) plus
 * whatever the account added itself, so the assertions read the same catalog
 * the menu renders instead of a hard-coded screenshot list. Rates and discount
 * badges only appear when a model really declares them.
 */
const builtIn = modelOptions;
const option = (popup: Locator, name: string) =>
  popup.getByRole("option", { name: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) });

async function openMenu(page: Page) {
  const trigger = page.getByRole("button", { name: "选择大模型", exact: true });
  await trigger.click();
  const popup = page.getByRole("dialog", { name: "选择大模型", exact: true });
  await expect(popup).toBeVisible();
  return { trigger, popup };
}

/** Adds one custom model through the real settings dialog, then closes it. */
async function addCustomModel(page: Page, id = "custom-menu-v1") {
  await page.keyboard.press("Control+,");
  const settings = page.getByRole("dialog", { name: "设置", exact: true });
  await settings.getByRole("button", { name: "模型", exact: true }).click();
  await settings.getByRole("button", { name: "添加模型", exact: true }).click();
  const form = settings.getByRole("form");
  await form.getByRole("combobox", { name: /^供应商/ }).selectOption("deepseek");
  await form.getByLabel(/^API Key/).fill("test-key");
  await form.getByLabel("模型标识", { exact: true }).fill(id);
  await form.getByRole("button", { name: "保存", exact: true }).click();
  await expect(settings.getByRole("status")).toContainText("已保存");
  await page.keyboard.press("Escape");
  await expect(settings).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  await resetComposerDefaults(page);
  await expect(page.locator("dialog.settings-window")).toBeAttached();
});

test("the menu stacks its reasoning rows and lists only real models", async ({
  page,
}) => {
  const { popup } = await openMenu(page);
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

  await expect(popup.getByRole("option")).toHaveCount(builtIn.length);
  const selected = option(popup, builtIn[0].name);
  await expect(selected).toHaveAttribute("aria-selected", "true");
  await expect(selected.locator(".model-option-check svg")).toHaveCount(1);
  // The built-in model declares neither a rate nor a discount, so the row must
  // not invent one.
  expect(builtIn[0].cost).toBe("");
  await expect(selected).not.toContainText("x");
  await expect(selected.locator(".model-option-badge")).toHaveCount(0);
  await expect(
    popup.getByRole("button", { name: "配置自定义模型", exact: true }),
  ).toBeVisible();
});

test("a custom model joins the list, selection updates the trigger and restores focus", async ({
  page,
}) => {
  await addCustomModel(page);
  const { trigger } = await openMenu(page);
  const popup = page.getByRole("dialog", { name: "选择大模型", exact: true });
  await expect(popup.getByRole("option")).toHaveCount(builtIn.length + 1);
  const custom = option(popup, "custom-menu-v1");
  // Only a self-added model carries the 「自定义」 badge; nothing else is claimed.
  await expect(custom.locator(".model-option-badge")).toHaveText("自定义");
  await custom.click();
  await expect(trigger).toContainText("custom-menu-v1");
  await expect(trigger).toBeFocused();
  await expect(page.getByRole("dialog", { name: "选择大模型" })).toHaveCount(0);
  await trigger.click();
  await expect(option(popup, "custom-menu-v1")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("keyboard navigation walks the real list without accidental requests", async ({
  page,
}) => {
  await addCustomModel(page);
  const calls: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/(chat|generation)/.test(request.url())) calls.push(request.url());
  });
  const { popup } = await openMenu(page);
  // Opening focuses the selected row (the built-in), not the first row blindly.
  await expect(option(popup, builtIn[0].name)).toBeFocused();
  await page.keyboard.press("End");
  await expect(option(popup, "custom-menu-v1")).toBeFocused();
  await page.keyboard.press("Home");
  await expect(option(popup, builtIn[0].name)).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(option(popup, "custom-menu-v1")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "选择大模型", exact: true }),
  ).toContainText("custom-menu-v1");
  expect(calls).toEqual([]);
});

test("Max and reasoning preferences work; custom model configuration opens settings", async ({
  page,
}) => {
  await openMenu(page);
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
    const { trigger, popup } = await openMenu(page);
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
    await option(popup, builtIn[0].name).click();
    const model = (await trigger.boundingBox())!;
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
