import { apiJSON } from "../../../apps/web/src/api/client";

/** Who the server thinks the caller is. Guests have no username. */
export type AccountIdentity = {
  id: string;
  username: string | null;
  displayName: string;
  email: string;
  createdAt: string;
  kind: "account" | "guest";
};

/** One line of the account's own audit trail. The detail never holds content. */
export type AccountAuditEntry = {
  id: string;
  actor: string;
  action: string;
  detail: string;
  createdAt: number;
};

export async function fetchAccount(): Promise<AccountIdentity> {
  const body = await apiJSON<{ user: AccountIdentity }>("/auth/me");
  return body.user;
}

export async function updateAccountProfile(input: {
  displayName: string;
  email: string;
}): Promise<AccountIdentity> {
  const body = await apiJSON<{ user: AccountIdentity }>("/auth/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return body.user;
}

export async function changeAccountPassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  await apiJSON<{ ok: boolean }>("/auth/password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

/** Removes the account row and every session. The caller must confirm. */
export async function deleteAccount(input: {
  currentPassword: string;
  confirm: boolean;
}): Promise<AccountAuditEntry[]> {
  const body = await apiJSON<{ ok: boolean; audit: AccountAuditEntry[] }>(
    "/auth/account",
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  return body.audit ?? [];
}

export async function fetchAccountAudit(): Promise<AccountAuditEntry[]> {
  return apiJSON<AccountAuditEntry[]>("/auth/audit");
}
