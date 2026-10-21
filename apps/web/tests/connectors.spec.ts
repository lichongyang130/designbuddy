import { test, expect } from "@playwright/test";

/**
 * The connector market is a real, server backed feature: configuration is
 * persisted in SQLite, OAuth runs through the backend, and a connector only
 * shows as connected after the server really reached the remote service.
 * Tests that would need the internet mock the connector API instead - they
 * never perform a real external authorization or a real remote call.
 */

const githubConnected = {
  id: "github",
  name: "GitHub",
  description: "在 GitHub 上克隆、推送代码，查看和管理仓库、Issue 与 Pull Request。",
  provider: "github",
  status: "connected",
  scopes: ["repo"],
  authTypes: ["oauth", "api_key"],
  authType: "api_key",
  configured: true,
  custom: false,
  connectedAt: "2026-01-01T00:00:00.000Z",
  note: "OAuth 使用服务端配置的 GitHub 应用。",
  docsUrl: "https://docs.github.com/rest",
};

test.beforeEach(async ({ page }) => { await page.goto("/connectors"); });

test("reference connector layout, imagery and shared sidebar", async ({ page }) => {
  await page.setViewportSize({ width: 1495, height: 795 });
  await expect(page.locator(".app-sidebar")).toBeVisible();
  expect((await page.locator(".app-sidebar").boundingBox())?.width).toBe(279);
  const card = await page.locator(".connector-tile").first().boundingBox();
  expect(card?.x).toBe(303);
  expect(card?.y).toBe(59);
  expect(card?.height).toBe(92);
  await expect(page.locator(".connector-tile")).toHaveCount(22);
  await expect(page.locator(".connector-tile").first().getByRole("button", { name: "查看Gmail 邮箱", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "专家技能连接器导航" }).getByRole("button", { name: "连接器", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "连接你每天使用的工具" })).toHaveCount(0);
  expect(await page.locator(".connector-tile img").evaluateAll((images) => images.every((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  // The server confirms the state of every connector in the background.
  await expect(page.locator(".connector-status-dot.is-connected")).toHaveCount(0);
  await page.getByRole("button", { name: "查看Gmail 邮箱", exact: true }).click();
  await expect(page.locator(".connector-verified-status")).toContainText("未连接");
});

test("search ignores case and whitespace, and supports an empty state", async ({ page }) => {
  await page.getByRole("searchbox", { name: "搜索连接器" }).fill("  GITHUB  ");
  await expect(page.locator(".connector-tile")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "查看GitHub", exact: true })).toBeVisible();
  await page.getByRole("searchbox", { name: "搜索连接器" }).fill("连接器不存在xyz");
  await expect(page.getByRole("heading", { name: "没有找到匹配的连接器" })).toBeVisible();
  await page.getByRole("button", { name: "清除搜索", exact: true }).click();
  await expect(page.locator(".connector-tile")).toHaveCount(22);
});

test("every built-in connector offers a real configuration screen", async ({ page }) => {
  // An OAuth connector: the browser only ever starts the server side flow.
  await page.getByRole("button", { name: "配置Gmail 邮箱", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Gmail 邮箱", exact: true })).toBeVisible();
  await expect(page.locator(".connector-verified-status")).toContainText("未连接");
  await expect(page.getByRole("button", { name: "授权连接", exact: true })).toBeVisible();
  await expect(page.locator(".connector-service-note")).toContainText("服务端");

  // A connector that needs an endpoint collects it, and never a secret in the URL.
  await page.goto("/connectors/tencent-meeting");
  await expect(page.getByRole("tab", { name: "MCP 服务", exact: true })).toBeVisible();
  await expect(page.getByLabel("服务地址", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "保存并连接", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "测试连接", exact: true })).toBeVisible();
});

test("custom endpoint validation, server persistence and confirmed deletion", async ({ page }) => {
  let externalRequests = 0;
  await page.route("https://connector.example/**", async (route) => { externalRequests += 1; await route.abort(); });
  await page.getByRole("button", { name: "自定义连接器", exact: true }).click();
  await page.getByLabel("连接器名称", { exact: true }).fill("团队知识库");
  await page.getByLabel("连接器说明", { exact: true }).fill("用于团队资料检索");
  await page.getByLabel("服务地址", { exact: true }).fill("http://connector.example/mcp");
  await page.getByRole("button", { name: "保存配置", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("必须使用 HTTPS");
  await page.getByLabel("服务地址", { exact: true }).fill("https://connector.example/mcp?token=example-only");
  await page.getByRole("button", { name: "保存配置", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("不能包含账号、密码、查询参数或片段");
  await page.getByLabel("服务地址", { exact: true }).fill("https://connector.example/mcp");
  await page.getByLabel("传输协议", { exact: true }).selectOption("sse");
  await page.getByRole("button", { name: "保存配置", exact: true }).click();
  await expect(page.getByRole("heading", { name: "团队知识库", exact: true })).toBeVisible();
  await expect(page.locator(".connector-verified-status")).toContainText("已保存配置，尚未连接");
  await expect(page.locator(".connector-config-values")).toContainText("SSE");
  // The configuration lives on the server, so a reload keeps it.
  await page.reload();
  await expect(page.getByRole("heading", { name: "团队知识库", exact: true })).toBeVisible();
  await page.goto("/connectors");
  await expect(page.getByRole("button", { name: "查看团队知识库", exact: true })).toBeVisible();
  expect(externalRequests).toBe(0, "saving a configuration must not contact the service");

  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "配置团队知识库", exact: true }).click();
  await page.getByRole("button", { name: "删除配置", exact: true }).click();
  await expect(page.getByRole("heading", { name: "团队知识库", exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "删除配置", exact: true }).click();
  await expect(page).toHaveURL(/\/connectors$/);
  await expect(page.getByRole("button", { name: "查看团队知识库", exact: true })).toHaveCount(0);
});

test("a failed verification keeps the connector disconnected and shows the real error", async ({ page }) => {
  await page.route("**/api/connectors/textin/connect", (route) =>
    route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({ error: "远程服务返回 HTTP 401：invalid x-ti-secret-code" }),
    }),
  );
  await page.goto("/connectors/textin");
  await page.getByLabel("服务地址", { exact: true }).fill("https://api.textin.com/parse");
  await page.getByLabel("x-ti-app-id", { exact: true }).fill("app-id-value");
  await page.getByLabel("x-ti-secret-code", { exact: true }).fill("secret-code-value");
  await page.getByRole("button", { name: "保存并连接", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("invalid x-ti-secret-code");
  await expect(page.locator(".connector-verified-status")).toContainText("未连接");
  await expect(page.getByRole("button", { name: "断开连接", exact: true })).toHaveCount(0);
});

test("a verified connection is shown as connected and can be disconnected", async ({ page }) => {
  await page.route("**/api/connectors/github/connect", (route) =>
    route.fulfill({
      json: {
        connector: { ...githubConnected, credentialHint: "…7f3a" },
        result: { ok: true, detail: "远程服务返回 HTTP 200，用时 42 ms。", latencyMs: 42, checkedAt: Date.now() },
      },
    }),
  );
  await page.goto("/connectors/github");
  await page.getByRole("tab", { name: "API Key", exact: true }).click();
  await page.getByLabel("GitHub 访问令牌", { exact: true }).fill("github_pat_fixture-value-7f3a");
  await page.getByRole("button", { name: "保存并连接", exact: true }).click();
  await expect(page.locator(".connector-verified-status")).toContainText("已连接");
  await expect(page.locator(".connector-verified-status")).toContainText("…7f3a");
  await expect(page.locator(".connector-test-result.is-ok")).toContainText("用时 42 ms");
  // The credential itself is never written to browser storage.
  const saved = await page.evaluate(() => localStorage.getItem("designbuddy.workspace.v1") ?? "");
  expect(saved).not.toContain("github_pat_fixture-value-7f3a");

  await page.route("**/api/connectors/github/disconnect", (route) =>
    route.fulfill({ json: { connector: { ...githubConnected, status: "disconnected", configured: false } } }),
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "断开连接", exact: true }).click();
  await expect(page.locator(".connector-verified-status")).toContainText("未连接");
});

test("the server records are shown so a person can audit what happened", async ({ page }) => {
  await page.route("**/api/connectors/github/events", (route) =>
    route.fulfill({
      json: {
        events: [
          { action: "connector.connect", detail: "远程服务返回 HTTP 200", ok: true, createdAt: Date.now() },
          { action: "connector.test", detail: "HTTP 401", ok: false, createdAt: Date.now() - 1000 },
        ],
      },
    }),
  );
  await page.goto("/connectors/github");
  await expect(page.locator(".connector-events li")).toHaveCount(2);
  await expect(page.locator(".connector-events .is-failed")).toContainText("connector.test");
});

test("OAuth failures do not create a connected state", async ({ page }) => {
  await page.route("**/api/connectors/oauth/start", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "服务端尚未配置 GITHUB_CLIENT_ID" }) }));
  await page.getByRole("button", { name: "配置GitHub", exact: true }).click();
  await page.getByRole("button", { name: "授权连接", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("GITHUB_CLIENT_ID");
  await expect(page.locator(".connector-verified-status")).toContainText("未连接");
  await expect(page).toHaveURL(/\/connectors\/github$/);
});

for (const authorizationUrl of ["http://github.com/login/oauth/authorize", "https://untrusted.example/authorize", "https://accounts.google.com/o/oauth2/v2/auth"]) {
  test(`reject unexpected OAuth destination ${authorizationUrl}`, async ({ page }) => {
    await page.route("**/api/connectors/oauth/start", (route) => route.fulfill({ json: { authorizationUrl } }));
    await page.getByRole("button", { name: "配置GitHub", exact: true }).click();
    await page.getByRole("button", { name: "授权连接", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("已阻止跳转");
    await expect(page).toHaveURL(/\/connectors\/github$/);
  });
}

test("valid OAuth starts through backend and redirects to the provider", async ({ page }) => {
  let payload: { connectorId: string; returnTo: string } | undefined;
  await page.route("**/api/connectors/oauth/start", (route) => {
    payload = route.request().postDataJSON();
    return route.fulfill({ json: { authorizationUrl: "https://github.com/login/oauth/authorize?state=ui-test" } });
  });
  // Mock the provider too: this test does not perform real authorization.
  await page.route("https://github.com/login/oauth/authorize**", (route) => route.fulfill({ contentType: "text/html", body: "<h1>Mock authorization</h1>" }));
  await page.getByRole("button", { name: "配置GitHub", exact: true }).click();
  await page.getByRole("button", { name: "授权连接", exact: true }).click();
  await expect(page).toHaveURL("https://github.com/login/oauth/authorize?state=ui-test");
  expect(payload?.connectorId).toBe("github");
  expect(new URL(payload!.returnTo).pathname).toBe("/connectors/oauth");
  expect(new URL(payload!.returnTo).searchParams.get("connector")).toBe("github");
});

test("malformed server data and callback query flags cannot fake success", async ({ page }) => {
  await page.route("**/api/connectors", (route) => route.fulfill({ json: { connected: true } }));
  await page.goto("/connectors/oauth?success=true&connector=github");
  await expect(page.getByRole("alert")).toContainText("无效的状态数据");
  await expect(page.getByRole("button", { name: "重新核验", exact: true })).toBeEnabled();
  // A query flag claiming success never renders a connected state.
  await page.route("**/api/connectors", (route) =>
    route.fulfill({ json: [{ ...githubConnected, status: "disconnected", configured: false }] }),
  );
  await page.getByRole("button", { name: "重新核验", exact: true }).click();
  await expect(page.locator(".connector-verified-status")).toContainText("未连接");
  await page.getByRole("button", { name: "返回连接器市场", exact: true }).click();
  await expect(page.locator(".connector-status-dot.is-connected")).toHaveCount(0);
});

test("sidebar and market navigation remain functional", async ({ page }) => {
  await page.getByRole("navigation", { name: "主导航", exact: true }).getByRole("button", { name: "更多", exact: true }).click();
  await page.getByRole("menuitem", { name: "连接器", exact: true }).click();
  await expect(page).toHaveURL(/\/connectors$/);
  await page.getByRole("navigation", { name: "专家技能连接器导航" }).getByRole("button", { name: "技能", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "让每项技能，都对应真实交付" })).toBeVisible();
  await page.getByRole("navigation", { name: "专家技能连接器导航" }).getByRole("button", { name: "连接器", exact: true }).click();
  await page.getByRole("button", { name: "首页", exact: true }).click();
  await expect(page.getByRole("heading", { name: /DesignBuddy 让工作更高效/ })).toBeVisible();
});

for (const width of [320, 375, 768, 1024]) {
  test(`connector layout fits ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole("searchbox", { name: "搜索连接器" })).toBeVisible();
    await expect(page.getByRole("button", { name: "自定义连接器", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const card = await page.locator(".connector-tile").first().boundingBox();
    expect(card!.x + card!.width).toBeLessThanOrEqual(width);
  });
}
