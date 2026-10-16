import type { Output } from "./executors";
export const utf8 = (s: string) => new TextEncoder().encode(s);
export const xml = (s: unknown) => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
export const out = (name: string, mime: string, value: string | Uint8Array): Output => ({ name, mime, bytes: typeof value === "string" ? utf8(value) : value });
export const json = (name: string, value: unknown) => out(name, "application/json", JSON.stringify(value, null, 2));
export function text(bytes: Uint8Array) {
  let value: string;
  try { value = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, ""); }
  catch { throw Error("文本不是有效 UTF-8，请转换编码后重试。"); }
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) throw Error("文件包含二进制内容或不支持的控制字符。");
  return value;
}
