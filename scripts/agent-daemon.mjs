import { exec } from 'child_process';
import http from 'http';
import readline from 'readline';

let currentState = {};
let sseClients = [];

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (req.url === '/state' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        currentState = JSON.parse(body);
        res.writeHead(200);
        res.end('ok');
      } catch (e) {
        res.writeHead(400);
        res.end();
      }
    });
  } else if (req.url === '/trigger' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        if (payload.tool === 'pdf-export' || payload.tool === 'figma-bridge') {
           // We simulate calling the OS MCP Daemon via child_process here
           // since agent-daemon acts as the orchestrator.
           
           const argsStr = JSON.stringify(payload.args || {});
           
           exec(`node plugins/installed/${payload.tool}/main.mjs '${argsStr}'`, { cwd: process.cwd() }, (err, stdout, stderr) => {
              if (err) {
                 res.writeHead(500);
                 res.end(JSON.stringify({ status: 'error', error: stderr || err.message }));
              } else {
                 res.writeHead(200);
                 res.end(JSON.stringify({ status: 'ok', output: stdout }));
              }
           });
        } else {
           res.writeHead(400); res.end();
        }
      } catch (e) {
        res.writeHead(400);
        res.end();
      }
    });
  } else if (req.url === '/events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    sseClients.push(res);
    req.on('close', () => {
      sseClients = sseClients.filter(c => c !== res);
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(4124, '0.0.0.0');

function broadcast(action, payload) {
  const data = JSON.stringify({ action, payload });
  sseClients.forEach(c => c.write(`data: ${data}\n\n`));
}

// --- MCP Server Implementation over STDIO ---
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });

rl.on('line', (line) => {
  if (!line.trim()) return;
  try {
    const msg = JSON.parse(line);
    if (msg.method === 'list_tools') {
      console.log(JSON.stringify({
        jsonrpc: "2.0", id: msg.id, result: {
          tools: [
            {
              name: "get_ui_context",
              description: "Reads the real-time JSON state of the UI the user is looking at. Returns the live data structure powering the screen.",
              inputSchema: { type: "object", properties: {}, required: [] }
            },
            {
              name: "update_ui_data",
              description: "Overwrites the UI state with a modified JSON tree. Use get_ui_context first to get the schema, modify it, and pass it back here to instantly update the UI.",
              inputSchema: { type: "object", properties: { data: { type: "object", description: "Full JSON tree to apply" } }, required: ["data"] }
            },
            {
              name: "trigger_ui_skill",
              description: "Triggers a built-in AI skill in the browser: 'magic-copy' (rewrite text), 'fill-mock-data' (randomize numbers).",
              inputSchema: { type: "object", properties: { skill: { type: "string" } }, required: ["skill"] }
            },
            {
              name: "apply_design_theme",
              description: "Compiles a DESIGN.md markdown block and instantly hot-reloads the UI style.",
              inputSchema: { type: "object", properties: { markdown: { type: "string" } }, required: ["markdown"] }
            }
          ]
        }
      }));
    } else if (msg.method === 'call_tool') {
      const { name, arguments: args } = msg.params;
      if (name === 'get_ui_context') {
        console.log(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: JSON.stringify(currentState) }] } }));
      } else if (name === 'update_ui_data') {
        broadcast('update_data', args.data);
        console.log(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: "UI data updated successfully in the browser." }] } }));
      } else if (name === 'trigger_ui_skill') {
        broadcast('run_skill', args.skill);
        console.log(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: `Skill '${args.skill}' triggered in UI.` }] } }));
      } else if (name === 'apply_design_theme') {
        broadcast('apply_theme', args.markdown);
        console.log(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: "Design system applied to UI." }] } }));
      } else {
        console.log(JSON.stringify({ jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: "Tool not found" } }));
      }
    }
  } catch (e) {
    // silently ignore parse errors so MCP protocol stays clean
  }
});
