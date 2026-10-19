import { test, expect, type Page } from "@playwright/test";
import { resolve } from "node:path";

const root = `/@fs${resolve(process.cwd(), "../..")}`;
const prefModule = `${root}/frontend/workspace/settingsStore.ts`;
const catalogModule = `${root}/frontend/workspace/i18nCatalogs/settingsDesignLocales.ts`;
const englishModule = `${root}/frontend/workspace/i18nCatalogs/settingsDesign.ts`;
const i18nModule = `${root}/frontend/workspace/i18n.ts`;
const panel = (page: Page) =>
  page.getByRole("dialog", { name: "设置", exact: true });
const input = (page: Page) =>
  page.getByRole("textbox", { name: "任务描述", exact: true });
async function section(page: Page, name: string) {
  if (!(await panel(page).isVisible())) await page.keyboard.press("Control+,");
  await panel(page)
    .getByRole("navigation")
    .getByRole("button", { name, exact: true })
    .click();
}
async function close(page: Page) {
  await panel(page)
    .getByRole("button", { name: "关闭设置", exact: true })
    .click();
}
const match = {
  kind: "match",
  expertId: "data",
  collaboratorIds: ["communication"],
  reason: "核验数据",
  responsibilities: ["核验数据"],
  missing: [],
};

test.beforeEach(async ({ page }) => {
  // Keep cross-device preference writes out of other test accounts. All other APIs are real unless explicitly mocked below.
  await page.route("**/api/profile/preferences", (route) =>
    route.fulfill({
      json:
        route.request().method() === "GET"
          ? { preferences: [] }
          : { preference: { updatedAt: Date.now() } },
    }),
  );
});

test("role editing saves and cancels; disabling affects matching and manual candidates after reload", async ({
  page,
}) => {
  const requests: any[] = [];
  await page.route("**/api/expert-match", (route) => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ json: { kind: "general", reason: "无需专家" } });
  });
  await page.goto("/");
  await section(page, "智能体");
  const card = panel(page).locator('[data-role-id="data"]');
  await card.locator("summary").click();
  await card
    .getByLabel("职责说明", { exact: true })
    .fill("核对实际来源，不编造数字");
  await card.getByLabel("补充工作规范").fill("SETTINGS-ROLE-GUIDANCE-2026");
  await card.getByRole("button", { name: "保存更改", exact: true }).click();
  await card.getByLabel("补充工作规范").fill("未保存的修改");
  await card.getByRole("button", { name: "取消", exact: true }).click();
  await expect(card.getByLabel("补充工作规范")).toHaveValue(
    "SETTINGS-ROLE-GUIDANCE-2026",
  );
  await card.getByRole("switch").click();
  await expect(card.getByRole("switch")).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await page.reload();
  await section(page, "智能体");
  await expect(card.getByRole("switch")).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await close(page);
  await page.locator(".home-expert-trigger").click();
  await page.getByRole("button", { name: "手动选择专家", exact: true }).click();
  const manual = page.getByRole("dialog", { name: "专家选项", exact: true });
  await manual.getByRole("textbox").fill("数据分析专家");
  await expect(
    manual.getByRole("button", { name: "数据分析专家", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await section(page, "助理");
  await panel(page)
    .getByRole("switch", { name: "自动匹配专家", exact: true })
    .click();
  await close(page);
  await input(page).fill("核验实际来源并整理数据分析报表");
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  expect(requests.at(-1).experts.some((role: any) => role.id === "data")).toBe(
    false,
  );
  await section(page, "智能体");
  await card.getByRole("switch").click();
  await close(page);
  await input(page).fill("核验实际来源并整理更新后的数据分析报表");
  await expect
    .poll(
      () =>
        requests.at(-1)?.experts.find((role: any) => role.id === "data")
          ?.method[0],
    )
    .toBe("SETTINGS-ROLE-GUIDANCE-2026");
});

test("assistant delay and collaboration preferences change requests and execution; consent stays disabled on reload", async ({
  page,
}) => {
  const requests: any[] = [],
    chats: any[] = [];
  await page.route("**/api/expert-match", (route) => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ json: match });
  });
  await page.route("**/api/chat", (route) => {
    chats.push(route.request().postDataJSON());
    return route.fulfill({
      contentType: "text/event-stream",
      body: 'data: {"choices":[{"delta":{"content":"完成"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
    });
  });
  await page.goto("/");
  await section(page, "智能体");
  const role = panel(page).locator('[data-role-id="data"]');
  await role.locator("summary").click();
  await role.getByLabel("补充工作规范").fill("EXECUTION-PREFERENCE-CHECK");
  await role.getByRole("button", { name: "保存更改", exact: true }).click();
  await section(page, "助理");
  await panel(page)
    .getByRole("switch", { name: "自动匹配专家", exact: true })
    .click();
  await panel(page).getByText("高级选项", { exact: true }).click();
  await panel(page).getByLabel("停止输入后的等待时间").selectOption("3000");
  await panel(page).getByRole("switch", { name: "使用协作专家规范" }).click();
  await close(page);
  await input(page).fill("请整理这份报销数据并核验金额");
  await page.waitForTimeout(1200);
  expect(requests).toHaveLength(0);
  await expect.poll(() => requests.length).toBe(1);
  await expect(page.locator(".home-expert-trigger")).toContainText(
    "推荐：数据分析专家",
  );
  await page.getByRole("button", { name: "开始任务", exact: true }).click();
  await expect.poll(() => chats.length).toBe(1);
  const body = JSON.stringify(chats[0]);
  expect(body).toContain("EXECUTION-PREFERENCE-CHECK");
  expect(body).not.toContain("协作专家（仅按明确分工");
  await page.goto("/");
  await section(page, "助理");
  await panel(page)
    .getByRole("switch", { name: "自动匹配专家", exact: true })
    .click();
  await page.reload();
  await section(page, "助理");
  await expect(
    panel(page).getByRole("switch", { name: "自动匹配专家", exact: true }),
  ).toHaveAttribute("aria-checked", "false");
  await panel(page).getByText("高级选项", { exact: true }).click();
  await expect(panel(page).getByLabel("停止输入后的等待时间")).toHaveValue(
    "3000",
  );
  await close(page);
  await input(page).fill("关闭后不再发送草稿");
  await page.waitForTimeout(3200);
  expect(requests).toHaveLength(1);
});

