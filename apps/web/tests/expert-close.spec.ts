import { test, expect } from "@playwright/test";

for (const width of [320, 375, 768, 1440]) {
  test(`popup close stays aligned and usable after scrolling at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.addInitScript(() => localStorage.setItem("designbuddy.expert-match-consent.v1", "allowed"));
    await page.route("**/api/expert-match", route => route.fulfill({ json: {
      kind: "match", expertId: "data", reason: "需要核对报销数据。",
      responsibilities: ["核对金额与统计口径", "检查重复与缺失", "整理差异清单", "给出待复核事项"],
      missing: ["报销明细", "统计时间", "字段含义", "核验标准"],
    } }));
    await page.goto("/");
    const input = page.getByRole("textbox", { name: "任务描述", exact: true });
    await input.fill("整理设计部门的报销表");
    const trigger = page.locator(".home-expert-trigger");
    await expect(trigger).toContainText("推荐：数据分析专家");
    await trigger.click();
    const popup = page.getByRole("dialog", { name: "专家选项", exact: true });
    const close = popup.getByRole("button", { name: "关闭专家匹配", exact: true });
    const heading = popup.locator(".expert-match-heading");
    const buttonBox = (await close.boundingBox())!, headingBox = (await heading.boundingBox())!, svg = (await close.locator("svg").boundingBox())!;
    expect(buttonBox.width).toBe(28); expect(buttonBox.height).toBe(28);
    expect(buttonBox.x).toBeGreaterThanOrEqual(headingBox.x + headingBox.width);
    expect(Math.abs(svg.x + svg.width / 2 - buttonBox.x - buttonBox.width / 2)).toBeLessThan(1);
    expect(Math.abs(svg.y + svg.height / 2 - buttonBox.y - buttonBox.height / 2)).toBeLessThan(1);
    await popup.getByText("工作方法与交付核验", { exact: true }).click();
    await popup.evaluate(el => { el.scrollTop = el.scrollHeight; });
    await expect.poll(() => close.evaluate(el => {
      const box = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
    })).toBe(true);
    await close.click();
    await expect(popup).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(input).toHaveValue("整理设计部门的报销表");
    await expect(trigger).toContainText("推荐：数据分析专家");
    expect(await page.evaluate(() => localStorage.getItem("designbuddy.expert-match-consent.v1"))).toBe("allowed");
    await trigger.click();
    await close.focus(); await page.keyboard.press("Enter");
    await expect(popup).toHaveCount(0); await expect(trigger).toBeFocused();
  });
}

test("closing the initial consent panel never enables matching or submits a task", async ({ page }) => {
  let calls = 0;
  page.on("request", request => { if (/\/api\/(expert-match|chat|generation)$/.test(request.url())) calls++; });
  await page.goto("/");
  await page.getByRole("textbox", { name: "任务描述", exact: true }).fill("保留这段文字");
  await page.locator(".home-expert-trigger").click();
  await page.getByRole("button", { name: "关闭专家匹配", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "专家选项" })).toHaveCount(0);
  expect(calls).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem("designbuddy.expert-match-consent.v1"))).toBeNull();
});
