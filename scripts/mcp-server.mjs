import fs from 'fs';
import path from 'path';

// Define the root of the workspace state
const WORKSPACE_DIR = process.env.WORKSPACE_DIR || process.cwd();

// Fallback to simple stdio communication protocol
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

function handleMessage(msg) {
  try {
    const data = JSON.parse(msg);
    if (data.method === 'list_tools') {
      const response = {
        jsonrpc: "2.0",
        id: data.id,
        result: {
          tools: [
            {
              name: "read_design_state",
              description: "Read the current design configuration from themes.json and samples/shared.tsx to understand available assets.",
              inputSchema: { type: "object", properties: {}, required: [] }
            },
            {
              name: "apply_design_theme",
              description: "Apply a new design system via DESIGN.md by writing to workspace.",
              inputSchema: {
                type: "object",
                properties: {
                  markdown: { type: "string", description: "The DESIGN.md content conforming to the DesignBuddy spec." }
                },
                required: ["markdown"]
              }
            }
          ]
        }
      };
      console.log(JSON.stringify(response));
    } else if (data.method === 'call_tool') {
      const toolName = data.params.name;
      const args = data.params.arguments || {};
      
      if (toolName === 'read_design_state') {
        const themePath = path.join(WORKSPACE_DIR, 'apps/web/src/assets/expansion/themes.json');
        let content = "No state found.";
        if (fs.existsSync(themePath)) {
          content = fs.readFileSync(themePath, 'utf-8');
        }
        console.log(JSON.stringify({
          jsonrpc: "2.0",
          id: data.id,
          result: {
            content: [{ type: "text", text: `Themes Assets mapping:\n${content}` }]
          }
        }));
      } else if (toolName === 'apply_design_theme') {
        const targetPath = path.join(WORKSPACE_DIR, 'DESIGN.md');
        fs.writeFileSync(targetPath, args.markdown, 'utf-8');
        console.log(JSON.stringify({
          jsonrpc: "2.0",
          id: data.id,
          result: {
            content: [{ type: "text", text: "Successfully saved to DESIGN.md. The frontend can now parse this." }]
          }
        }));
      } else {
        console.log(JSON.stringify({
          jsonrpc: "2.0",
          id: data.id,
          error: { code: -32601, message: "Tool not found" }
        }));
      }
    }
  } catch (e) {
    // ignore unparseable lines or print error debug
  }
}

rl.on('line', (line) => {
  if (line.trim() === '') return;
  handleMessage(line);
});

console.error("DesignBuddy MCP Server started on stdio");