test("preference validation bounds public role settings and account sync never grants draft-sharing consent", async ({
  page,
}) => {
  const writes: any[] = [];
  await page.route("**/api/profile/preferences", (route) => {
    if (route.request().method() !== "GET")
      writes.push(route.request().postDataJSON());
    return route.fulfill({
      json:
        route.request().method() === "GET"
          ? {
              preferences: [
                {
                  key: "workspace.preferences",
                  value: {
                    assistant: {
                      autoMatch: true,
                      debounceMs: 1500,
                      collaborators: false,
                    },
                  },
                },
              ],
            }
          : { preference: { updatedAt: Date.now() } },
    });
  });
  await page.goto("/");
  const result = await page.evaluate(async (url) => {
    const module = await import(url);
    const sanitized = module.sanitizePreferences({
      expertSettings: {
        data: {
          enabled: false,
          instructions: "a".repeat(1500),
          description: "d".repeat(2000),
          apiKey: "private",
        },
        "bad/id": {},
      },
      assistant: { autoMatch: "true", debounceMs: 1, collaborators: false },
    });
    await module.syncPreferencesFromAccount();
    const restored = module.usePreferences.getState().assistant;
    module.setAssistantPreferences({ autoMatch: true });
    await module.pushPreferencesToAccount();
    return { sanitized, restored };
  }, prefModule);
  expect(result.sanitized.assistant).toEqual({
    autoMatch: false,
    debounceMs: 900,
    collaborators: false,
  });
  expect(result.sanitized.expertSettings.data.instructions).toHaveLength(400);
  expect(result.sanitized.expertSettings.data.description).toHaveLength(1200);
  expect(Object.keys(result.sanitized.expertSettings)).toEqual(["data"]);
  expect(JSON.stringify(result.sanitized)).not.toContain("private");
  expect(result.restored.autoMatch).toBe(false);
  expect(result.restored.debounceMs).toBe(1500);
  expect(writes.at(-1).value.assistant).not.toHaveProperty("autoMatch");
});

