import fs from 'fs';
const file = 'scripts/agent-daemon.mjs';
let content = fs.readFileSync(file, 'utf-8');

const targetStr = `if (payload.tool === 'pdf-export') {`;
const replaceStr = `if (payload.tool === 'pdf-export' || payload.tool === 'figma-bridge') {`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replaceStr);
  
  // also make sure we spawn the right script based on payload.tool
  content = content.replace(
    /exec\(\`node plugins\/installed\/pdf-export\/main\.mjs/,
    "exec(`node plugins/installed/${payload.tool}/main.mjs"
  );
  
  fs.writeFileSync(file, content, 'utf-8');
  console.log("agent-daemon.mjs updated to route all tools.");
} else {
  console.log("Already updated or target not found.");
}
