import { test, expect } from "@playwright/test";
import {
  GUEST_STORAGE,
  ensureAccountViaAPI,
  freshAccountPage,
  registerViaAPI,
} from "./auth-helpers";

const PASSWORD = "test-password-12345";

const adminName = (process.env.DESIGNBUDDY_ADMIN_ACCOUNTS || "").split(/[,\s]+/).filter(Boolean)[0] || "";

/**
 * The operator console is only for the accounts the server names in
 * DESIGNBUDDY_ADMIN_ACCOUNTS. A normal account gets a clear refusal instead of
 * a page with half the data.
 */
test("the operator console is visible to the configured admin and refused to everyone else", async ({ browser }) => {
  const username = "plain_" + crypto.randomUUID().slice(0, 8);

  const plain = await freshAccountPage(browser, username, PASSWORD);
  try {
    const page = plain.page;
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "管理后台", exact: true })).toBeVisible();

    // A normal account is refused, and it sees no server data at all.
    await expect(page.locator(".ad-message.is-error")).toContainText("管理员");
    await expect(page.locator(".ad-stats")).toHaveCount(0);
    await expect(page.locator("section[aria-label=\"账号\"]")).toHaveCount(0);

    if (!adminName) {
      // Nobody is configured as an operator: the console stays closed for everyone.
      return;
    }

    // The configured operator sees the server.
    const adminContext = await browser.newContext({ storageState: GUEST_STORAGE });
    try {
      const adminPage = await adminContext.newPage();
      await adminPage.goto("/");
      await ensureAccountViaAPI(adminPage, adminName, PASSWORD);
      await adminPage.goto("/admin");
      await expect(adminPage.locator(".ad-stats")).toBeVisible();
      await expect(adminPage.locator("section[aria-label=\"账号\"]")).toContainText(adminName);
      await expect(adminPage.locator("section[aria-label=\"技能健康\"]")).toContainText("可执行");
      await expect(adminPage.locator("section[aria-label=\"模型用量\"]")).toBeVisible();
    } finally {
      await adminContext.close();
    }
  } finally {
    await plain.context.close();
  }
});

test("an operator can turn an account off and the audit keeps the record", async ({ browser }) => {
  test.skip(!adminName, "这台服务器没有配置管理员账号（DESIGNBUDDY_ADMIN_ACCOUNTS）");
  const guest = "guest_" + crypto.randomUUID().slice(0, 8);

  // A second account on the same server, in its own browser context.
  const guestContext = await browser.newContext({ storageState: GUEST_STORAGE });
  try {
    const guestPage = await guestContext.newPage();
    await guestPage.goto("/");
    await registerViaAPI(guestPage, guest, PASSWORD);

    const adminContext = await browser.newContext({ storageState: GUEST_STORAGE });
    try {
      const page = await adminContext.newPage();
      await page.goto("/");
      await ensureAccountViaAPI(page, adminName, PASSWORD);
      await page.goto("/admin");
      await expect(page.locator(".ad-stats")).toBeVisible();
      await expect(page.locator("section[aria-label=\"账号\"]")).toContainText(guest);

      const row = page.locator(".ad-list li").filter({ hasText: guest });
      await row.getByRole("button", { name: "停用" }).click();
      await expect(page.locator(".ad-message")).toContainText("已停用");
      await expect(row.getByText("已停用")).toBeVisible();
      await expect(page.locator("section[aria-label=\"审计\"]")).toContainText("account.disable");

      // The disabled account loses its session on the server right away.
      await guestPage.goto("/api/auth/me");
      await expect(guestPage.locator("body")).toContainText("SESSION_REQUIRED");
    } finally {
      await adminContext.close();
    }
  } finally {
    await guestContext.close();
  }
});