test("custom application configuration supports validation, cancel, persistence and removal even without authorization service", async ({
  page,
}) => {
  await page.goto("/");
  await section(page, "应用管理");
  await expect(panel(page).getByRole("alert")).toContainText("授权服务未配置");
  await panel(page).getByRole("button", { name: "添加自定义应用" }).click();
  await panel(page)
    .getByLabel("应用名称", { exact: true })
    .fill("LOCAL-CONFIG-APP");
  await panel(page)
    .getByLabel("HTTPS 服务地址")
    .fill("https://user:secret@example.com/api");
  await panel(page)
    .getByRole("button", { name: "保存更改", exact: true })
    .click();
  await expect(panel(page).getByRole("alert").last()).toContainText(
    "请输入不含凭据",
  );
  await panel(page)
    .getByLabel("HTTPS 服务地址")
    .fill("https://tools.example.com/mcp");
  await panel(page)
    .getByRole("button", { name: "保存更改", exact: true })
    .click();
  const card = panel(page)
    .locator(".settings-app-card")
    .filter({ hasText: "LOCAL-CONFIG-APP" });
  await expect(card).toContainText("未核验");
  await page.reload();
  await section(page, "应用管理");
  await expect(card).toContainText("https://tools.example.com/mcp");
  await card.getByRole("button", { name: "配置", exact: true }).click();
  await panel(page).getByLabel("应用名称", { exact: true }).fill("UNSAVED");
  await panel(page).getByRole("button", { name: "取消", exact: true }).click();
  await expect(card).toBeVisible();
  page.once("dialog", (d) => d.dismiss());
  await card.getByRole("button", { name: "删除", exact: true }).click();
  await expect(card).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await card.getByRole("button", { name: "删除", exact: true }).click();
  await expect(card).toHaveCount(0);
});

test("authorization failure never creates a connection; verified remote connections disconnect only after server confirmation", async ({
  page,
}) => {
  let connected = true;
  let fail = true;
  await page.route("**/api/connectors", (route) =>
    route.fulfill({
      json: [
        {
          id: "github",
          name: "GitHub",
          description: "Verified fixture",
          provider: "github",
          status: connected ? "connected" : "disconnected",
          scopes: [],
        },
      ],
    }),
  );
  await page.route("**/api/connectors/github/disconnect", (route) => {
    if (!fail) connected = false;
    return route.fulfill({
      status: fail ? 503 : 200,
      json: fail ? { error: "disconnect unavailable" } : { ok: true },
    });
  });
  await page.route("**/api/connectors/oauth/start", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "authorization unavailable" },
    }),
  );
  await page.goto("/");
  await section(page, "应用管理");
  const card = panel(page)
    .locator(".settings-app-card")
    .filter({
      has: page.getByRole("heading", { name: "GitHub", exact: true }),
    });
  await expect(card).toContainText("已连接");
  page.once("dialog", (d) => d.accept());
  await card.getByRole("button", { name: "断开连接" }).click();
  await expect(panel(page).getByRole("alert")).toContainText(
    "disconnect unavailable",
  );
  await expect(card).toContainText("已连接");
  fail = false;
  page.once("dialog", (d) => d.accept());
  await card.getByRole("button", { name: "断开连接" }).click();
  await expect(card.locator(".settings-status-tag")).toHaveText("未连接");
  await card.getByRole("button", { name: "授权连接" }).click();
  await expect(panel(page).getByRole("alert")).toContainText(
    "authorization unavailable",
  );
  await expect(card.locator(".settings-status-tag")).toHaveText("未连接");
});

