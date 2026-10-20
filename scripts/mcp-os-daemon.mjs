import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import readline from 'readline';

const WORKSPACE_DIR = process.env.WORKSPACE_DIR || process.cwd();
const PLUGINS_DIR = path.join(WORKSPACE_DIR, 'plugins/installed');

// 1. Scan and load all installed plugins dynamically
const tools = [];
const pluginExecutors = {};

function loadPlugins() {
  if (!fs.existsSync(PLUGINS_DIR)) return;
  const dirs = fs.readdirSync(PLUGINS_DIR);
  for (const dir of dirs) {
    const manifestPath = path.join(PLUGINS_DIR, dir, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        
        // Expose as an MCP Tool
        tools.push({
          name: manifest.id,
          description: `[Skill] ${manifest.name}: ${manifest.description}\nPermissions: ${manifest.permissions.join(', ')}`,
          inputSchema: manifest.inputSchema || { type: "object", properties: {} }
        });
        
        pluginExecutors[manifest.id] = {
          entrypoint: manifest.entrypoint,
          cwd: path.join(PLUGINS_DIR, dir),
          permissions: manifest.permissions
        };
      } catch (e) {
        console.error(`Failed to load plugin ${dir}: ${e.message}`);
      }
    }
  }
}

loadPlugins();

// 2. Setup the OS MCP Daemon
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });

rl.on('line', (line) => {
  if (!line.trim()) return;
  try {
    const msg = JSON.parse(line);
    
    if (msg.method === 'list_tools') {
      console.log(JSON.stringify({
        jsonrpc: "2.0", 
        id: msg.id, 
        result: { tools: tools }
      }));
    } else if (msg.method === 'call_tool') {
      const toolName = msg.params.name;
      const args = msg.params.arguments || {};
      
      const executor = pluginExecutors[toolName];
      if (!executor) {
        console.log(JSON.stringify({
          jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: "Plugin tool not found" }
        }));
        return;
      }

      // Security check simulation (In real life, this would prompt UI for 'write:approval')
      if (executor.permissions.includes('workspace:write:approval')) {
         // simulated block
      }
      
      // Execute the plugin in a spawned process
      const [cmd, ...cmdArgs] = executor.entrypoint.split(' ');
      // Pass args as a JSON string argument to the script
      cmdArgs.push(JSON.stringify(args));
      
      const proc = spawn(cmd, cmdArgs, {
        cwd: executor.cwd,
        env: { ...process.env, WORKSPACE_DIR }
      });
      
      let output = '';
      let errorOut = '';
      
      proc.stdout.on('data', d => output += d.toString());
      proc.stderr.on('data', d => errorOut += d.toString());
      
      proc.on('close', (code) => {
        const finalText = output + (errorOut ? `\nError:\n${errorOut}` : '');
        console.log(JSON.stringify({
          jsonrpc: "2.0", 
          id: msg.id, 
          result: { 
            content: [{ type: "text", text: finalText || "Executed successfully without output." }] 
          }
        }));
      });

    }
  } catch (e) {
    // Ignore JSON parse errors for MCP compliance
  }
});

console.error("OS MCP Daemon started. Loaded Plugins:", Object.keys(pluginExecutors).length);

// Keep process alive
setInterval(() => {}, 1000 * 60 * 60);
