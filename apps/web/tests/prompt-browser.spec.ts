import { test, expect } from "@playwright/test";
import { categoriesForMode } from "../src/components/promptLibrary";

test.beforeEach(async ({ page }) => { await page.goto("/"); });

test("category opens subcategories, then filters a list without changing or submitting the draft", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", r => { if (/\/api\/(chat|generation)$/.test(r.url())) requests.push(r.url()); });
  const input = page.getByRole("textbox", { name: "任务描述", exact: true });
  await input.fill("请保留这段原始需求");
  await page.getByLabel("任务权限", { exact: true }).selectOption("仅本地");
  await page.getByRole("button", { name: "文档整理", exact: true }).click();
  const menu = page.getByRole("menu", { name: "文档整理下级栏目" });
  await expect(menu.getByRole("menuitem")).toHaveCount(2);
  await expect(input).toHaveValue("请保留这段原始需求");
  await menu.getByRole("menuitem", { name: /文档混乱不好用/ }).click();
  await expect(page.locator(".prompt-breadcrumb")).toContainText("文档整理 · 文档混乱不好用");
  await expect(page.getByRole("list", { name: "推荐场景" }).getByRole("listitem")).toHaveCount(2);
  await expect(input).toHaveValue("请保留这段原始需求");
  page.once("dialog", d => d.dismiss());
  await page.locator(".home-prompt-list button").first().click();
  await expect(input).toHaveValue("请保留这段原始需求");
  page.once("dialog", d => d.accept());
  await page.locator(".home-prompt-list button").first().click();
  const value = await input.inputValue();
  expect((value.match(/\p{Script=Han}/gu) || []).length).toBeGreaterThanOrEqual(200);
  expect(value).toContain("文档混乱不好用");
  expect(value).toContain("质量与交付要求：");
  await expect(input).toBeFocused();
  await expect(page.getByLabel("任务权限", { exact: true })).toHaveValue("仅本地");
  expect(requests).toEqual([]);
});

test("refresh rotates actual list entries without immediate repeats, navigation or overwriting input", async ({ page }) => {
  const input = page.getByRole("textbox", { name: "任务描述", exact: true });
  await input.fill("政策条款速读");
  await expect(page.getByRole("button", { name: "查看更多", exact: true })).toHaveCount(0);
  let previous = await page.locator(".home-prompt-list strong").allTextContents();
  for (let i = 0; i < 4; i++) {
    await page.getByRole("button", { name: /换一批/ }).click();
    const next = await page.locator(".home-prompt-list strong").allTextContents();
    expect(next.every(title => !previous.includes(title))).toBe(true);
    previous = next;
    await expect(input).toHaveValue("政策条款速读");
    await expect(page).toHaveURL(/\/$/);
  }
});

test("every category and subgroup stays in its mode and inserts full prompts", async ({ page }) => {
  test.setTimeout(180_000);
  const input = page.getByRole("textbox", { name: "任务描述", exact: true });
  for (const [mode, label] of [["office", "办公提效"], ["code", "网页应用"], ["design", "设计制作"]] as const) {
    await page.getByRole("tab", { name: label, exact: true }).click();
    for (const category of categoriesForMode(mode)) {
      for (const group of category.groups) {
        await input.fill("");
        if (categoriesForMode(mode).indexOf(category) < 5) {
          await page.getByRole("button", { name: category.title, exact: true }).click();
        } else {
          await page.getByRole("button", { name: "全部分类", exact: true }).click();
          await page.getByRole("menuitem", { name: new RegExp(`^${category.title}`) }).click();
        }
        await page.getByRole("menu", { name: `${category.title}下级栏目` }).getByRole("menuitem", { name: new RegExp(group.title) }).click();
        await expect(page.locator(".prompt-breadcrumb")).toContainText(`${category.title} · ${group.title}`);
        await page.locator(".home-prompt-list button").first().click();
        expect((await input.inputValue()).match(/\p{Script=Han}/gu)!.length).toBeGreaterThanOrEqual(200);
        await expect(page.getByRole("tab", { name: label, exact: true })).toHaveAttribute("aria-selected", "true");
      }
    }
  }
});

