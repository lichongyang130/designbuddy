import { test, expect, type Page } from "@playwright/test";
const nav = (page: Page, name: string) =>
  page
    .getByRole("navigation", { name: "FORME 页面目录" })
    .getByRole("button", { name: new RegExp(name + "$") })
    .click();
const unique = () =>
  "u_" + crypto.randomUUID().replaceAll("-", "").slice(0, 18);
async function account(page: Page, username: string, register = true) {
  await page.getByRole("button", { name: "工作区状态", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "后台连接与账号" });
  await expect(dialog).toContainText("sqlite · 已连接");
  await dialog.getByLabel("服务器用户名").fill(username);
  await dialog.getByLabel("服务器密码").fill("test-password-12345");
  await dialog
    .getByRole("button", {
      name: register ? "注册并保留访客数据" : "登录账号",
      exact: true,
    })
    .click();
  await expect(
    dialog.getByRole("button", { name: "退出服务器账号", exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "关闭服务器窗口" }).click();
}
test("real same-origin API and accounts: save a template then recover on another browser", async ({
  page,
  browser,
}) => {
  const username = unique();
  await page.goto("/inspiration/forme");
  await account(page, username);
  await expect(
    page.getByRole("button", { name: `账号菜单：${username}`, exact: true }),
  ).toBeVisible();
  await nav(page, "场景灵感");
  await page.getByLabel("项目名称", { exact: true }).fill("跨设备空间方案");
  await page.getByRole("button", { name: "保存到服务器", exact: true }).click();
  await expect(page.locator(".template-cloud")).toContainText(
    "已保存到服务器 · 版本 1",
  );
  const second = await browser.newContext();
  try {
    const p = await second.newPage();
    await p.goto("/inspiration");
    await account(p, username, false);
    await p.getByRole("button", { name: "服务器作品", exact: true }).click();
    const dialog = p.getByRole("dialog", { name: "服务器作品" });
    await expect(dialog.locator("li")).toHaveCount(1);
    p.once("dialog", (d) => d.accept());
    await dialog
      .getByRole("button", { name: "恢复并打开", exact: true })
      .click();
    await expect(p).toHaveURL(/\/inspiration\/forme$/);
    await expect(p.getByLabel("项目名称", { exact: true })).toHaveValue(
      "跨设备空间方案",
    );
    await p.reload();
    await expect(p.getByLabel("项目名称", { exact: true })).toHaveValue(
      "跨设备空间方案",
    );
  } finally {
    await second.close();
  }
});
test("stale tab cannot silently overwrite a newer server snapshot", async ({
  page,
  context,
}) => {
  await page.goto("/inspiration/forme");
  await nav(page, "场景灵感");
  await expect(
    page.getByRole("button", { name: "保存到服务器", exact: true }),
  ).toBeEnabled();
  const p = await context.newPage();
  await p.goto("/inspiration/forme");
  await expect(
    p.getByRole("button", { name: "保存到服务器", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("项目名称", { exact: true }).fill("服务器新内容");
  await page.getByRole("button", { name: "保存到服务器", exact: true }).click();
  await expect(page.locator(".template-cloud")).toContainText("版本 1");
  await nav(p, "场景灵感");
  await p.getByLabel("项目名称", { exact: true }).fill("另一个标签页旧内容");
  await p.getByRole("button", { name: "保存到服务器", exact: true }).click();
  await expect(p.locator(".template-cloud")).toContainText(
    "服务器已有更新版本",
  );
  await expect(
    p.getByRole("button", { name: "保存到服务器", exact: true }),
  ).toBeDisabled();
  p.once("dialog", (d) => d.accept());
  await p.getByRole("button", { name: "恢复服务器版本", exact: true }).click();
  await expect(p.getByLabel("项目名称", { exact: true })).toHaveValue(
    "服务器新内容",
  );
  await p.close();
});
test("all 19 sample editors save actual state to owner-scoped server library", async ({
  page,
}) => {
  test.setTimeout(90000);
  const ids = [
    "travel",
    "museum",
    "luma",
    "city",
    "research",
    "handbook",
    "chishan",
    "nature",
    "hyperframes",
    "film",
    "sound",
    "live",
    "webgl",
    "forme",
    "atelier",
    "roots",
    "daylight",
    "tide",
    "morrow",
  ];
  for (const id of ids) {
    await page.goto("/inspiration/" + id);
    await page
      .getByRole("button", { name: "保存到服务器", exact: true })
      .click();
    await expect(page.locator(".template-cloud")).toContainText(
      "已保存到服务器 · 版本 1",
    );
  }
  await page.goto("/inspiration");
  await page.getByRole("button", { name: "服务器作品", exact: true }).click();
  await expect(page.getByRole("dialog").locator("li")).toHaveCount(19);
});
test("server draft restores its type and route on another device", async ({
  page,
  browser,
}) => {
  const username = unique();
  await page.goto("/inspiration/sound");
  await account(page, username);
  await page.getByLabel("声音作品名称").fill("声音服务器副本");
  await page.getByRole("button", { name: /做同款/ }).click();
  await expect(page).toHaveURL(/\/sound\/draft\//);
  await page.getByRole("button", { name: "保存到服务器", exact: true }).click();
  await expect(page.locator(".template-cloud")).toContainText("已保存到服务器");
  const second = await browser.newContext();
  try {
    const p = await second.newPage();
    await p.goto("/inspiration");
    await account(p, username, false);
    await p.getByRole("button", { name: "服务器作品", exact: true }).click();
    p.once("dialog", (d) => d.accept());
    await p
      .getByRole("dialog")
      .getByRole("button", { name: "恢复并打开" })
      .click();
    await expect(p).toHaveURL(/\/sound\/draft\//);
    await expect(p.getByLabel("声音作品名称")).toHaveValue("声音服务器副本");
  } finally {
    await second.close();
  }
});
test("unavailable backend and HTML fallback fail honestly; local editing stays available", async ({
  page,
}) => {
  await page.route(/^https?:\/\/[^/]+\/api\//, (r) =>
    r.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "测试后台离线" }),
    }),
  );
  await page.goto("/inspiration/forme");
  await expect(page.locator(".template-cloud")).toContainText("测试后台离线");
  await expect(
    page.getByRole("button", { name: "保存到服务器", exact: true }),
  ).toBeDisabled();
  await nav(page, "场景灵感");
  await page.getByLabel("项目名称", { exact: true }).fill("离线也保留编辑");
  await page.unroute(/^https?:\/\/[^/]+\/api\//);
  await page.route(/^https?:\/\/[^/]+\/api\//, (r) =>
    r.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<h1>SPA fallback</h1>",
    }),
  );
  await page
    .getByRole("button", { name: "检查服务器版本", exact: true })
    .click();
  await expect(page.locator(".template-cloud")).toContainText(
    "接口没有返回 JSON",
  );
  await expect(page.getByLabel("项目名称", { exact: true })).toHaveValue(
    "离线也保留编辑",
  );
  await page.unroute(/^https?:\/\/[^/]+\/api\//);
  await page
    .getByRole("button", { name: "检查服务器版本", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "保存到服务器", exact: true }),
  ).toBeEnabled();
});
for (const width of [320, 375, 768, 1440])
  test(`backend controls and status dialog fit ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/inspiration/forme");
    await expect(
      page.getByRole("button", { name: "保存到服务器", exact: true }),
    ).toBeEnabled();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    if (width < 600) {
      await page
        .getByRole("button", { name: "账号菜单：19932101651", exact: true })
        .click();
      await page
        .getByRole("dialog", { name: "账号菜单", exact: true })
        .getByRole("button", { name: "设置", exact: true })
        .click();
      await page
        .getByRole("dialog", { name: "设置", exact: true })
        .getByRole("button", { name: "个人主页", exact: true })
        .click();
      await page
        .getByRole("button", { name: "后台连接与账号", exact: true })
        .click();
    } else
      await page
        .getByRole("button", { name: "工作区状态", exact: true })
        .click();
    await expect(page.getByRole("dialog")).toContainText("sqlite · 已连接");
    expect(
      await page
        .getByRole("dialog")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.goto("/inspiration");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  });

test("project editor saves confirmed JSON; second browser loads owned projects", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  const username = unique();
  await account(page, username);
  await page.goto("/projects");
  await page.getByRole("button", { name: "＋ 新建项目", exact: true }).click();
  await expect(page).toHaveURL(/\/editor\//);
  await page.getByRole("button", { name: "同步云端", exact: true }).click();
  await expect(page.locator(".db-save-state")).toContainText("云端已同步");
  await page.route("**/api/projects", (r) =>
    r.fulfill({ contentType: "text/html", body: "<h1>Not an API</h1>" }),
  );
  await page.getByRole("button", { name: "同步云端", exact: true }).click();
  await expect(page.locator(".db-save-state")).not.toContainText("云端已同步");
  await expect(page.getByText(/接口没有返回 JSON/)).toBeVisible();
  const second = await browser.newContext();
  try {
    const p = await second.newPage();
    await p.goto("/");
    await account(p, username, false);
    await p.goto("/projects");
    await p
      .getByRole("button", { name: "载入云端/团队项目", exact: true })
      .click();
    await expect(p.getByRole("alert")).toContainText("已载入 1 个");
    await expect(
      p.getByRole("heading", { name: "未命名设计项目", exact: true }),
    ).toBeVisible();
  } finally {
    await second.close();
  }
});
test("expired browser cookie can rebootstrap and log in without reloading", async ({
  page,
  context,
}) => {
  await page.goto("/");
  const username = unique();
  await account(page, username);
  await context.clearCookies();
  await page.getByRole("button", { name: "工作区状态", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "后台连接与账号" });
  await expect(dialog.getByLabel("服务器用户名")).toBeVisible();
  await dialog.getByLabel("服务器用户名").fill(username);
  await dialog.getByLabel("服务器密码").fill("test-password-12345");
  await dialog.getByRole("button", { name: "登录账号", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "退出服务器账号", exact: true }),
  ).toBeVisible();
});
test("real FFmpeg MP4 export, and HTML fallback retains WebM rather than a fake MP4", async ({
  page,
}) => {
  test.setTimeout(60000);
  const health = await (await page.request.get("/api/health")).json();
  test.skip(
    !health.capabilities.videoTranscodeConfigured,
    "Install FFmpeg and configure FFMPEG_PATH to run the real encoder test.",
  );
  await page.goto("/studio");
  await page.getByRole("button", { name: /动态短片.*用浏览器/ }).click();
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "录制并导出 MP4", exact: true })
    .click();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(/\.mp4$/);
  const fs = await import("node:fs/promises");
  const bytes = await fs.readFile((await download.path())!);
  expect(bytes.subarray(4, 8).toString()).toBe("ftyp");
  expect(bytes.length).toBeGreaterThan(1000);
  await expect(page.getByRole("status")).toContainText("MP4 动画视频已导出。");
  const metadata = await page.evaluate(async (base64) => {
    const v = document.createElement("video");
    v.src = "data:video/mp4;base64," + base64;
    await new Promise<void>((res, rej) => {
      v.onloadedmetadata = () => res();
      v.onerror = () => rej(Error("MP4 decode failed"));
    });
    return { duration: v.duration, width: v.videoWidth, height: v.videoHeight };
  }, bytes.toString("base64"));
  expect(metadata.duration).toBeGreaterThan(4);
  expect(metadata.duration).toBeLessThan(7);
  expect(metadata.width).toBe(1280);
  expect(metadata.height).toBe(720);
  await page.route("**/api/video/transcode", (r) =>
    r.fulfill({ contentType: "text/html", body: "<h1>SPA fallback</h1>" }),
  );
  const fallback = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "录制并导出 MP4", exact: true })
    .click();
  expect((await fallback).suggestedFilename()).toMatch(/\.webm$/);
  await expect(page.getByRole("status")).toContainText("转码接口没有返回 MP4");
});
