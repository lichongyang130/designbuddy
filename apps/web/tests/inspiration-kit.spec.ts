import { test, expect, type Page } from "@playwright/test";

/**
 * The data-driven template sets must really contain 24 substantive pages each,
 * navigable one by one, without placeholder copy and without overflowing the
 * narrow layouts.
 */
const sets = [
  { id: "studio-nine", title: "STUDIO NINE" },
  { id: "wellspring", title: "WELLSPRING" },
  { id: "circuit", title: "CIRCUIT" },
  { id: "paperhouse", title: "PAPERHOUSE" },
  { id: "campus", title: "CAMPUS" },
  { id: "paws", title: "PAWS" },
];

const banned = /lorem|ipsum|待补充|\bTODO\b|\bTBD\b|示例文字|占位文字/;

for (const set of sets) {
  test(`${set.title} ships 24 real pages that can be walked page by page`, async ({
    page,
  }) => {
    await page.goto(`/inspiration/${set.id}`);
    const root = page.locator(".kit-root");
    await expect(root).toHaveAttribute("data-template", set.id);
    await expect(root).toHaveAttribute("data-valid", "true");
    await expect(page.locator(".kit-invalid")).toHaveCount(0);
    await expect(page.locator(".kit-menu li")).toHaveCount(24);
    await expect(page.locator(".kit-counter")).toHaveText("1 / 24");

    const seen = new Set<string>();
    for (let step = 0; step < 24; step += 1) {
      const canvas = page.locator(".kit-canvas");
      const title = (await canvas.locator("h1, h2").first().innerText()).trim();
      expect(title.length).toBeGreaterThan(1);
      expect(seen.has(title)).toBe(false);
      seen.add(title);
      const text = await canvas.innerText();
      expect(text.length).toBeGreaterThan(40);
      expect(banned.test(text)).toBe(false);
      if (step < 23) {
        await page.getByRole("button", { name: "下一页" }).click();
        await expect(page.locator(".kit-counter")).toHaveText(`${step + 2} / 24`);
      }
    }
    expect(seen.size).toBe(24);
  });

  test(`${set.title} pages carry their own artwork and stay inside narrow layouts`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(`/inspiration/${set.id}`);
    const images = page.locator(".kit-canvas img");
    const count = await images.count();
    expect(count).toBeGreaterThan(0);
    for (let index = 0; index < count; index += 1) {
      const image = images.nth(index);
      await expect(image).toHaveAttribute("src", /\/(src\/)?assets\/(kit|expansion)\//);
      const box = await image.boundingBox();
      expect(box).not.toBeNull();
      expect((box?.width ?? 0)).toBeGreaterThan(40);
    }
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(overflow).toBeLessThanOrEqual(375);
  });
}

test("the catalogue lists the three new template sets", async ({ page }) => {
  await page.goto("/inspiration");
  for (const set of sets) {
    await expect(
      page.locator(".sample-card", { hasText: set.title }),
    ).toHaveCount(1);
  }
});
