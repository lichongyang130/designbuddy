import { test, expect } from "@playwright/test";

const additions = ["HyperFrames", "视频", "音频", "实时产物", "WebGL"];

for (const width of [320, 375, 768, 1440]) {
  test(`new template categories remain reachable without overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/inspiration");
    const types = page.getByRole("group", { name: "作品类型" });
    await expect(types.getByRole("button")).toHaveText([
      "全部",
      "原型",
      "幻灯片",
      "文档",
      "图片",
      ...additions,
    ]);
    for (const category of additions) {
      const button = types.getByRole("button", { name: category, exact: true });
      await button.click();
      await expect(button).toBeInViewport();
      await expect(button).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator(".samples-empty")).toHaveCount(0);
      await expect(page.locator(".sample-card")).toHaveCount(1);
      await expect(page.locator(".sample-card>button")).toContainText(
        category === "HyperFrames"
          ? "NEXT FRAME"
          : category === "视频"
            ? "LAKESIDE"
            : category === "音频"
              ? "SOFT SIGNALS"
              : category === "实时产物"
                ? "SCOPE"
                : "FORM",
      );
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
    }
    await types.getByRole("button", { name: "全部", exact: true }).click();
    await expect(
      types.getByRole("button", { name: "全部", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".sample-card")).toHaveCount(19);
  });
}

test("new categories support keyboard selection and preserve search and draft filters", async ({
  page,
}) => {
  await page.goto("/inspiration");
  const types = page.getByRole("group", { name: "作品类型" });
  const search = page.getByRole("textbox", { name: "搜索作品", exact: true });
  await search.fill("LUMA");
  await expect(page.locator(".sample-card")).toHaveCount(1);
  await types.getByRole("button", { name: "图片", exact: true }).focus();
  for (const category of additions) {
    await page.keyboard.press("Tab");
    const button = types.getByRole("button", { name: category, exact: true });
    await expect(button).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(search).toHaveValue("LUMA");
  }
  await page
    .getByRole("button", { name: "我的副本（0）", exact: true })
    .click();
  await expect(page.locator(".samples-empty")).toContainText(
    "还没有匹配的副本",
  );
  await expect(
    types.getByRole("button", { name: "WebGL", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "查看全部作品", exact: true }).click();
  await expect(search).toHaveValue("");
  await expect(page.locator(".sample-card")).toHaveCount(19);
  await expect(
    page.getByRole("button", { name: "我的副本（0）", exact: true }),
  ).toBeVisible();
});
