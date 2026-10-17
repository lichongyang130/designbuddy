import { apiJSON } from "../../../apps/web/src/api/client";
import type { AccountIdentity } from "./account";

export type OAuthProvider = "google" | "github";

/** Sign in with a server username and password. The server sets the session cookie. */
export async function loginWithPassword(
  username: string,
  password: string,
): Promise<AccountIdentity> {
  const body = await apiJSON<{ user: AccountIdentity }>("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return body.user;
}

/** Create a server account. The caller must already hold a guest session. */
export async function registerWithPassword(
  username: string,
  password: string,
): Promise<AccountIdentity> {
  const body = await apiJSON<{ user: AccountIdentity }>("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return body.user;
}

/** Which third-party sign-in buttons the server actually configured. */
export async function fetchOAuthProviders(): Promise<
  Record<OAuthProvider, boolean>
> {
  return apiJSON<Record<OAuthProvider, boolean>>("/auth/providers");
}

/** Leave the SPA for the provider round trip; the server redirects back to `next`. */
export function startOAuth(provider: OAuthProvider, next: string): void {
  window.location.assign(
    `/api/auth/oauth/${provider}?next=${encodeURIComponent(next)}`,
  );
}

/** Only in-app paths are accepted as a post-login destination. */
export function sanitizeNext(value: string | null): string {
  if (!value || value.length > 200 || /[\r\n\\]/.test(value)) return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
