import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { GUEST_STORAGE } from "./auth-helpers";

test.use({ storageState: GUEST_STORAGE });
for (const path of ["/register", "/login", "/skills"])
  test(`${path} explicit guest button opens and focuses the home prompt without registration or task submission`, async ({
    page,
  }) => {
    const submitted: string[] = [];
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        /\/api\/(auth\/(register|login)|chat|generation|skill-(plans|runs)|workflows\/[^/]+\/runs)(?:[/?]|$)/.test(
          request.url(),
        )
      )
        submitted.push(request.url());
    });
    await page.goto(path + "?next=%2Fadmin");
    await expect(
      page.getByRole("button", { name: "直接进入输入框" }),
    ).toBeVisible();
    await expect(
      page.locator(".welcome-form button[type=submit]"),
    ).toBeDisabled();
    await page.getByRole("button", { name: "直接进入输入框" }).click();
    await expect(page).toHaveURL(/\/$/);
    const prompt = page.getByRole("textbox", { name: "任务描述", exact: true });
    await expect(prompt).toBeVisible();
    await expect(prompt).toBeFocused();
    await prompt.fill("仅输入，还没有提交");
    await expect(prompt).toHaveValue("仅输入，还没有提交");
    expect(submitted).toEqual([]);
    expect(
      await page.evaluate(() =>
        localStorage.getItem("designbuddy.welcome-entered.v1"),
      ),
    ).toBe("true");
    await expect
      .poll(async () => {
        const response = await page.request.get("/api/auth/me");
        if (!response.ok) return response.status;
        const body = await response.json();
        return body.user?.kind ?? body.account?.kind;
      })
      .toBe("guest");
    await page.reload();
    await expect(page.locator(".welcome-page--auth")).toHaveCount(0);
    await expect(prompt).toBeVisible();
  });

for (const width of [1440, 390, 320])
  test(`registration button remains usable at ${width}px without changing artwork`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/register");
    await expect(
      page.getByRole("button", { name: "直接进入输入框" }),
    ).toBeVisible();
    await expect(page.locator(".welcome-form input")).toHaveCount(3);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator(".welcome-art-caption")).toHaveCount(1);
    expect(
      await page
        .locator(".welcome-page")
        .evaluate((el) => getComputedStyle(el).backgroundImage),
    ).toContain("gallery-lake");
    if (width === 1440) {
      const folder = resolve(
        process.cwd(),
        "../../docs/verification/auth-direct-entry-2026-10-20",
      );
      mkdirSync(folder, { recursive: true });
      await page.screenshot({
        path: resolve(folder, "register-direct-entry.png"),
        fullPage: true,
      });
    }
    await page.getByRole("button", { name: "直接进入输入框" }).click();
    await expect(
      page.getByRole("textbox", { name: "任务描述", exact: true }),
    ).toBeFocused();
  });

test("explicit guest entry works even when browser persistence is blocked", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "designbuddy.welcome-entered.v1")
        throw new DOMException("Blocked", "SecurityError");
      return original.call(this, key, value);
    };
  });
  await page.goto("/register");
  await page.getByRole("button", { name: "直接进入输入框" }).click();
  await expect(
    page.getByRole("textbox", { name: "任务描述", exact: true }),
  ).toBeFocused();
});

test("direct entry copy follows the selected language", async ({ page }) => {
  await page.goto("/register");
  for (const [locale, label] of [
    ["en", "Go straight to the prompt"],
    ["ja", "入力欄へ進む"],
    ["zh-TW", "直接進入輸入框"],
    ["zh-CN", "直接进入输入框"],
  ]) {
    await page.getByRole("combobox").selectOption(locale);
    await expect(page.getByRole("button", { name: label })).toBeVisible();
  }
});
