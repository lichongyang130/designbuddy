import { test, expect, type Page } from "@playwright/test";

const settings = (page: Page) =>
  page.getByRole("dialog", { name: "设置", exact: true });

async function open(page: Page, section: string) {
  await page.goto("/");
  await expect(page.locator("dialog.settings-window")).toBeAttached();
  await page.keyboard.press("Control+,");
  await expect(settings(page)).toBeVisible();
  await settings(page).getByRole("button", { name: section, exact: true }).click();
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  const reset = await page.evaluate(async () => {
    const response = await fetch("/api/profile/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "workspace.preferences", value: {} }),
    });
    return response.ok;
  });
  expect(reset).toBe(true);
  const preferencesLoaded = page.waitForResponse(
    (response) => response.url().includes("/profile/preferences") && response.request().method() === "GET",
  );
  await page.reload();
  await preferencesLoaded;
});

test("appearance theme and density apply to the document and persist", async ({
  page,
}) => {
  await open(page, "外观");
  await settings(page).getByRole("radio", { name: "深色" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await settings(page).getByRole("radio", { name: "紧凑" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-density", "compact");
  await page.reload();
  // Preferences re-apply on boot without opening settings.
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-density", "compact");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "模版", exact: true }).click();
  const community = page.locator(".samples-community");
  await expect(community).toBeVisible();
  await expect(community).toHaveCSS("background-color", "rgb(15, 17, 21)");
  await expect(page.locator(".sample-card").first()).toHaveCSS("background-color", "rgb(23, 26, 33)");
  await page.locator(".sample-card > button").first().click();
  const templateControls = page.locator(".template-cloud");
  await expect(templateControls).toBeVisible();
  await expect(templateControls).toHaveCSS("background-color", "rgb(23, 26, 33)");
  await open(page, "外观");
  await settings(page).getByRole("radio", { name: /^浅色 默认灰白外观$/ }).click();
  await settings(page).getByRole("radio", { name: "舒适" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("personalization scenes and composer defaults take effect", async ({
  page,
}) => {
  await open(page, "个性化");
  await settings(page).getByLabel("坑位 1").selectOption("meeting");
  await expect(settings(page).getByRole("status")).toContainText("快捷场景已更新");
  await settings(page).getByLabel("默认工作模式").selectOption("code");
  await settings(page).getByLabel("默认工作空间").fill("研发 团队");
  await settings(page).getByLabel("默认执行策略").fill("测试 策略");
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "办公提效" }).click();
  await expect(page.getByRole("button", { name: "会议纪要" })).toBeVisible();
  await page.getByRole("tab", { name: "网页应用" }).click();
  await expect(page.getByRole("tab", { name: "网页应用" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("工作空间")).toHaveValue("研发 团队");
  await expect(page.getByLabel("任务权限")).toHaveValue("测试 策略");
  await page.reload();
  await page.getByRole("tab", { name: "办公提效" }).click();
  await expect(page.getByRole("button", { name: "会议纪要" })).toBeVisible();
  await page.getByRole("tab", { name: "网页应用" }).click();
  await expect(page.getByRole("tab", { name: "网页应用" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("工作空间")).toHaveValue("研发 团队");
  await expect(page.getByLabel("任务权限")).toHaveValue("测试 策略");
  // Restore the defaults so this test does not leak account preferences into later cases.
  await open(page, "个性化");
  await settings(page).getByLabel("坑位 1").selectOption("doc");
  await settings(page).getByLabel("默认工作模式").selectOption("office");
  await settings(page).getByLabel("默认工作空间").fill("");
  await settings(page).getByLabel("默认执行策略").fill("");
  await page.keyboard.press("Escape");
});

test("shortcuts can be rebound, reject conflicts and keep working", async ({
  page,
}) => {
  await open(page, "快捷键");
  const dialog = settings(page);
  const rows = dialog.getByRole("button", { name: "重新录制" });
  // Rebind "打开模板社区" (5th action) to Control+Alt+U.
  await rows.nth(4).click();
  await page.keyboard.press("Control+Alt+U");
  await expect(dialog).toContainText("Ctrl/⌘ + Alt + U");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+Alt+U");
  await expect(page).toHaveURL(/\/inspiration$/);
  // Rebinding another action to the same combo is rejected honestly.
  await open(page, "快捷键");
  await settings(page).getByRole("button", { name: "重新录制" }).first().click();
  await page.keyboard.press("Control+Alt+U");
  await expect(settings(page).getByRole("alert")).toContainText("已被");
  await settings(page).getByRole("button", { name: "恢复默认", exact: true }).click();
  await expect(settings(page).getByRole("status")).toContainText("已恢复默认");
});

test("data section inventories storage and exports a backup", async ({
  page,
}) => {
  await open(page, "数据管理");
  await expect(settings(page)).toContainText("合计");
  await expect(settings(page)).toContainText("设置偏好");
  const pending = page.waitForEvent("download");
  await settings(page).getByRole("button", { name: "导出备份", exact: true }).click();
  const file = await pending;
  expect(file.suggestedFilename()).toMatch(/^designbuddy-backup-.*\.json$/);
});

test("devices section shows the session and exports settings", async ({
  page,
}) => {
  await open(page, "设备连接");
  await expect(settings(page)).toContainText(/游客会话|账号/);
  const pending = page.waitForEvent("download");
  await settings(page).getByRole("button", { name: "导出设置", exact: true }).click();
  const file = await pending;
  expect(file.suggestedFilename()).toMatch(/^designbuddy-settings-.*\.json$/);
});

test("plan section shows honest local usage numbers", async ({ page }) => {
  await open(page, "套餐与积分");
  const dialog = settings(page);
  await expect(dialog).toContainText("不会产生订阅或扣费");
  await expect(dialog).toContainText("设计项目");
  await expect(dialog).toContainText("本地存储占用");
});

test("language setting switches fully translated frame catalogs", async ({
  page,
}) => {
  await open(page, "通用");
  const dialog = settings(page);
  await dialog.getByLabel("语言", { exact: true }).selectOption("en");
  const enDialog = page.getByRole("dialog", { name: "Settings", exact: true });
  await expect(enDialog).toBeVisible();
  // Sidebar, settings nav and home chrome all follow the locale.
  await expect(
    page.getByRole("button", { name: "Templates", exact: true }),
  ).toBeVisible();
  await expect(
    enDialog.getByRole("button", { name: "Appearance", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "DesignBuddy gets work done faster" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Templates", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Control+,");
  await expect(
    page.getByRole("dialog", { name: "Settings", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("dialog", { name: "Settings", exact: true })
    .getByLabel("Language", { exact: true })
    .selectOption("zh-CN");
  await expect(settings(page)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "模版", exact: true }),
  ).toBeVisible();
  const languageSelect = page.locator("#settings-language");
  const translatedLocales = [
    ["ja", "設定"],
    ["zh-TW", "設定"],
    ["id", "Pengaturan"],
    ["de", "Einstellungen"],
    ["es-ES", "Ajustes"],
    ["pt-BR", "Configurações"],
    ["fr", "Paramètres"],
    ["it", "Impostazioni"],
    ["ko", "설정"],
    ["pl", "Ustawienia"],
    ["ru", "Настройки"],
    ["fa", "تنظیمات"],
    ["ar", "الإعدادات"],
    ["hu", "Beállítások"],
    ["uk", "Налаштування"],
    ["tr", "Ayarlar"],
    ["th", "การตั้งค่า"],
  ] as const;
  for (const [locale, title] of translatedLocales) {
    await languageSelect.selectOption(locale);
    const localizedDialog = page.getByRole("dialog", { name: title, exact: true });
    await expect(localizedDialog).toBeVisible();
    await expect(localizedDialog.locator(".settings-language-fallback")).toHaveCount(0);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("html")).toHaveAttribute(
      "dir",
      locale === "ar" || locale === "fa" ? "rtl" : "ltr",
    );
  }
  const restoreLocale = page.waitForResponse((response) =>
    response.url().includes("/profile/preferences") && response.request().method() === "PUT",
  );
  await languageSelect.selectOption("zh-CN");
  await restoreLocale;
  await expect(settings(page)).toBeVisible();
});

test("wake lock toggle reflects real browser support", async ({ page }) => {
  await open(page, "通用");
  const dialog = settings(page);
  const wakeLock = dialog.getByRole("switch", {
    name: "运行时防止系统休眠",
  });
  await wakeLock.click();
  if ((await wakeLock.getAttribute("aria-checked")) === "true") {
    await expect(wakeLock).toHaveAttribute("aria-checked", "true");
    await wakeLock.click();
    await expect(wakeLock).toHaveAttribute("aria-checked", "false");
  } else {
    await expect(dialog.getByRole("alert")).toContainText("唤醒锁定");
  }
});

test("additional locale codes are selectable, translated and persist across reload", async ({
  page,
}) => {
  await open(page, "通用");
  const select = page.locator("#settings-language");
  await expect(select.locator("option")).toHaveCount(19);
  const japaneseSaved = page.waitForResponse((response) =>
    response.url().includes("/profile/preferences") && response.request().method() === "PUT",
  );
  await select.selectOption("ja");
  await japaneseSaved;
  await expect(select).toHaveValue("ja");
  await expect(page.locator("html")).toHaveAttribute("data-locale", "ja");
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  await expect(page.locator(".settings-language-fallback")).toHaveCount(0);
  await page.reload();
  await expect(page.locator("dialog.settings-window")).toBeAttached();
  await page.keyboard.press("Control+,");
  const dialog = page.locator("dialog.settings-window");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("#settings-language")).toHaveValue("ja");
  const chineseSaved = page.waitForResponse((response) =>
    response.url().includes("/profile/preferences") && response.request().method() === "PUT",
  );
  await dialog.locator("#settings-language").selectOption("zh-CN");
  await chineseSaved;
  await expect(settings(page)).toBeVisible();
});

test("wake-lock denial is surfaced and disables the preference only when runtime work begins", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).__wakeLockFailures = 0;
    (window as any).__wakeLockRequests = 0;
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: {
        request: async () => {
          (window as any).__wakeLockRequests += 1;
          await new Promise((resolve) => setTimeout(resolve, 250));
          throw new Error("permission denied");
        },
      },
    });
    window.addEventListener("designbuddy:wake-lock-failed", () => {
      (window as any).__wakeLockFailures += 1;
    });
  });
  await page.route("**/api/chat", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    await route.fulfill({ contentType: "text/event-stream", body: 'data: {"choices":[{"delta":{"content":"已完成"}}]}\n\ndata: [DONE]\n\n' });
  });
  await open(page, "通用");
  const dialog = settings(page);
  const wakeLock = dialog.getByRole("switch", {
    name: "运行时防止系统休眠",
  });
  await wakeLock.click();
  await expect(wakeLock).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");
  await page.getByRole("textbox", { name: "任务描述", exact: true }).fill("验证运行时唤醒锁");
  await page.getByRole("button", { name: "开始任务", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__wakeLockRequests as number)).toBe(1);
  await page.keyboard.press("Control+,");
  await expect(settings(page)).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).__wakeLockFailures as number)).toBe(1);
  await expect(settings(page).getByRole("alert")).toContainText("屏幕唤醒锁");
  await expect(
    settings(page).getByRole("switch", { name: "运行时防止系统休眠" }),
  ).toHaveAttribute("aria-checked", "false");
});

test("local-data wipe clears tab-local data, reloads, and preserves the auth token", async ({
  page,
}) => {
  await page.goto("/");
  const tokenBefore = await page.evaluate(() => localStorage.getItem("designbuddy.auth-token.v1"));
  await page.evaluate(() => {
    localStorage.setItem("designbuddy.projects.v1", JSON.stringify([{ id: "wipe-check" }]));
    sessionStorage.setItem("designbuddy.ai-provider.v1", JSON.stringify({ provider: "openai", apiKey: "test-only" }));
  });
  await open(page, "数据管理");
  const loaded = page.waitForEvent("load");
  page.on("dialog", (dialog) => { void dialog.accept(); });
  await settings(page).getByRole("button", { name: "全部清空", exact: true }).click();
  await loaded;
  const after = await page.evaluate(() => ({
    project: localStorage.getItem("designbuddy.projects.v1"),
    provider: sessionStorage.getItem("designbuddy.ai-provider.v1"),
    token: localStorage.getItem("designbuddy.auth-token.v1"),
  }));
  expect(after.project).toBeNull();
  expect(after.provider).toBeNull();
  expect(after.token).toBe(tokenBefore);
});

test("profile and feature panels label informational sections and their real destinations", async ({
  page,
}) => {
  await open(page, "个人主页");
  await expect(settings(page)).toContainText("套餐、钱包、支付和自动充值服务尚未接入");
  await settings(page).getByRole("button", { name: "后台连接状态" }).click();
  const serverPanel = page.getByRole("dialog", { name: "后台连接状态" });
  await expect(serverPanel).toBeVisible();
  await serverPanel.getByRole("button", { name: "关闭服务器窗口" }).click();
  await open(page, "个人主页");
  await settings(page).getByRole("button", { name: "账号与数据", exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole("heading", { name: "个人主页", level: 1 })).toBeVisible();

  const destinations = [
    { section: "记忆与进化", button: "账号与数据", path: "/profile" },
    { section: "智能体", button: "管理专家", path: "/experts" },
    { section: "助理", button: "查看插件", path: "/plugins" },
    { section: "应用管理", button: "管理连接器", path: "/connectors" },
  ];
  for (const destination of destinations) {
    await open(page, destination.section);
    if (destination.section === "记忆与进化") {
      await expect(settings(page)).toContainText("跨对话长期记忆");
    }
    await settings(page).getByRole("button", { name: destination.button, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${destination.path.replaceAll("/", "\\/")}$`));
  }

  await open(page, "安全中心");
  await expect(settings(page)).toContainText("不会自动获得授权");
  await expect(settings(page).locator(".settings-info button")).toHaveCount(0);
});
