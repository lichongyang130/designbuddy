import readline from "node:readline";

const endpoint = process.env.DESIGNBUDDY_MCP_URL || "http://127.0.0.1:8787/api/mcp";
const token = process.env.DESIGNBUDDY_MCP_TOKEN;
const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
let protocolVersion = "2026-07-28";

for await (const line of input) {
  if (!line.trim()) continue;
  let request;
  try { request = JSON.parse(line); }
  catch {
    process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } })}\n`);
    continue;
  }
  try {
    const method = typeof request?.method === "string" ? request.method : "";
    if (method === "initialize") protocolVersion = "2025-03-26";
    else if (typeof request?.params?._meta?.["io.modelcontextprotocol/protocolVersion"] === "string") protocolVersion = request.params._meta["io.modelcontextprotocol/protocolVersion"];
    const toolName = method === "tools/call" && typeof request.params?.name === "string" ? request.params.name : undefined;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json", Accept: "application/json, text/event-stream",
        "MCP-Protocol-Version": protocolVersion, "Mcp-Method": method,
        ...(toolName ? { "Mcp-Name": toolName } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(request),
    });
    if (response.status === 202) continue;
    const body = await response.text();
    if (!response.ok) throw new Error(`MCP HTTP ${response.status}: ${body.slice(0, 1000)}`);
    process.stdout.write(`${body}\n`);
  } catch (error) {
    if (request?.id !== undefined) process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: request.id, error: { code: -32000, message: error instanceof Error ? error.message : "MCP transport failed." } })}\n`);
    else process.stderr.write(`${error instanceof Error ? error.message : "MCP transport failed."}\n`);
  }
}
