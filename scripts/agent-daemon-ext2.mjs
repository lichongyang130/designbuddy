import fs from 'fs';
const file = 'scripts/agent-daemon.mjs';
let content = fs.readFileSync(file, 'utf-8');

content = content.replace("const { exec } = await import('child_process');", "const { exec } = require('child_process');");
if (content.includes("require('child_process')")) {
  content = "import { exec } from 'child_process';\n" + content.replace("const { exec } = require('child_process');", "");
}
fs.writeFileSync(file, content, 'utf-8');
