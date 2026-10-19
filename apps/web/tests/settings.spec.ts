import { test, expect, type Page } from "@playwright/test";
const KEY = "designbuddy.preferences.v1";
const settings = (page: Page) =>
  page.getByRole("dialog", { name: "设置", exact: true });
async function open(page: Page, models = false) {
  await expect(page.locator("dialog.settings-window")).toBeAttached();
  await page.keyboard.press("Control+,");
  await expect(settings(page)).toBeVisible();
  if (models)
    await settings(page)
      .getByRole("button", { name: "模型", exact: true })
      .click();
}
async function loadHomeWithPreferences(
  page: Page,
): Promise<{ wakeLock?: boolean }> {
  await page.goto("/");
  await expect(page.locator("dialog.settings-window")).toBeAttached();
  // Read in the new document: a late response from the previous document loses
  // its body on navigation and must not be mistaken for the newly loaded state.
  const body = await page.evaluate(async () => {
    const response = await fetch("/api/profile/preferences");
    if (!response.ok) throw new Error("Preferences could not be read");
    return (await response.json()) as {
      preferences?: { key: string; value: unknown }[];
    };
  });
  const value = body.preferences?.find(
    (entry) => entry.key === "workspace.preferences",
  )?.value;
  return value && typeof value === "object"
    ? (value as { wakeLock?: boolean })
    : {};
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
    (response) =>
      response.url().includes("/profile/preferences") &&
      response.request().method() === "GET",
  );
  await page.reload();
  await preferencesLoaded;
});
async function add(page: Page, id = "custom-test-v1") {
  await settings(page)
    .getByRole("button", { name: "添加模型", exact: true })
    .click();
  const editor = page.getByRole("dialog", { name: "添加模型", exact: true });
  await editor.getByRole("combobox").first().selectOption("server");
  await editor.getByLabel("模型名称", { exact: true }).fill(id);
  await editor.getByRole("button", { name: "保存", exact: true }).click();
}

test("reference 13 empty model page, searchable settings and accurate unsupported sections", async ({
  page,
}) => {
  await page.goto("/");
  await open(page, true);
  const dialog = settings(page);
  await expect(
    dialog.getByRole("heading", { name: "自定义模型", exact: true }),
  ).toBeVisible();
  await expect(dialog.getByRole("form")).toHaveCount(0);
  await expect(dialog.getByRole("region", { name: "已添加模型" })).toHaveCount(
    0,
  );
  await expect(dialog).toContainText("模型配置保存在此浏览器中");
  await dialog.getByLabel("搜索设置项", { exact: true }).fill("模型");
  await expect(dialog.getByRole("navigation").getByRole("button")).toHaveCount(
    1,
  );
  await dialog.getByLabel("搜索设置项", { exact: true }).fill("没有这样的设置");
  await expect(dialog.getByText("没有匹配的设置项")).toBeVisible();
  await dialog.getByRole("button", { name: "清空设置搜索" }).click();
  await dialog.getByRole("button", { name: "套餐与积分", exact: true }).click();
  await expect(dialog).toContainText("不会产生订阅或扣费");
  await dialog.getByRole("button", { name: "应用管理", exact: true }).click();
  await dialog.getByRole("button", { name: "管理连接器", exact: true }).click();
  await expect(page).toHaveURL(/\/connectors$/);
  await expect(dialog).not.toBeVisible();
});

