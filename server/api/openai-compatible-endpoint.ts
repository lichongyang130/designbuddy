import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type ResolveModelHost = (hostname: string) => Promise<string[]>;

async function resolveHost(hostname: string): Promise<string[]> {
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  return addresses.map((item) => item.address);
}

function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const parts = address.split(".").map(Number);
    const [a, b, c] = parts;
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && (b === 0 || b === 168)) return false;
    if (a === 192 && b === 2) return false;
    if (a === 198 && (b === 18 || b === 19 || b === 51)) return false;
    if (a === 203 && b === 0 && c === 113) return false;
    return true;
  }
  if (family === 6) {
    const normalized = address.toLowerCase();
    if (normalized.startsWith("::ffff:") || normalized.includes(".")) return false;
    const first = Number.parseInt(normalized.split(":")[0] || "0", 16);
    // Public IPv6 unicast is 2000::/3. Exclude transition and documentation ranges.
    if (first < 0x2000 || first > 0x3fff) return false;
    if (/^2001:(?:0|db8)(?::|$)/.test(normalized) || /^2002(?::|$)/.test(normalized)) return false;
    return true;
  }
  return false;
}

/**
 * Validate and normalize a user-entered OpenAI-compatible base URL.
 *
 * Custom endpoints are server-fetched, so local/private hosts and insecure
 * transports are refused. DNS answers are checked immediately before use;
 * redirects are also disabled by each caller.
 */
export async function normalizeOpenAICompatibleBaseUrl(
  value: unknown,
  resolve: ResolveModelHost = resolveHost,
): Promise<string> {
  if (typeof value !== "string" || !value.trim() || value.length > 2048)
    throw new Error("请输入有效的 OpenAI 兼容接口地址。");

  let url: URL;
  try { url = new URL(value.trim()); }
  catch { throw new Error("请输入有效的 OpenAI 兼容接口地址。"); }

  const hostname = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    isIP(hostname) ||
    !hostname.includes(".") ||
    hostname === "localhost" ||
    /\.(?:localhost|local|internal|lan|home|test|invalid)$/.test(hostname)
  ) {
    throw new Error("接口地址必须是可公网访问的 HTTPS 域名，不能使用本机或内网地址。");
  }

  let decodedPath: string;
  try { decodedPath = decodeURIComponent(url.pathname); }
  catch { throw new Error("接口地址路径无效。"); }
  if (decodedPath.includes("\\") || decodedPath.split("/").some((part) => part === "." || part === ".."))
    throw new Error("接口地址路径无效。");

  let addresses: string[];
  try { addresses = await resolve(hostname); }
  catch { throw new Error("无法解析接口地址，请检查域名和网络连接。"); }
  if (!addresses.length || addresses.some((address) => !isPublicAddress(address)))
    throw new Error("接口地址解析到了本机、内网或非公网地址，已拒绝连接。");

  let pathname = url.pathname.replace(/\/+$/, "");
  pathname = pathname.replace(/\/(?:chat\/completions|models)$/i, "");
  return `${url.origin}${pathname}`.replace(/\/+$/, "");
}
