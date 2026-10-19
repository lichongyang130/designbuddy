import { test, expect, type Page } from "@playwright/test";

const sections = [
  "通用",
  "个人主页",
  "套餐与积分",
  "外观",
  "快捷键",
  "个性化",
  "记忆与进化",
  "智能体",
  "模型",
  "助理",
  "设备连接",
  "数据管理",
  "应用管理",
  "安全中心",
];
const dialog = (page: Page) =>
  page.getByRole("dialog", { name: "设置", exact: true });
async function open(page: Page, section: string) {
  await page.goto("/");
  await expect(page.locator("dialog.settings-window")).toBeAttached();
  await page.keyboard.press("Control+,");
  await dialog(page)
    .getByRole("button", { name: section, exact: true })
    .click();
}

for (const viewport of [
  { width: 1280, height: 940 },
  { width: 390, height: 844 },
  { width: 320, height: 480 },
]) {
  test(`all 14 panes fit ${viewport.width}px in light and dark themes`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await open(page, "通用");
    const panel = dialog(page);
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (value) => (document.documentElement.dataset.theme = value),
        theme,
      );
      for (const section of sections) {
        await panel
          .getByRole("navigation")
          .getByRole("button", { name: section, exact: true })
          .click();
        await expect(panel.locator(".settings-page-header h1")).toHaveText(
          section,
        );
        await expect(panel.locator(".settings-loading")).toHaveCount(0);
        const pane = panel.locator(".settings-content");
        expect(
          await pane.evaluate(
            (element) => element.scrollWidth - element.clientWidth,
          ),
          `${theme} ${section}`,
        ).toBeLessThanOrEqual(1);
        const box = (await panel.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      }
    }
  });
}

test("memory requires consent and supports real create and delete", async ({
  page,
}) => {
  await open(page, "记忆与进化");
  const panel = dialog(page);
  const text = `settings-memory-${Date.now()}`;
  await panel.getByLabel("记忆内容", { exact: true }).fill(text);
  await expect(
    panel.getByRole("button", { name: "添加记忆", exact: true }),
  ).toBeDisabled();
  await panel.getByRole("checkbox").check();
  await panel.getByRole("button", { name: "添加记忆", exact: true }).click();
  const row = panel
    .locator(".settings-memory-list li")
    .filter({ hasText: text });
  await expect(row).toBeVisible();
  const memory = await page.evaluate(
    async (text) =>
      (await (await fetch("/api/profile")).json()).memories.find(
        (item: { content: string }) => item.content === text,
      ),
    text,
  );
  expect(memory.consent).toBe(true);
  page.once("dialog", (confirmation) => confirmation.accept());
  await row.getByRole("button", { name: "删除", exact: true }).click();
  await expect(row).toHaveCount(0);
});

test("resource errors offer retry instead of claiming an empty or connected state", async ({
  page,
}) => {
  await page.route("**/api/connectors", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: '{"error":"offline"}',
    }),
  );
  await open(page, "应用管理");
  await expect(dialog(page).getByRole("alert")).toContainText("无法读取数据");
  await expect(
    dialog(page).getByText("暂无应用连接记录", { exact: true }),
  ).toHaveCount(0);
  await page.unroute("**/api/connectors");
  await dialog(page)
    .locator(".settings-empty")
    .getByRole("button", { name: "重新加载" })
    .click();
  await expect(dialog(page).getByRole("alert")).toHaveCount(0);
});

test("security rejects a wrong password and never reports success", async ({
  page,
}) => {
  await open(page, "安全中心");
  const panel = dialog(page);
  await panel.getByLabel("当前密码", { exact: true }).fill("wrong-password");
  await panel
    .getByLabel("新密码", { exact: true })
    .fill("not-a-real-password-change-123");
  await panel.getByRole("button", { name: "保存更改" }).click();
  await expect(panel.getByRole("alert")).toBeVisible();
  await expect(panel.getByText("密码已更新。", { exact: true })).toHaveCount(0);
  await panel.getByRole("button", { name: "取消", exact: true }).click();
  await expect(panel.getByLabel("当前密码", { exact: true })).toHaveValue("");
});

test("installed assistant extension toggle waits for the server and persists", async ({
  page,
}) => {
  let enabled = true;
  const plugin = {
    id: "test-bundle",
    name: "Test extension",
    version: "1.0.0",
    skills: ["test"],
    permissions: [],
    description: "Test extension description",
  };
  await page.route("**/api/plugins", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        installed: [{ ...plugin, status: enabled ? "enabled" : "disabled" }],
      }),
    }),
  );
  await page.route("**/api/plugins/test-bundle/status", async (route) => {
    const status = route.request().postDataJSON().status;
    enabled = status === "enabled";
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ plugin: { ...plugin, status } }),
    });
  });
  await open(page, "助理");
  const toggle = dialog(page).getByRole("switch", {
    name: "切换扩展：Test extension",
  });
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(dialog(page).getByRole("status")).toContainText(
    "扩展状态已更新",
  );
});

test("theme previews support keyboard navigation", async ({ page }) => {
  await open(page, "外观");
  const cards = dialog(page)
    .getByRole("radiogroup", { name: "界面主题预览" })
    .getByRole("radio");
  await cards.first().focus();
  await page.keyboard.press("End");
  await expect(cards.last()).toBeFocused();
  await expect(cards.last()).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowRight");
  await expect(cards.nth(1)).toHaveAttribute("aria-checked", "true");
});

test.describe("isolated account security", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test("password change succeeds with valid credentials and the old password stops working", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("dialog.settings-window")).toBeAttached();
    const username = `settings_pwd_${Date.now().toString(36)}`;
    const created = await page.evaluate(async (username) => {
      await fetch("/api/local/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password: "settings-old-password-123",
        }),
      });
      return response.status;
    }, username);
    expect(created).toBe(201);
    await open(page, "安全中心");
    await dialog(page)
      .getByLabel("当前密码", { exact: true })
      .fill("settings-old-password-123");
    await dialog(page)
      .getByLabel("新密码", { exact: true })
      .fill("settings-new-password-456");
    await dialog(page).getByRole("button", { name: "保存更改" }).click();
    await expect(dialog(page).getByRole("status")).toContainText("密码已更新");
    const results = await page.evaluate(async (username) => {
      const login = (password: string) =>
        fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
      return [
        (await login("settings-old-password-123")).status,
        (await login("settings-new-password-456")).status,
      ];
    }, username);
    expect(results).toEqual([401, 200]);
  });
});

test("English copy fits narrow panes without untranslated key names", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, "通用");
  await dialog(page).getByLabel("语言", { exact: true }).selectOption("en");
  const panel = page.getByRole("dialog", { name: "Settings", exact: true });
  for (let index = 0; index < sections.length; index++) {
    await panel.getByRole("navigation").getByRole("button").nth(index).click();
    await expect(panel.locator(".settings-loading")).toHaveCount(0);
    await expect(panel.locator(".settings-content")).not.toContainText(
      "settings.design.",
    );
    expect(
      await panel
        .locator(".settings-content")
        .evaluate((el) => el.scrollWidth - el.clientWidth),
    ).toBeLessThanOrEqual(1);
  }
});