test("font and link settings persist, apply to actual task UI and reset to default", async ({
  page,
}) => {
  await page.route("**/api/chat", (route) =>
    route.fulfill({
      contentType: "text/event-stream",
      body: `data: ${JSON.stringify({ choices: [{ delta: { content: "[外部链接](https://example.com) 和 [站内链接](/projects)" } }] })}\n\ndata: [DONE]\n\n`,
    }),
  );
  await page.goto("/");
  await open(page);
  await settings(page)
    .getByLabel("链接打开方式", { exact: true })
    .selectOption("same-tab");
  const range = settings(page).getByRole("slider", { name: "字体大小" });
  await range.focus();
  await range.press("End");
  await expect(range).toHaveValue("20");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("textbox", { name: "任务描述", exact: true }),
  ).toHaveCSS("font-size", "20px");
  await page.reload();
  await open(page);
  await expect(
    settings(page).getByLabel("链接打开方式", { exact: true }),
  ).toHaveValue("same-tab");
  await expect(
    settings(page).getByRole("slider", { name: "字体大小" }),
  ).toHaveValue("20");
  await page.keyboard.press("Escape");
  await page
    .getByRole("textbox", { name: "任务描述", exact: true })
    .fill("检查链接策略和字体");
  await page.getByRole("button", { name: "开始任务", exact: true }).click();
  await expect(page.locator(".task-reply-markdown")).toHaveCSS(
    "font-size",
    "20px",
  );
  await expect(
    page.getByRole("textbox", { name: "继续描述任务", exact: true }),
  ).toHaveCSS("font-size", "20px");
  await expect(
    page.getByRole("link", { name: "外部链接", exact: true }),
  ).toHaveAttribute("target", "_self");
  await open(page);
  await settings(page)
    .getByLabel("链接打开方式", { exact: true })
    .selectOption("smart");
  await settings(page)
    .getByRole("button", { name: "默认", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".task-reply-markdown")).toHaveCSS(
    "font-size",
    "15px",
  );
  await expect(
    page.getByRole("link", { name: "外部链接", exact: true }),
  ).toHaveAttribute("target", "_blank");
  await expect(
    page.getByRole("link", { name: "站内链接", exact: true }),
  ).toHaveAttribute("target", "_self");
  await open(page);
  await settings(page)
    .getByLabel("链接打开方式", { exact: true })
    .selectOption("new-tab");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("link", { name: "站内链接", exact: true }),
  ).toHaveAttribute("target", "_blank");
  await expect(
    page.getByRole("link", { name: "外部链接", exact: true }),
  ).toHaveAttribute("rel", "noopener noreferrer");
  await open(page);
  await settings(page)
    .getByLabel("链接打开方式", { exact: true })
    .selectOption("smart");
});

test("desktop sleep prevention follows the active task and stays off while idle", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).__nativeSleepCalls = [];
    Object.defineProperty(window, "designBuddyDesktop", {
      configurable: true,
      value: {
        setRuntimeSleepBlocker: async (active: boolean) => {
          (window as any).__nativeSleepCalls.push(active);
        },
      },
    });
  });
  await page.route("**/api/chat", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({
      contentType: "text/event-stream",
      body: 'data: {"choices":[{"delta":{"content":"任务完成"}}]}\n\ndata: [DONE]\n\n',
    });
  });
  const accountPreferences = await loadHomeWithPreferences(page);
  await open(page);
  const wakeLock = settings(page).getByRole("switch", {
    name: "运行时防止系统休眠",
  });
  await expect(wakeLock).toHaveAttribute(
    "aria-checked",
    String(Boolean(accountPreferences.wakeLock)),
  );
  if ((await wakeLock.getAttribute("aria-checked")) === "true")
    await wakeLock.click();
  await expect(wakeLock).toHaveAttribute("aria-checked", "false");
  await wakeLock.click();
  await expect(wakeLock).toHaveAttribute("aria-checked", "true");
  const calls = () =>
    page.evaluate(() => (window as any).__nativeSleepCalls as boolean[]);
  await expect.poll(async () => (await calls()).includes(true)).toBe(false);
  await page.keyboard.press("Escape");
  await page
    .getByRole("textbox", { name: "任务描述", exact: true })
    .fill("实际运行一个短任务");
  await page.getByRole("button", { name: "开始任务", exact: true }).click();
  await expect.poll(async () => (await calls()).includes(true)).toBe(true);
  await expect.poll(async () => (await calls()).at(-1)).toBe(false);
  await open(page);
  await settings(page)
    .getByRole("switch", { name: "运行时防止系统休眠" })
    .click();
  await expect(
    settings(page).getByRole("switch", { name: "运行时防止系统休眠" }),
  ).toHaveAttribute("aria-checked", "false");
});