test("extension install, toggle and uninstall wait for server success; failed uninstall keeps its state", async ({
  page,
}) => {
  let installed = false,
    enabled = true,
    fail = true;
  const plugin = {
    id: "settings-test",
    name: "Settings extension",
    version: "1.0",
    apiVersion: "1.0",
    description: "Protocol fixture",
    skills: [],
    permissions: ["filesystem.read"],
    requires: [],
    compatible: true,
    compatibleReason: "",
  };
  await page.route("**/api/plugins", (route) =>
    route.fulfill({
      json: {
        bundles: [{ ...plugin, installed }],
        installed: installed
          ? [{ ...plugin, status: enabled ? "enabled" : "disabled" }]
          : [],
      },
    }),
  );
  await page.route("**/api/plugins/install", (route) => {
    installed = true;
    return route.fulfill({ json: { plugin } });
  });
  await page.route("**/api/plugins/settings-test/status", (route) => {
    enabled = false;
    return route.fulfill({
      json: { plugin: { ...plugin, status: "disabled" } },
    });
  });
  await page.route("**/api/plugins/settings-test", (route) => {
    if (!fail) installed = false;
    return route.fulfill({
      status: fail ? 503 : 200,
      json: fail ? { error: "uninstall denied" } : { ok: true },
    });
  });
  await page.goto("/");
  await section(page, "助理");
  await panel(page).getByRole("button", { name: "安装", exact: true }).click();
  await expect(
    panel(page).getByRole("switch", { name: "切换扩展：Settings extension" }),
  ).toHaveAttribute("aria-checked", "true");
  await panel(page)
    .getByRole("switch", { name: "切换扩展：Settings extension" })
    .click();
  await expect(
    panel(page).getByRole("switch", { name: "切换扩展：Settings extension" }),
  ).toHaveAttribute("aria-checked", "false");
  page.once("dialog", (d) => d.accept());
  await panel(page).getByRole("button", { name: "卸载", exact: true }).click();
  await expect(panel(page).getByRole("alert")).toContainText(
    "uninstall denied",
  );
  await expect(
    panel(page).getByRole("switch", { name: "切换扩展：Settings extension" }),
  ).toHaveCount(1);
  fail = false;
  page.once("dialog", (d) => d.accept());
  await panel(page).getByRole("button", { name: "卸载", exact: true }).click();
  await expect(
    panel(page).getByRole("switch", { name: "切换扩展：Settings extension" }),
  ).toHaveCount(0);
});

async function addModel(page: Page) {
  await section(page, "模型");
  await panel(page)
    .getByRole("button", { name: "添加模型", exact: true })
    .click();
  const editor = page.getByRole("dialog", { name: "添加模型", exact: true });
  await editor.getByRole("combobox").first().selectOption("deepseek");
  await editor
    .getByLabel("API Key", { exact: true })
    .fill("private-session-key-for-check");
  await editor
    .getByLabel("模型名称", { exact: true })
    .fill("settings-probe-model");
  await editor.getByRole("button", { name: "保存", exact: true }).click();
  return panel(page)
    .locator(".settings-model-list article")
    .filter({ hasText: "settings-probe-model" });
}

test("model list distinguishes verified, reachable and failed; key edits invalidate checks and reload never revives stale success", async ({
  page,
}) => {
  let result = { ok: true, modelFound: true, modelCount: 1 };
  const requests: any[] = [];
  await page.route("**/api/ai/test-connection", (route) => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ json: result });
  });
  await page.goto("/");
  const row = await addModel(page);
  await expect(row.locator("[data-check-status]")).toHaveAttribute(
    "data-check-status",
    "unverified",
  );
  await row.getByRole("button", { name: "测试连接", exact: true }).click();
  await expect(row.locator("[data-check-status]")).toHaveAttribute(
    "data-check-status",
    "verified",
  );
  expect(requests[0].apiKey).toBe("private-session-key-for-check");
  await row.getByRole("button", { name: /^编辑/ }).click();
  const editor = page.getByRole("dialog", { name: "编辑模型", exact: true });
  await editor
    .getByLabel("API Key", { exact: true })
    .fill("new-private-session-key");
  await editor.getByRole("button", { name: "保存", exact: true }).click();
  await expect(row.locator("[data-check-status]")).toHaveAttribute(
    "data-check-status",
    "unverified",
  );
  result = { ok: true, modelFound: false, modelCount: 0 };
  await row.getByRole("button", { name: "测试连接", exact: true }).click();
  await expect(row.locator("[data-check-status]")).toHaveAttribute(
    "data-check-status",
    "reachable",
  );
  result = { ok: false, modelFound: false, modelCount: 0 };
  await row.getByRole("button", { name: "测试连接", exact: true }).click();
  await expect(row.locator("[data-check-status]")).toHaveAttribute(
    "data-check-status",
    "failed",
  );
  const stored = await page.evaluate(() => JSON.stringify(localStorage));
  expect(stored).not.toContain("private-session-key");
  await page.reload();
  await section(page, "模型");
  await expect(row.locator("[data-check-status]")).toHaveAttribute(
    "data-check-status",
    "unverified",
  );
});

