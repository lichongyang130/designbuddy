import fs from 'fs';
const file = 'apps/web/src/inspiration/samples/FakeUIRenderer.tsx';
let content = fs.readFileSync(file, 'utf-8');
content = content.replace(/\\\`/g, '\`');
fs.writeFileSync(file, content, 'utf-8');
