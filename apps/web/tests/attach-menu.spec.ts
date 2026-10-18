import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "添加附件", exact: true }).click();
});

test("reference 6 primary menu and hovering expert flyout stay open across the gap", async ({
  page,
}) => {
  const root = page.getByRole("menu", { name: "添加到任务", exact: true });
  await expect(root.getByRole("menuitem")).toHaveText([
    "添加文件",
    "模式",
    "专家",
    "技能",
    "连接器",
  ]);
  await expect(
    page.getByRole("button", { name: "关闭添加菜单" }),
  ).toHaveAttribute("aria-expanded", "true");
  await root.getByRole("menuitem", { name: "专家", exact: true }).hover();
  const child = page.getByRole("dialog", { name: "专家选项", exact: true });
  await expect(child).toBeVisible();
  const parentBox = (await root.boundingBox())!;
  const childBox = (await child.boundingBox())!;
  expect(parentBox.width).toBe(200);
  expect(childBox.width).toBe(240);
  expect(childBox.x).toBeGreaterThanOrEqual(parentBox.x + parentBox.width);
  await child.getByRole("textbox", { name: "搜索专家" }).hover();
  await expect(child).toBeVisible();
  await expect(
    child.getByRole("button", { name: "召唤更多专家" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "关闭添加菜单" }).click();
  await expect(root).toHaveCount(0);
});

test("file menu opens the native chooser and preserves readable attachment handling", async ({
  page,
}) => {
  await page.getByRole("menuitem", { name: "添加文件", exact: true }).click();
  await expect(
    page.getByText("PDF 和图片目前仅附上文件名", { exact: false }),
  ).toBeVisible();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("menuitem", { name: "上传本地文件" }).click();
  await (
    await chooser
  ).setFiles({
    name: "menu-brief.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("通过两级菜单选择的任务资料"),
  });
  await expect(page.locator(".attachment-chip")).toContainText(
    "menu-brief.txt ✓",
  );
  await expect(page.getByRole("menu", { name: "添加到任务" })).toHaveCount(0);
  await page.getByRole("button", { name: "移除附件 menu-brief.txt" }).click();
  await expect(page.locator(".attachment-chip")).toHaveCount(0);
});

test("mode submenu synchronizes the large homepage tabs", async ({ page }) => {
  await page.getByRole("menuitem", { name: "模式", exact: true }).click();
  await expect(
    page.getByRole("menuitemradio", { name: "办公提效" }),
  ).toHaveAttribute("aria-checked", "true");
  await page.getByRole("menuitemradio", { name: "设计制作" }).click();
  await expect(page.getByRole("tab", { name: "设计制作" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    page.getByRole("button", { name: "添加附件", exact: true }),
  ).toBeFocused();
});

test("search, no-results state and expert/skill selection feed the real task", async ({
  page,
}) => {
  await page.getByRole("menuitem", { name: "专家", exact: true }).click();
  const search = page.getByRole("textbox", { name: "搜索专家" });
  await search.fill("没有这位专家123");
  await expect(page.getByRole("dialog", { name: "专家选项", exact: true }).getByRole("status")).toContainText("没有找到匹配的专家");
  await search.fill(" 开发 ");
  await page
    .getByRole("button", { name: "全栈开发专家", exact: true })
    .click();
  await expect(page.locator(".home-expert-trigger")).toContainText("全栈开发专家");
  await expect(page.getByRole("textbox", { name: "任务描述" })).toBeFocused();
  await page.getByRole("button", { name: "添加附件", exact: true }).click();
  await page.getByRole("menuitem", { name: "技能", exact: true }).click();
  await page.getByRole("textbox", { name: "搜索技能" }).fill(" ppt ");
  await page.getByRole("button", { name: "材料转可编辑 PPTX", exact: true }).click();
  await expect(page.locator(".home-selected-capabilities")).toContainText(
    "材料转可编辑 PPTX",
  );
  await page.getByLabel("任务权限").selectOption("仅本地");
  await page
    .getByRole("textbox", { name: "任务描述" })
    .fill("根据附件编写产品提案");
  await page.getByRole("button", { name: "开始任务", exact: true }).click();
  await expect(page).toHaveURL(/\/tasks\//);
  const state = await page.evaluate(() =>
    Object.values(localStorage).join("\n"),
  );
  expect(state).toContain("推荐专家：全栈开发专家");
  expect(state).toContain("使用技能：材料转可编辑 PPTX");
});

test("connector search opens its configuration without starting authorization", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      !request.url().endsWith("/api/local/session")
    )
      requests.push(request.url());
  });
  await page.getByRole("menuitem", { name: "连接器", exact: true }).click();
  await page.getByRole("textbox", { name: "搜索连接器" }).fill(" GITHUB ");
  await page.getByRole("button", { name: "GitHub", exact: true }).click();
  await expect(page).toHaveURL(/\/connectors\/github$/);
  await expect(
    page.getByRole("button", { name: "授权连接", exact: true }),
  ).toBeVisible();
  expect(requests).toEqual([]);
});

test("keyboard flyout navigation, Escape, outside click and model-menu exclusion", async ({
  page,
}) => {
  await page.keyboard.press("Escape");
  const trigger = page.getByRole("button", { name: "添加附件", exact: true });
  await expect(trigger).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("menuitem", { name: "添加文件", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("menuitem", { name: "专家", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("textbox", { name: "搜索专家" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("button", { name: "全栈开发专家", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(
    page.getByRole("menuitem", { name: "专家", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole("textbox", { name: "任务描述" }).click();
  await expect(page.getByRole("menu", { name: "添加到任务" })).toHaveCount(0);
  await page.getByRole("button", { name: "选择大模型", exact: true }).click();
  await trigger.click();
  await expect(
    page.getByRole("dialog", { name: "选择大模型", exact: true }),
  ).toHaveCount(0);
});

for (const viewport of [
  { width: 320, height: 480 },
  { width: 375, height: 812 },
  { width: 768, height: 650 },
  { width: 1440, height: 1000 },
]) {
  test(`both menu levels remain usable at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.getByRole("menuitem", { name: "专家", exact: true }).click();
    const child = page.getByRole("dialog", { name: "专家选项", exact: true });
    await expect(child).toBeVisible();
    await expect
      .poll(async () => {
        const box = (await child.boundingBox())!;
        return (
          box.x >= 0 &&
          box.y >= 0 &&
          box.x + box.width <= viewport.width &&
          box.y + box.height <= viewport.height
        );
      })
      .toBeTruthy();
    if (viewport.width < 600) {
      await page.getByRole("button", { name: "返回 · 专家" }).click();
      await expect(
        page.getByRole("menuitem", { name: "添加文件", exact: true }),
      ).toBeVisible();
      await page.getByRole("menuitem", { name: "专家", exact: true }).click();
    }
    await page
      .getByRole("button", { name: "召唤更多专家", exact: true })
      .click();
    await expect(page).toHaveURL(/\/experts$/);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(viewport.width);
  });
}