test("all 19 locales provide every new settings key and preserve interpolation parameters", async ({
  page,
}) => {
  await page.goto("/");
  const failures = await page.evaluate(
    async ({ catalogModule, englishModule, i18nModule }) => {
      const { settingsDesignLocales, settingsDesignAliases } = await import(
        catalogModule
      );
      const { settingsDesignCopy } = await import(englishModule);
      const { translate } = await import(i18nModule);
      const errors: string[] = [];
      const params = (value: string) =>
        (value.match(/\{[^}]+\}/g) || []).sort().join(",");
      for (const [locale, copy] of Object.entries(settingsDesignLocales) as [
        string,
        Record<string, string>,
      ][]) {
        for (const [key, pair] of Object.entries(settingsDesignCopy) as [
          string,
          [string, string],
        ][]) {
          const raw = copy[key];
          if (!raw && !settingsDesignAliases[key])
            errors.push(`${locale}/${key}: missing`);
          const actual = translate(locale, `settings.design.${key}`);
          if (
            !actual ||
            actual.startsWith("settings.design.") ||
            params(actual) !== params(pair[1])
          )
            errors.push(`${locale}/${key}: invalid`);
        }
      }
      return {
        errors,
        locales: Object.keys(settingsDesignLocales).length,
        keys: Object.keys(settingsDesignCopy).length,
      };
    },
    { catalogModule, englishModule, i18nModule },
  );
  expect(failures.locales).toBe(17);
  expect(failures.keys).toBeGreaterThan(150);
  expect(failures.errors).toEqual([]);
});

test("new forms fit narrow localized and RTL settings with long content in light and dark", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/");
  await section(page, "通用");
  for (const locale of [
    "ja",
    "ko",
    "id",
    "de",
    "es-ES",
    "pt-BR",
    "fr",
    "it",
    "pl",
    "ru",
    "ar",
    "fa",
    "hu",
    "th",
    "tr",
    "uk",
    "zh-TW",
    "en",
    "zh-CN",
  ]) {
    const modal = page.locator("dialog.settings-window");
    await modal.getByRole("navigation").getByRole("button").nth(0).click();
    await modal.locator("#settings-language").selectOption(locale);
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (theme) => (document.documentElement.dataset.theme = theme),
        theme,
      );
      for (const target of ["agents", "assistant", "apps", "models"]) {
        await modal
          .getByRole("navigation")
          .getByRole("button")
          .nth({ agents: 7, assistant: 9, apps: 12, models: 8 }[target]!)
          .click();
        if (target === "agents")
          await modal.locator(".settings-role-editor summary").first().click();
        if (target === "assistant")
          await modal.locator(".settings-assistant-advanced summary").click();
        await expect(modal.locator(".settings-loading")).toHaveCount(0);
        expect(
          await modal
            .locator(".settings-content")
            .evaluate((el) => el.scrollWidth - el.clientWidth),
          `${locale}/${theme}/${target}`,
        ).toBeLessThanOrEqual(1);
        expect(await modal.innerText()).not.toContain("settings.design.");
      }
    }
    await expect(page.locator("html")).toHaveAttribute(
      "dir",
      locale === "ar" || locale === "fa" ? "rtl" : "ltr",
    );
  }
});

