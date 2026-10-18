import { expect, type Page } from "@playwright/test";

/** Resolved relative to playwright.config.ts, like the shared storageState. */
export const AUTH_STORAGE = "./playwright/.auth.json";

/** Files that must start logged out pass this to test.use({ storageState }). */
export const GUEST_STORAGE = { cookies: [], origins: [] };

async function apiAuth(
  page: Page,
  action: "login" | "register",
  username: string,
  password: string,
  expected: number,
) {
  const status = await page.evaluate(
    async ([name, secret, endpoint]) => {
      await fetch("/api/local/session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const response = await fetch(`/api/auth/${endpoint}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: name, password: secret }),
      });
      return response.status;
    },
    [username, password, action] as const,
  );
  expect(status).toBe(expected);
  await page.reload();
}

/** Register a fresh account from any page (even the login gate) and enter the app. */
export async function registerViaAPI(
  page: Page,
  username: string,
  password = "test-password-12345",
) {
  await apiAuth(page, "register", username, password, 201);
}

/** Log an existing account in from any page (even the login gate) and enter the app. */
export async function loginViaAPI(
  page: Page,
  username: string,
  password = "test-password-12345",
) {
  await apiAuth(page, "login", username, password, 200);
}

/** Register, or log in when the username already exists (for example the configured admin). */
export async function ensureAccountViaAPI(
  page: Page,
  username: string,
  password = "test-password-12345",
) {
  const status = await page.evaluate(
    async ([name, secret]) => {
      const post = (endpoint: string) =>
        fetch(`/api/auth/${endpoint}`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: name, password: secret }),
        });
      await fetch("/api/local/session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const register = await post("register");
      if (register.status === 201) return 201;
      return (await post("login")).status;
    },
    [username, password] as const,
  );
  expect([200, 201]).toContain(status);
  await page.reload();
}

/**
 * A throwaway context signed in as a fresh account. Tests that touch
 * server-owned state must use this instead of the shared page fixture:
 * switching accounts rotates the session, which would log every later
 * test out of the shared setup session.
 */
export async function freshAccountPage(
  browser: Browser,
  username: string,
  password = "test-password-12345",
) {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto("/");
  await registerViaAPI(page, username, password);
  return { context, page };
}