test("wake lock remains off while idle and releases after a real task finishes", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).__wakeLockStats = { requests: 0, releases: 0 };
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: {
        request: async () => {
          const stats = (window as any).__wakeLockStats;
          stats.requests += 1;
          let released = false;
          let releaseListener: (() => void) | undefined;
          return {
            addEventListener(_type: string, listener: () => void) {
              releaseListener = listener;
            },
            release: async () => {
              if (!released) {
                released = true;
                stats.releases += 1;
                releaseListener?.();
              }
            },
          };
        },
      },
    });
  });
  let finishTask!: () => void;
  const taskGate = new Promise<void>((resolve) => {
    finishTask = resolve;
  });
  await page.route("**/api/chat", async (route) => {
    await taskGate;
    await route.fulfill({
      contentType: "text/event-stream",
      body: 'data: {"choices":[{"delta":{"content":"任务完成"}}]}\n\ndata: [DONE]\n\n',
    });
  });
  const accountPreferences = await loadHomeWithPreferences(page);
  await open(page);
  const wakeLock = settings(page).getByRole("switch", {
    name: "运行时防止系统休眠",
  });
  await expect(wakeLock).toHaveAttribute(
    "aria-checked",
    String(Boolean(accountPreferences.wakeLock)),
  );
  if ((await wakeLock.getAttribute("aria-checked")) === "true")
    await wakeLock.click();
  await expect(wakeLock).toHaveAttribute("aria-checked", "false");
  await wakeLock.click();
  await expect(wakeLock).toHaveAttribute("aria-checked", "true");
  const stats = () =>
    page.evaluate(
      () =>
        (window as any).__wakeLockStats as {
          requests: number;
          releases: number;
        },
    );
  await expect.poll(async () => (await stats()).requests).toBe(0);
  await page.keyboard.press("Escape");
  await page
    .getByRole("textbox", { name: "任务描述", exact: true })
    .fill("实际运行一个短任务");
  await page.getByRole("button", { name: "开始任务", exact: true }).click();
  await expect.poll(async () => (await stats()).requests).toBe(1);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(async () => (await stats()).releases).toBe(1);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(async () => (await stats()).requests).toBe(2);
  await open(page);
  await expect(wakeLock).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");
  finishTask();
  await expect(page.locator(".task-reply-markdown")).toContainText("任务完成");
  await expect.poll(async () => (await stats()).releases).toBe(2);
  await open(page);
  await expect(wakeLock).toHaveAttribute("aria-checked", "true");
  await wakeLock.click();
  await expect(wakeLock).toHaveAttribute("aria-checked", "false");
});

test("custom models persist, can be edited, and only explicit send requests their real model ID", async ({
  page,
}) => {
  const calls: { model?: string }[] = [];
  await page.route("**/api/chat", (route) => {
    calls.push(route.request().postDataJSON());
    return route.fulfill({
      contentType: "text/event-stream",
      body: 'data: {"choices":[{"delta":{"content":"收到"}}]}\n\ndata: [DONE]\n\n',
    });
  });
  await page.goto("/");
  await open(page, true);
  await add(page);
  await expect(settings(page).getByRole("status")).toContainText("已保存");
  await settings(page)
    .getByRole("button", { name: "编辑custom-test-v1", exact: true })
    .click();
  const editor = page.getByRole("dialog", { name: "编辑模型", exact: true });
  await editor.getByLabel("模型名称", { exact: true }).fill("custom-test-v2");
  await editor.getByRole("button", { name: "保存", exact: true }).click();
  await settings(page)
    .getByRole("button", { name: "个性化", exact: true })
    .click();
  const saved = page.waitForResponse(
    (response) =>
      response.url().includes("/profile/preferences") &&
      response.request().method() === "PUT" &&
      response.request().postDataJSON()?.value?.defaultModel ===
        "custom-test-v2",
  );
  await settings(page)
    .getByLabel("默认模型", { exact: true })
    .selectOption("custom-test-v2");
  await saved;
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "选择大模型", exact: true }),
  ).toContainText("custom-test-v2");
  await page.reload();
  await page.getByRole("button", { name: "选择大模型", exact: true }).click();
  await page.getByRole("option", { name: /custom-test-v2/ }).click();
  expect(calls).toHaveLength(0);
  await page
    .getByRole("textbox", { name: "任务描述", exact: true })
    .fill("使用自定义模型");
  await page.getByRole("button", { name: "开始任务", exact: true }).click();
  await expect(page.locator(".task-reply-markdown")).toContainText("收到");
  expect(calls).toHaveLength(1);
  expect(calls[0].model).toBe("custom-test-v2");
  await open(page, true);
  page.once("dialog", (confirmation) => confirmation.accept());
  await settings(page)
    .getByRole("button", { name: "移除custom-test-v2", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("combobox", { name: "对话模型", exact: true }),
  ).toHaveValue("custom-test-v2");
  expect(calls).toHaveLength(1);
});