test("keyboard menu navigation, Escape and per-mode subgroup state work", async ({ page }) => {
  const category = page.getByRole("button", { name: "文档整理", exact: true });
  await category.focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("End");
  await expect(page.getByRole("menuitem", { name: /文档混乱不好用/ })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(category).toBeFocused();
  await page.getByRole("tab", { name: "网页应用", exact: true }).click();
  await expect(page.locator(".prompt-breadcrumb")).toContainText("企业官网");
  await page.getByRole("tab", { name: "办公提效", exact: true }).click();
  await expect(page.locator(".prompt-breadcrumb")).toContainText("文档混乱不好用");
  await category.click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(category).toBeFocused();
});

for (const width of [320, 375, 768, 1440]) {
  test(`submenu and recommendation rows fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole("button", { name: "全部分类", exact: true }).click();
    await expect(page.getByRole("menu", { name: "办公提效全部分类" }).getByRole("menuitem")).toHaveCount(10);
    await page.getByRole("menuitem", { name: /^协作跟进/ }).click();
    const menu = page.getByRole("menu", { name: "协作跟进下级栏目" });
    const box = (await menu.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    await menu.getByRole("menuitem", { name: /变更分歧难以处理/ }).click();
    const list = (await page.getByRole("list", { name: "推荐场景" }).boundingBox())!;
    expect(list.x + list.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if (width === 1440) await page.screenshot({ path: "../../.cache/prompt-recommendations-desktop.png" });
  });
}

test("reselecting a subgroup ranks current input and usage personalizes the next visit", async ({ page }) => {
  const input = page.getByRole("textbox", { name: "任务描述", exact: true });
  await input.fill("政策条款速读");
  await page.getByRole("button", { name: "文档整理", exact: true }).click();
  await page.getByRole("menuitem", { name: /材料太多读不完/ }).click();
  await expect(page.locator(".home-prompt-list strong").first()).toHaveText("政策条款速读");
  page.once("dialog", d => d.accept());
  await page.locator(".home-prompt-list button").first().click();
  await page.reload();
  await expect(page.locator(".home-prompt-list strong").first()).toHaveText("政策条款速读");
  await expect(input).toHaveValue("");
  const saved = await page.evaluate(() => localStorage.getItem("designbuddy.prompt-recommendations.v1"));
  expect(saved).toContain("count");
  expect(saved).not.toContain("政策条款速读");
});

test("all categories support keyboard/back/Escape and retain hidden selection across modes", async ({ page }) => {
  await expect(page.getByRole("tab")).toHaveText(["办公提效", "设计制作", "网页应用"]);
  const trigger = page.getByRole("button", { name: "全部分类", exact: true });
  const initial = await page.locator(".home27-shortcut").allTextContents();
  await trigger.focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("End");
  await expect(page.getByRole("menuitem", { name: /^协作跟进/ })).toBeFocused();
  await page.keyboard.press("Enter");
  await page.getByRole("menuitem", { name: "返回全部分类", exact: true }).click();
  await expect(page.getByRole("menuitem")).toHaveCount(10);
  await page.getByRole("menuitem", { name: /^协作跟进/ }).click();
  await page.getByRole("menuitem", { name: /变更分歧难以处理/ }).click();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute("data-active", "true");
  await page.getByRole("button", { name: /换一批/ }).click();
  await expect(page.locator(".home27-shortcut")).toHaveText(initial);
  await page.getByRole("tab", { name: "设计制作", exact: true }).click();
  await page.getByRole("tab", { name: "办公提效", exact: true }).click();
  await expect(page.locator(".prompt-breadcrumb")).toContainText("协作跟进 · 变更分歧难以处理");
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await trigger.click();
  await page.getByRole("textbox", { name: "任务描述", exact: true }).click();
  await expect(page.getByRole("menu")).toHaveCount(0);
});
