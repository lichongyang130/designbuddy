import fs from 'fs';
import path from 'path';

const file = 'scripts/agent-daemon.mjs';
let content = fs.readFileSync(file, 'utf-8');

const triggerLogic = `  } else if (req.url === '/trigger' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        if (payload.tool === 'pdf-export') {
           // We simulate calling the OS MCP Daemon via child_process here
           // since agent-daemon acts as the orchestrator.
           const { exec } = await import('child_process');
           const argsStr = JSON.stringify(payload.args || {});
           
           exec(\`node plugins/installed/pdf-export/main.mjs '\${argsStr}'\`, { cwd: process.cwd() }, (err, stdout, stderr) => {
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
    });`;

if (!content.includes('/trigger')) {
  content = content.replace(`  } else if (req.url === '/events' && req.method === 'GET') {`, triggerLogic + `\n  } else if (req.url === '/events' && req.method === 'GET') {`);
  fs.writeFileSync(file, content, 'utf-8');
}
