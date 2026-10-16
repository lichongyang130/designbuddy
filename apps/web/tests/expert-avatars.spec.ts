import { test, expect } from "@playwright/test";

const portraits = [
  ["documents", "文档整理专家"], ["data", "数据分析专家"], ["slides", "汇报提案专家"], ["communication", "工作协作专家"],
  ["brand", "品牌视觉专家"], ["visual", "营销物料专家"], ["product-visual", "产品展示专家"], ["infographics", "信息可视化专家"],
  ["product", "产品需求专家"], ["web-design", "网页交互专家"], ["developer", "全栈开发专家"], ["qa", "测试验收专家"],
];

test("all twelve character portraits are distinct, local, loaded and square", async ({ page }) => {
  await page.goto("/experts");
  await expect(page.locator(".expert-directory-card")).toHaveCount(12);
  const sources: string[] = [];
  for (const [id, name] of portraits) {
    const card = page.getByRole("article", { name, exact: true });
    const image = card.locator(".expert-role-icon img");
    await expect(image).toHaveAttribute("src", new RegExp(`/anime/${id}\\.webp`));
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth === 384 && img.naturalHeight === 384)).toBe(true);
    sources.push((await image.getAttribute("src"))!);
    const box = (await image.boundingBox())!;
    expect(box.width).toBe(box.height);
    expect(box.width).toBeGreaterThan(44);
  }
  expect(new Set(sources).size).toBe(12);


  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "../../.cache/expert-avatars-directory.png", fullPage: true });
});

test("each new avatar is consistent on details, homepage selection and manual match panel", async ({ page }) => {
  test.setTimeout(90000);
  let sends = 0;
  page.on("request", r => { if (/\/api\/(chat|generation)$/.test(r.url())) sends++; });
  for (const [id, name] of portraits) {
    await page.goto(`/experts/${id}`);
    const source = await page.locator(".expert-detail-hero img").getAttribute("src");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
    await page.getByRole("button", { name: "用于当前任务", exact: true }).click();
    await expect(page.locator(".home-expert-trigger img")).toHaveAttribute("src", source!);
    await page.locator(".home-expert-trigger").click();
    await expect(page.locator(".expert-match-identity img")).toHaveAttribute("src", source!);
    await expect(page.locator(".expert-match-identity")).toHaveText(name);
  }
  expect(sends).toBe(0);
});

for (const width of [320, 375, 768, 1440]) {
  test(`portrait keeps directory, detail and homepage label usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/experts");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.getByRole("button", { name: "查看信息可视化专家", exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const heading = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
    expect(heading.width).toBeGreaterThan(150);
    await page.getByRole("button", { name: "用于当前任务", exact: true }).click();
    const trigger = page.locator(".home-expert-trigger");
    await expect(trigger).toContainText("信息可视化专家");
    const image = (await trigger.locator("img").boundingBox())!;
    const label = (await trigger.locator(".home-expert-trigger-label").boundingBox())!;
    expect(image.x + image.width).toBeLessThanOrEqual(label.x);
    expect(Math.abs(image.y + image.height / 2 - label.y - label.height / 2)).toBeLessThan(2);
  });
}
