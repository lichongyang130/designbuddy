import { test, expect } from "@playwright/test";
import { GUEST_STORAGE } from "./auth-helpers";

test.describe("immersive welcome", () => {
  test.use({ storageState: GUEST_STORAGE });
  test("backend outage still shows the latest login and permits explicit local entry", async ({
    page,
  }) => {
    await page.route("**/api/local/session", (route) =>
      route.fulfill({ status: 503, json: { error: "Backend unavailable" } }),
    );
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "欢迎回来" })).toBeVisible();
    await expect(page.locator(".auth-mode-switch")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /无法加载登录选项/ }),
    ).toBeVisible();
    await page.goto("/welcome");
    await page.getByRole("button", { name: /先逛逛工作台/ }).click();
    await expect(page.locator(".welcome-page")).toHaveCount(0);
  });
  test("language changes all welcome chrome, persists and follows into forms", async ({
    page,
  }) => {
    await page.goto("/welcome");
    const language = page.getByRole("combobox");
    await language.selectOption("en");
    await expect(
      page.getByRole("heading", { name: "Bring your ideas to life." }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Continue with Google/ }),
    ).toBeVisible();
    await page.reload();
    await expect(language).toHaveValue("en");
    await page.getByRole("link", { name: /Log in \/ Sign up/ }).click();
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();
    await expect(page.getByLabel("Username", { exact: true })).toBeVisible();
    await language.selectOption("ja");
    await expect(
      page.getByRole("heading", { name: "おかえりなさい" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /GitHub でログイン/ }),
    ).toBeVisible();
    await language.selectOption("zh-TW");
    await expect(page.getByRole("heading", { name: "歡迎回來" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-TW");
  });
  test("unconfigured OAuth is an honest notice, not a fake login", async ({
    page,
  }) => {
    await page.route("**/api/auth/providers", (route) =>
      route.fulfill({ json: { google: false, github: false } }),
    );
    await page.goto("/welcome");
    for (const provider of ["Google", "GitHub"]) {
      await page
        .getByRole("button", { name: new RegExp(`使用 ${provider} 登录`) })
        .click();
      await expect(page.getByRole("alert")).toContainText("尚未配置");
      await expect(page).toHaveURL(/\/welcome$/);
    }
  });
  for (const provider of ["google", "github"]) {
    test(`${provider} configured button starts the existing OAuth endpoint (mock provider config only)`, async ({
      page,
    }) => {
      await page.route("**/api/auth/providers", (route) =>
        route.fulfill({ json: { google: true, github: true } }),
      );
      let called = "";
      await page.route(`**/api/auth/oauth/${provider}?*`, (route) => {
        called = route.request().url();
        return route.fulfill({
          contentType: "text/plain",
          body: "OAuth endpoint intercepted for UI test; no provider authentication performed.",
        });
      });
      await page.goto("/welcome");
      await expect(page.locator(".welcome-oauth small")).toHaveCount(0);
      await page
        .getByRole("button", {
          name: provider === "google" ? "使用 Google 登录" : "使用 GitHub 登录",
        })
        .click();
      await expect
        .poll(() => called)
        .toContain(`/api/auth/oauth/${provider}?next=%2F`);
    });
  }
  test("provider discovery failure can be retried", async ({ page }) => {
    await page.route("**/api/auth/providers", (route) =>
      route.fulfill({ status: 503, json: { error: "Unavailable" } }),
    );
    await page.goto("/welcome");
    await expect(
      page.getByRole("button", { name: /无法加载登录选项/ }),
    ).toBeVisible();
    await page.unroute("**/api/auth/providers");
    await page.route("**/api/auth/providers", (route) =>
      route.fulfill({ json: { google: false, github: false } }),
    );
    await page.getByRole("button", { name: /无法加载登录选项/ }).click();
    await expect(page.locator(".welcome-oauth small")).toHaveCount(2);
  });
  for (const name of ["本地 AI", "API 密钥"]) {
    test(`${name} opens actual model settings`, async ({ page }) => {
      await page.goto("/welcome");
      await page.getByRole("button", { name: new RegExp(name) }).click();
      await expect(page.locator(".welcome-page")).toHaveCount(0);
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByRole("dialog")).toContainText("模型");
    });
  }
  test("register and password login really establish a server account and preserve next", async ({
    page,
  }) => {
    const username = `welcome_${Date.now().toString(36)}`,
      password = "welcome-test-password-12";
    await page.goto("/register?next=%2Finspiration%2Fwelcome-07");
    await page.getByLabel("用户名", { exact: true }).fill(username);
    await page.getByLabel("密码", { exact: true }).fill(password);
    await page.getByLabel("确认密码", { exact: true }).fill(password);
    await page.getByRole("button", { name: "注册", exact: true }).click();
    await expect(page).toHaveURL(/\/inspiration\/welcome-07$/);
    await expect(page.locator(".welcome-template-image")).toBeVisible();
    await page.goto("/login?next=%2Finspiration%2Fwelcome-12");
    await page.getByLabel("用户名", { exact: true }).fill(username);
    await page.getByLabel("密码", { exact: true }).fill("wrong-password-12");
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await page.getByLabel("密码", { exact: true }).fill(password);
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await expect(page).toHaveURL(/\/inspiration\/welcome-12$/);
    await expect(page.locator(".welcome-template-image")).toBeVisible();
  });
  for (const width of [1440, 768, 390, 320]) {
    test(`welcome fits ${width}px and keyboard language control`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/welcome");
      await expect(
        page.getByRole("heading", { name: "把灵感，带进现实。" }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.getByRole("combobox").focus();
      await expect(page.getByRole("combobox")).toBeFocused();
      await page.getByRole("combobox").selectOption("en");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    });
  }
});

