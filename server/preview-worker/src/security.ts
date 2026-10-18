import { timingSafeEqual } from "node:crypto";

export function hasValidBearerToken(header: string | undefined, expectedToken: string): boolean {
  if (!header || !header.startsWith("Bearer ")) return false;
  const provided = header.slice("Bearer ".length).trim();
  if (!provided || provided.length !== expectedToken.length) return false;

  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expectedToken));
  } catch {
    return false;
  }
}

export function isSafeSessionId(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,128}$/.test(value);
}