test("removing a selected model asks confirmation and resets only the home selection", async ({
  page,
}) => {
  await page.goto("/");
  await open(page, true);
  await add(page);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "选择大模型", exact: true }).click();
  await page.getByRole("option", { name: /custom-test-v1/ }).click();
  await open(page, true);
  page.once("dialog", (confirmation) => confirmation.dismiss());
  await settings(page)
    .getByRole("button", { name: "移除custom-test-v1", exact: true })
    .click();
  await expect(
    settings(page).getByRole("button", {
      name: "编辑custom-test-v1",
      exact: true,
    }),
  ).toBeVisible();
  page.once("dialog", (confirmation) => confirmation.accept());
  await settings(page)
    .getByRole("button", { name: "移除custom-test-v1", exact: true })
    .click();
  await expect(
    settings(page).getByRole("region", { name: "已添加模型" }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "选择大模型", exact: true }),
  ).not.toContainText("custom-test-v1");
  await page.reload();
  await open(page, true);
  await expect(
    settings(page).getByRole("region", { name: "已添加模型" }),
  ).toHaveCount(0);
});

test("invalid and duplicate model IDs are rejected and secrets stay out of synced preferences", async ({
  page,
}) => {
  await page.goto("/");
  await open(page, true);
  await add(page, "bad model");
  const editor = page.getByRole("dialog", { name: "添加模型", exact: true });
  await expect(editor.getByRole("alert")).toContainText("有效模型标识");
  await editor.getByLabel("模型名称", { exact: true }).fill("secure-test");
  await editor.getByRole("combobox").first().selectOption("deepseek");
  await editor
    .getByLabel("API Key", { exact: true })
    .fill("test-key-not-a-real-secret");
  await expect(editor.getByLabel("API Key", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
  await editor.locator("summary").click();
  await expect(
    editor.locator(".settings-model-dialog__token-row"),
  ).toBeVisible();
  await editor.getByRole("button", { name: "保存", exact: true }).click();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), KEY),
  ).not.toContain("test-key-not-a-real-secret");
  await add(page, "secure-test");
  await expect(editor.getByRole("alert")).toContainText("已存在");
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).models.length,
      KEY,
    ),
  ).toBe(1);
});

test("storage failure is surfaced without claiming a save", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate((key) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, value) {
      if (k === key || k === "designbuddy.ai-provider.v1")
        throw new DOMException("blocked", "QuotaExceededError");
      return original.call(this, k, value);
    };
  }, KEY);
  await open(page);
  await settings(page)
    .getByLabel("链接打开方式", { exact: true })
    .selectOption("same-tab");
  await expect(settings(page).getByRole("alert")).toContainText("设置未保存");
  await expect(
    settings(page).getByLabel("链接打开方式", { exact: true }),
  ).toHaveValue("smart");
  await settings(page)
    .getByRole("button", { name: "模型", exact: true })
    .click();
  await add(page);
  await expect(
    page
      .getByRole("dialog", { name: "添加模型", exact: true })
      .getByRole("alert"),
  ).toBeVisible();
  await expect(settings(page).getByRole("form")).toBeVisible();
  await expect(
    settings(page).getByRole("region", { name: "已添加模型" }),
  ).toHaveCount(0);
});

test("corrupt storage falls back safely and storage events refresh preferences", async ({
  page,
}) => {
  await page.addInitScript((key) => localStorage.setItem(key, "{broken"), KEY);
  // Wait for account preferences to settle before testing storage-event updates.
  await loadHomeWithPreferences(page);
  await open(page);
  await expect(
    settings(page).getByRole("slider", { name: "字体大小" }),
  ).toHaveValue("15");
  await page.evaluate((key) => {
    localStorage.setItem(
      key,
      JSON.stringify({
        fontSize: 99,
        linkMode: "same-tab",
        models: [
          { id: "local-test-id", name: "跨标签页模型", modelId: "synced-v1" },
        ],
      }),
    );
    window.dispatchEvent(
      new StorageEvent("storage", { key, storageArea: localStorage }),
    );
  }, KEY);
  await expect(
    settings(page).getByRole("slider", { name: "字体大小" }),
  ).toHaveValue("20");
  await expect(
    settings(page).getByLabel("链接打开方式", { exact: true }),
  ).toHaveValue("same-tab");
  await settings(page)
    .getByRole("button", { name: "模型", exact: true })
    .click();
  await expect(
    settings(page).getByRole("region", { name: "已添加模型" }),
  ).toContainText("跨标签页模型");
});
