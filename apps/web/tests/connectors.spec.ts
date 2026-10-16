import { test, expect } from "@playwright/test";

const githubRecord = { id: "github", name: "GitHub", description: "代码仓库", provider: "github", status: "connected", scopes: ["repo"] };

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

test("unimplemented service configuration is explicit and does not authorize", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => { if (request.url().includes("/api/connectors")) requests.push(request.url()); });
  await page.getByRole("button", { name: "配置Gmail 邮箱", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Gmail 邮箱", exact: true })).toBeVisible();
  await expect(page.locator(".connector-service-note")).toContainText("该服务尚未接入");
  await expect(page.getByRole("button", { name: "授权连接", exact: true })).toHaveCount(0);
  expect(requests).toEqual([]);
  await page.getByRole("button", { name: "添加自定义服务配置", exact: true }).click();
  await expect(page).toHaveURL(/\/connectors\/create$/);
});

test("custom endpoint validation, persistence and confirmed deletion", async ({ page }) => {
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
  await expect(page.locator(".connector-service-note")).toContainText("尚未建立连接");
  await expect(page.locator(".connector-config-values")).toContainText("SSE");
  await page.reload();
  await expect(page.getByRole("heading", { name: "团队知识库", exact: true })).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("designbuddy.workspace.v1")!).state.connectors);
  expect(saved[0].status).toBe("disconnected");
  expect(saved[0].endpoint).toBe("https://connector.example/mcp");
  expect(externalRequests).toBe(0);
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "删除本地配置", exact: true }).click();
  await expect(page.getByRole("heading", { name: "团队知识库", exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "删除本地配置", exact: true }).click();
  await expect(page).toHaveURL(/\/connectors$/);
  await expect(page.getByRole("button", { name: "查看团队知识库", exact: true })).toHaveCount(0);
});

test("OAuth failures do not create a connected state", async ({ page }) => {
  await page.route("**/api/connectors/oauth/start", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "授权接口尚未配置" }) }));
  await page.getByRole("button", { name: "配置GitHub", exact: true }).click();
  await page.getByRole("button", { name: "授权连接", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("授权接口尚未配置");
  await expect(page.locator(".connector-verified-status")).toContainText("尚未向服务端核验");
  await expect(page).toHaveURL(/\/connectors\/github$/);
});

for (const authorizationUrl of ["http://github.com/login/oauth/authorize", "https://untrusted.example/authorize"]) {
  test(`reject unexpected OAuth destination ${authorizationUrl}`, async ({ page }) => {
    await page.route("**/api/connectors/oauth/start", (route) => route.fulfill({ json: { authorizationUrl } }));
    await page.getByRole("button", { name: "配置GitHub", exact: true }).click();
    await page.getByRole("button", { name: "授权连接", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("已阻止跳转");
    await expect(page).toHaveURL(/\/connectors\/github$/);
  });
}

test("valid OAuth starts through backend and redirects to the provider", async ({ page }) => {
  let payload: { provider: string; returnTo: string } | undefined;
  await page.route("**/api/connectors/oauth/start", (route) => {
    payload = route.request().postDataJSON();
    return route.fulfill({ json: { authorizationUrl: "https://github.com/login/oauth/authorize?state=ui-test" } });
  });
  // Mock the provider too: this test does not perform real authorization.
  await page.route("https://github.com/login/oauth/authorize**", (route) => route.fulfill({ contentType: "text/html", body: "<h1>Mock authorization</h1>" }));
  await page.getByRole("button", { name: "配置GitHub", exact: true }).click();
  await page.getByRole("button", { name: "授权连接", exact: true }).click();
  await expect(page).toHaveURL("https://github.com/login/oauth/authorize?state=ui-test");
  expect(payload?.provider).toBe("github");
  expect(new URL(payload!.returnTo).pathname).toBe("/connectors/oauth");
});

test("server verification strips secrets, and disconnect calls the backend", async ({ page }) => {
  await page.route("**/api/connectors", (route) => route.fulfill({ json: [{ ...githubRecord, accessToken: "fixture-must-not-persist" }] }));
  await page.route("**/api/connectors/github/disconnect", (route) => route.fulfill({ status: 204 }));
  await page.getByRole("button", { name: "配置GitHub", exact: true }).click();
  await page.getByRole("button", { name: "刷新连接状态", exact: true }).click();
  await expect(page.locator(".connector-verified-status")).toContainText("已连接（服务端确认）");
  const saved = await page.evaluate(() => localStorage.getItem("designbuddy.workspace.v1"));
  expect(saved).not.toContain("fixture-must-not-persist");
  expect(saved).not.toContain("accessToken");
  page.once("dialog", (dialog) => dialog.accept());
  const request = page.waitForRequest((request) => request.url().endsWith("/connectors/github/disconnect") && request.method() === "POST");
  await page.getByRole("button", { name: "断开连接", exact: true }).click();
  await request;
  await expect(page.locator(".connector-verified-status")).toContainText("未连接");
});

test("malformed server data and callback query flags cannot fake success", async ({ page }) => {
  await page.route("**/api/connectors", (route) => route.fulfill({ json: { connected: true } }));
  await page.goto("/connectors/oauth?success=true");
  await expect(page.getByRole("alert")).toContainText("无效的状态数据");
  await expect(page.getByRole("button", { name: "重新核验", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "返回连接器市场", exact: true }).click();
  await expect(page.locator(".connector-status-dot.is-connected")).toHaveCount(0);
});

test("sidebar and market navigation remain functional", async ({ page }) => {
  await page.getByRole("navigation", { name: "主导航", exact: true }).getByRole("button", { name: "更多", exact: true }).click();
  await page.getByRole("menuitem", { name: "连接器", exact: true }).click();
  await expect(page).toHaveURL(/\/connectors$/);
  await page.getByRole("navigation", { name: "专家技能连接器导航" }).getByRole("button", { name: "技能", exact: true }).click();
  await expect(page.getByRole("heading", { name: "精选技能", exact: true })).toBeVisible();
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
