import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The app gates every page behind login, so UI tests share one
 * authenticated browser session created here before the suite runs.
 * Files that must start as a guest override storageState per file.
 */
const root = dirname(fileURLToPath(import.meta.url));
export const AUTH_STORAGE_PATH = resolve(root, "playwright/.auth.json");

function sessionValue(headers: Headers): string {
  const setCookies =
    typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : [headers.get("set-cookie") || ""];
  const match = setCookies
    .join(";")
    .match(/designbuddy_session=([^;]+)/);
  if (!match?.[1]) throw new Error("The server did not issue a session cookie.");
  return match[1];
}

export default async function globalSetup() {
  const backend = `http://127.0.0.1:${process.env.DESIGNBUDDY_PORT || 8787}`;
  const deadline = Date.now() + 180_000;
  for (;;) {
    try {
      const health = await fetch(`${backend}/api/health`);
      if (health.ok) break;
    } catch {
      // The server is still starting.
    }
    if (Date.now() > deadline)
      throw new Error(`The backend at ${backend} never became ready.`);
    await new Promise((resolveWait) => setTimeout(resolveWait, 1000));
  }

  const headers = {
    "Content-Type": "application/json",
    Origin: backend,
  };
  const session = await fetch(`${backend}/api/local/session`, {
    method: "POST",
    headers,
    body: "{}",
  });
  if (!session.ok) throw new Error("Could not create a guest session.");
  const guest = sessionValue(session.headers);
  const username = `uisetup_${Date.now().toString(36)}`;
  const register = await fetch(`${backend}/api/auth/register`, {
    method: "POST",
    headers: { ...headers, Cookie: `designbuddy_session=${guest}` },
    body: JSON.stringify({
      username,
      password: "playwright-setup-password-1",
    }),
  });
  if (!register.ok)
    throw new Error(`Could not register the setup account: ${register.status}.`);
  const account = sessionValue(register.headers);

  mkdirSync(dirname(AUTH_STORAGE_PATH), { recursive: true });
  writeFileSync(
    AUTH_STORAGE_PATH,
    JSON.stringify({
      cookies: [
        {
          name: "designbuddy_session",
          value: account,
          domain: "127.0.0.1",
          path: "/",
          httpOnly: true,
          secure: false,
          sameSite: "Lax",
          expires: Math.floor(Date.now() / 1000) + 30 * 86400,
        },
      ],
      origins: [],
    }),
  );
}
