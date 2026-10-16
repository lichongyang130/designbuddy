import { test, expect } from "@playwright/test";

for (const width of [320, 375, 600, 650, 768, 1024, 1440]) {
  test(`expert trigger stays a horizontal single line at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const button = page.locator(".home-expert-trigger");
    const label = button.locator(".home-expert-trigger-label");
    await expect(label).toHaveText("自动匹配专家");
    // Different real status labels, including a long user-defined expert name.
    for (const text of ["自动匹配专家", "正在匹配专家…", "推荐：数据分析专家", "需要确认需求", "暂未完成匹配", "跨部门经营数据分析与业务汇报专家"]) {
      await label.evaluate((element, value) => { element.textContent = value; }, text);
      await expect(button).toHaveCSS("flex-direction", "row");
      await expect(label).toHaveCSS("white-space", "nowrap");
      await expect(label).toHaveCSS("writing-mode", "horizontal-tb");
      const metrics = await button.evaluate(el => {
        const label = el.querySelector(".home-expert-trigger-label")!;
        const text = label.firstChild!;
        const tops = [];
        for (let i = 0; i < text.textContent!.length; i++) {
          const range = document.createRange(); range.setStart(text, i); range.setEnd(text, i + 1);
          tops.push(Math.round(range.getBoundingClientRect().top));
        }
        const box = el.getBoundingClientRect(), a = el.firstElementChild!.getBoundingClientRect(), l = label.getBoundingClientRect();
        const plus = el.parentElement!.querySelector(".attach-button")!.getBoundingClientRect();
        return { lines: new Set(tops).size, height: box.height, avatarRight: a.right, labelLeft: l.left, plusRight: plus.right, buttonLeft: box.left, plusY: plus.y, buttonY: box.y };
      });
      expect(metrics.lines).toBe(1);
      expect(metrics.height).toBe(34);
      expect(metrics.labelLeft).toBeGreaterThanOrEqual(metrics.avatarRight);
      expect(metrics.buttonLeft).toBeGreaterThanOrEqual(metrics.plusRight);
      expect(Math.abs(metrics.buttonY - metrics.plusY)).toBeLessThan(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
    await label.evaluate(el => { el.textContent = "自动匹配专家"; });
    await button.click();
    await expect(page.getByRole("dialog", { name: "专家选项", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(button).toBeFocused();
  });
}