test("disabled role cannot be launched from its detail page", async ({
  page,
}) => {
  await page.goto("/");
  await section(page, "智能体");
  await panel(page)
    .locator('[data-role-id="data"]')
    .getByRole("switch")
    .click();
  await panel(page)
    .locator('[data-role-id="data"]')
    .locator(".settings-expert-bottom button")
    .click();
  await expect(page).toHaveURL(/\/experts\/data$/);
  await page.getByRole("button", { name: "用于当前任务", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("该角色已停用");
  await expect(page).toHaveURL(/\/experts\/data$/);
});

test("storage failure never keeps draft sharing enabled when the user disables it", async ({
  page,
}) => {
  await page.goto("/");
  await section(page, "助理");
  const toggle = panel(page).getByRole("switch", {
    name: "自动匹配专家",
    exact: true,
  });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    (window as any).__restoreSettingsStorage = () => {
      Storage.prototype.setItem = original;
    };
    Storage.prototype.setItem = function (key, value) {
      if (key === "designbuddy.preferences.v1")
        throw new DOMException("full", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(panel(page).getByRole("alert")).toContainText("配置未保存");
  await page.evaluate(() => (window as any).__restoreSettingsStorage());
});

test("a late editor test cannot verify a model after the key is edited", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started = false;
  await page.route("**/api/ai/test-connection", async (route) => {
    started = true;
    await gate;
    await route.fulfill({
      json: { ok: true, modelFound: true, modelCount: 1 },
    });
  });
  await page.goto("/");
  const row = await addModel(page);
  await row.getByRole("button", { name: /^编辑/ }).click();
  const editor = page.getByRole("dialog", { name: "编辑模型", exact: true });
  await editor.getByRole("button", { name: "测试连接", exact: true }).click();
  await expect.poll(() => started).toBe(true);
  await editor
    .getByLabel("API Key", { exact: true })
    .fill("changed-while-testing");
  release();
  await expect(
    editor.locator(".settings-model-dialog__connection"),
  ).toHaveCount(0);
  await editor.getByRole("button", { name: "保存", exact: true }).click();
  await expect(row.locator("[data-check-status]")).toHaveAttribute(
    "data-check-status",
    "unverified",
  );
});

test("authorization rejects unexpected provider URLs without changing verified state", async ({
  page,
}) => {
  await page.route("**/api/connectors", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/connectors/oauth/start", (route) =>
    route.fulfill({
      json: { authorizationUrl: "https://unexpected.example/collect" },
    }),
  );
  await page.goto("/");
  await section(page, "应用管理");
  const card = panel(page)
    .locator(".settings-app-card")
    .filter({
      has: page.getByRole("heading", { name: "GitHub", exact: true }),
    });
  await card.getByRole("button", { name: "授权连接" }).click();
  await expect(panel(page).getByRole("alert")).toContainText("已阻止跳转");
  await expect(card.locator(".settings-status-tag")).toHaveText("未核验");
});

test("explicit manual selection beyond the matching catalog limit still uses saved custom-role instructions", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "designbuddy.workspace.v1",
      JSON.stringify({
        version: 0,
        state: {
          experts: Array.from({ length: 26 }, (_, index) => ({
            id: `custom-${index}`,
            name: `Custom role ${index}`,
            description: "Manual selection fixture",
            skills: [],
            capabilities: [],
            status: "active",
            createdAt: new Date().toISOString(),
          })),
          connectors: [],
          skills: [],
          assets: [],
        },
      }),
    );
  });
  await page.goto("/");
  await section(page, "智能体");
  const card = panel(page).locator('[data-role-id="custom-25"]');
  await card.locator("summary").click();
  await card.getByLabel("补充工作规范").fill("CUSTOM-MANUAL-26-GUIDANCE");
  await card.getByRole("button", { name: "保存更改", exact: true }).click();
  await close(page);
  await page.locator(".home-expert-trigger").click();
  await page.getByRole("button", { name: "手动选择专家", exact: true }).click();
  const manual = page.getByRole("dialog", { name: "专家选项", exact: true });
  await manual.getByRole("textbox").fill("Custom role 25");
  await manual
    .getByRole("button", { name: "Custom role 25", exact: true })
    .click();
  await page.locator(".home-expert-trigger").click();
  await expect(page.getByLabel("专家匹配详情")).toContainText(
    "CUSTOM-MANUAL-26-GUIDANCE",
  );
});