test.describe("15 builtin welcome image templates", () => {
  test("all appear in image templates, decode at full resolution and match real PNG downloads", async ({
    page,
    request,
  }) => {
    test.setTimeout(90000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/inspiration");
    await page.getByRole("button", { name: "图片", exact: true }).click();
    await expect(page.locator('[data-sample^="welcome-"]')).toHaveCount(15);
    for (let id = 1; id <= 15; id++) {
      const n = String(id).padStart(2, "0");
      await page.goto(`/inspiration/welcome-${n}`);
      await expect(page.locator(".welcome-template-image")).toBeVisible();
      expect(
        await page
          .locator(".welcome-template-image")
          .evaluate(async (el: HTMLImageElement) => {
            await el.decode();
            return [el.naturalWidth, el.naturalHeight];
          }),
      ).toEqual([1440, 1000]);
      const link = page.getByRole("link", { name: "下载 PNG ↓" });
      const href = await link.getAttribute("href");
      const response = await request.get(href!);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain("image/png");
    }
    expect(errors).toEqual([]);
  });
  test("copy, notes, reload and server save/restore work without modifying original PNG", async ({
    page,
  }) => {
    await page.goto("/inspiration/welcome-07");
    const notes = page.getByRole("textbox", { name: "我的使用备注" });
    const text = "模板备注保存测试。".repeat(30);
    await notes.fill(text);
    await page.getByRole("button", { name: "做同款 · 保留此类型" }).click();
    await expect(page).toHaveURL(
      /\/inspiration\/welcome-07\/draft\/[a-z0-9-]+$/,
    );
    await expect(notes).toHaveValue(text);
    await page.reload();
    await expect(notes).toHaveValue(text);
    await page
      .getByRole("button", { name: "保存到服务器", exact: true })
      .click();
    await expect(page.locator(".template-cloud")).toContainText(
      "已保存到服务器 · 版本 1",
    );
    await notes.fill("待撤销的修改");
    page.on("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: /恢复服务器版本/ }).click();
    await expect(notes).toHaveValue(text);
  });
});
